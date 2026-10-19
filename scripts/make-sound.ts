/**
 * Makes the game's audio through Opper: the background music (ElevenLabs Music), the sound effects (ElevenLabs
 * sound effects) and the host's lines (ElevenLabs v3 voice). The takes as generated go to assets/sound/; the files
 * the game plays go to public/sound/, evened out in loudness with ffmpeg, the music made into a seamless loop.
 * Needs OPPER_API_KEY and ffmpeg.
 *
 *   node scripts/make-sound.ts            # everything missing
 *   node scripts/make-sound.ts win-1 ding # just these (remade even when present)
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { TAUNTS } from '../server/taunt-lines.ts';

const raw = join(import.meta.dirname, '..', 'assets', 'sound');
const out = join(import.meta.dirname, '..', 'public', 'sound');
const key = process.env.OPPER_API_KEY;
if (!key) throw new Error('OPPER_API_KEY is not set');

/** The host: Charlie (deep, confident, energetic). */
const HOST = 'IKne3meq5aSn9XLyUdCD';
/** Jev, for its last word: Callum (husky trickster), so it never sounds like the host. */
const JEV = 'N2lVS1w4EtoT3dr4eOWO';

type Job =
  | { kind: 'music'; prompt: string; seconds: number }
  | { kind: 'sound'; prompt: string; seconds: number }
  | { kind: 'voice'; text: string; voice?: string };

const jobs: Record<string, Job> = {
  music: {
    kind: 'music',
    seconds: 96,
    prompt:
      'Soft background music for a TV quiz show, played quietly under the game. Light jazzy lounge: brushed drums, upright bass, vibraphone, warm electric piano, a few muted horn stabs. Playful and curious, steady 104 BPM, no big hits, no build-ups, no ending, no vocals. The same groove from start to end so it can loop.',
  },
  ding: { kind: 'sound', seconds: 1, prompt: 'Game show correct answer chime: a bright, short two-note bell ding, clean, no reverb tail' },
  buzzer: { kind: 'sound', seconds: 1, prompt: 'Game show wrong answer buzzer: a short low electric buzz, comedic, half a second' },
  timeup: { kind: 'sound', seconds: 1.5, prompt: 'Game show time is up: a long flat electronic buzzer, one second' },
  tick: { kind: 'sound', seconds: 0.5, prompt: 'A single crisp clock tick, very short, dry' },
  deal: { kind: 'sound', seconds: 0.5, prompt: 'A single playing card dealt quickly onto a table, a soft swoosh and light slap' },
  applause: { kind: 'sound', seconds: 5, prompt: 'TV studio audience bursts into cheering and applause, whistles, enthusiastic, then fades out' },
  join: { kind: 'sound', seconds: 1.2, prompt: 'Game show contestant joins: a bright, cheerful rising three-note chime with a light sparkle, short and clean' },
  'ready-click': { kind: 'sound', seconds: 0.6, prompt: 'A short soft pop and click, like a light switch confirming, friendly and quiet' },
  aww: { kind: 'sound', seconds: 3, prompt: 'TV studio audience sympathetic "awww" groan, disappointed but friendly, short' },
  ready: { kind: 'voice', text: '[excited] Contestants... are you ready?' },
  'intro-1': { kind: 'voice', text: '[excited] And now... a word from Jev!' },
  'intro-2': { kind: 'voice', text: '[curious] Jev, any last words?' },
  'intro-3': { kind: 'voice', text: "[playful] Let's hear what Jev has to say about that!" },
  'win-1': { kind: 'voice', text: "[excited] And the winner is... you! [laughs] Jev didn't see that coming!" },
  'win-2': { kind: 'voice', text: '[excited] Ladies and gentlemen, the human wins tonight!' },
  'lose-1': { kind: 'voice', text: '[sympathetic] Ohhh, so close! Jev takes this one.' },
  'lose-2': { kind: 'voice', text: '[playful] The machine wins tonight! [laughs] Rematch?' },
  draw: { kind: 'voice', text: '[surprised] A tie! You and Jev, dead even!' },
  best: { kind: 'voice', text: '[excited] And that is a new personal best!' },
  perfect: { kind: 'voice', text: '[excited] A perfect run! Every single card! Unbelievable!' },
  // Jev's last word, one file per line in server/taunts.ts.
  ...Object.fromEntries(TAUNTS.map((t) => [`jev-${t.id}`, { kind: 'voice', voice: JEV, text: `[${t.tone}] ${t.text}` } satisfies Job])),
};

async function post(path: string, body: unknown): Promise<Buffer> {
  const res = await fetch(`https://api.opper.ai${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status} ${(await res.text()).slice(0, 300)}`);
  const type = res.headers.get('content-type') ?? '';
  if (type.includes('json')) {
    // JSON answers carry the audio as base64.
    const j = (await res.json()) as Record<string, unknown>;
    const audio = j.audio as { b64_json?: string } | string | undefined;
    const b64 = typeof audio === 'string' ? audio : (audio?.b64_json ?? (j.data as { b64_json?: string }[] | undefined)?.[0]?.b64_json);
    if (!b64) throw new Error(`${path}: no audio in ${JSON.stringify(j).slice(0, 300)}`);
    return Buffer.from(b64, 'base64');
  }
  return Buffer.from(await res.arrayBuffer());
}

function make(job: Job): Promise<Buffer> {
  if (job.kind === 'music') return post('/v3/audio/music', { model: 'elevenlabs/music_v2_5', prompt: job.prompt, duration_seconds: job.seconds, instrumental: true, format: 'mp3' });
  if (job.kind === 'sound') return post('/v3/audio/generations', { model: 'elevenlabs/eleven_text_to_sound_v2', prompt: job.prompt, duration_seconds: job.seconds, format: 'mp3' });
  return post('/v3/audio/speech', { model: 'elevenlabs/eleven_v3', voice: job.voice ?? HOST, input: job.text, format: 'mp3' });
}

/** Loudness targets: the music sits well under the host and the effects. */
const LUFS: Record<Job['kind'], number> = { music: -24, sound: -19, voice: -15 };
/** Seconds of the music's end crossfaded into its start, so it loops without a seam. */
const LOOP_FADE = 3;

function finish(name: string, job: Job): void {
  const src = join(raw, `${name}.mp3`);
  const loud = `loudnorm=I=${LUFS[job.kind]}:TP=-2`;
  let args: string[];
  if (job.kind === 'music') {
    const d = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', src]).toString());
    const f = LOOP_FADE;
    // The loop is [f, d - f] followed by the end fading out over the start fading in.
    args = ['-filter_complex', `[0:a]asplit=3[a][b][c];[a]atrim=${f}:${d - f},asetpts=PTS-STARTPTS[body];[b]atrim=${d - f}:${d},asetpts=PTS-STARTPTS,afade=t=out:d=${f}[tail];[c]atrim=0:${f},asetpts=PTS-STARTPTS,afade=t=in:d=${f}[head];[tail][head]amix=inputs=2:normalize=0[x];[body][x]concat=n=2:v=0:a=1,${loud}:LRA=11`];
  } else args = ['-af', loud];
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', src, ...args, '-ar', '44100', '-b:a', '128k', join(out, `${name}.mp3`)]);
}

mkdirSync(raw, { recursive: true });
mkdirSync(out, { recursive: true });
const only = process.argv.slice(2);
const todo = Object.entries(jobs).filter(([name]) => (only.length ? only.includes(name) : !existsSync(join(out, `${name}.mp3`))));
// One at a time, with a pause and a retry when Opper says 429.
for (const [name, job] of todo) {
  const t0 = Date.now();
  let audio: Buffer | undefined;
  for (let attempt = 1; !audio; attempt++) {
    try {
      audio = await make(job);
    } catch (e) {
      if (attempt >= 5 || !String(e).includes('429')) throw e;
      await new Promise((r) => setTimeout(r, attempt * 4000));
    }
  }
  writeFileSync(join(raw, `${name}.mp3`), audio);
  finish(name, job);
  console.log(`${name.padEnd(10)} ${(audio.length / 1024).toFixed(0).padStart(5)} KB  ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}
