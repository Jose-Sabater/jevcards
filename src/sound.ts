/**
 * The show's sound: soft background music, sound effects, and the host's lines. Web Audio, so the music loops
 * without a gap and the host can duck it. Browsers only allow sound after a tap, so nothing plays until then.
 * Music, effects and the host can each be switched off; the choice is kept in this browser.
 *
 * Nothing here may stall the game: every wait has a time limit, a sound that fails to load is skipped (and tried
 * again next time), and a hidden tab pauses all sound and picks it up again when the tab comes back.
 */
import { store } from './dom.ts';

export type Effect = 'ding' | 'buzzer' | 'timeup' | 'tick' | 'deal' | 'applause' | 'aww' | 'join' | 'ready-click';
export type Line = 'ready' | 'intro' | 'win' | 'lose' | 'draw' | 'best' | 'perfect';

/** How many takes each line has: win-1.mp3, win-2.mp3; a line with one take is just ready.mp3. */
const TAKES: Record<Line, number> = { ready: 1, intro: 3, win: 2, lose: 2, draw: 1, best: 1, perfect: 1 };
const MUSIC_LEVEL = 0.32;
const DUCKED = 0.1;

export const prefs = store.get('jev-cards:sound', { music: true, effects: true, host: true });
const savePrefs = () => store.set('jev-cards:sound', prefs);

let ctx: AudioContext | undefined;
let musicGain: GainNode | undefined;
let musicSource: AudioBufferSourceNode | undefined;
const buffers = new Map<string, Promise<AudioBuffer | null>>();
/** Sources that hush() stops: the host's lines and the long effects (applause, aww). */
const stoppable = new Set<AudioBufferSourceNode>();
/** The host speaks one line at a time. Bumped by hush(), which drops every line still waiting. */
let hostQueue: Promise<void> = Promise.resolve();
let hostEpoch = 0;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function audio(): AudioContext | undefined {
  if (!ctx) {
    try {
      ctx = new AudioContext();
    } catch {
      return undefined;
    }
    musicGain = ctx.createGain();
    musicGain.gain.value = MUSIC_LEVEL;
    musicGain.connect(ctx.destination);
  }
  // Suspended before the first tap, and 'interrupted' on iOS after a call or another app took the audio.
  if (ctx.state !== 'running' && ctx.state !== 'closed' && document.visibilityState === 'visible') void ctx.resume().catch(() => undefined);
  return ctx;
}

function load(name: string): Promise<AudioBuffer | null> {
  let b = buffers.get(name);
  if (!b) {
    b = fetch(`/sound/${name}.mp3`)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data) => audio()!.decodeAudioData(data))
      .catch(() => {
        // Skip it this time, try again next time (a dropped connection should not mute it for good).
        buffers.delete(name);
        return null;
      });
    buffers.set(name, b);
  }
  return b;
}

/** Plays a buffer once; resolves when it ends, or after its length (plus a margin) if it never reports ending. */
function playBuffer(buf: AudioBuffer, gain = 1, stop = false): Promise<void> {
  const c = audio();
  if (!c) return Promise.resolve();
  const src = c.createBufferSource();
  src.buffer = buf;
  const g = c.createGain();
  g.gain.value = gain;
  src.connect(g).connect(c.destination);
  if (stop) stoppable.add(src);
  const ended = new Promise<void>((r) => (src.onended = () => r()));
  try {
    src.start();
  } catch {
    stoppable.delete(src);
    return Promise.resolve();
  }
  return Promise.race([ended, sleep(buf.duration * 1000 + 600)]).finally(() => stoppable.delete(src));
}

/** Call from a tap: unlocks audio, starts the music if it is on, and warms up the effects. */
export function unlock(): void {
  // iOS (every iPhone browser) plays web audio as "ambient", which the silent switch mutes. Ask for playback, as a
  // video would get. Safari 16.4+; elsewhere audioSession is missing and this does nothing.
  const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
  if (session && session.type !== 'playback' && (prefs.music || prefs.effects || prefs.host)) {
    try {
      session.type = 'playback';
    } catch {
      // not allowed here: ambient it stays
    }
  }
  if (!audio()) return;
  if (prefs.music) void startMusic();
  for (const e of ['ding', 'buzzer', 'deal', 'tick', 'timeup', 'ready'] as const) void load(e);
}

async function startMusic(): Promise<void> {
  if (musicSource || !audio()) return;
  const buf = await load('music');
  if (!buf || musicSource || !prefs.music) return;
  const src = ctx!.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  src.connect(musicGain!);
  // Fade in rather than start at full level.
  const now = ctx!.currentTime;
  musicGain!.gain.cancelScheduledValues(now);
  musicGain!.gain.setValueAtTime(0, now);
  musicGain!.gain.linearRampToValueAtTime(MUSIC_LEVEL, now + 2);
  src.start();
  musicSource = src;
}

function stopMusic(): void {
  try {
    musicSource?.stop();
  } catch {
    // never started
  }
  musicSource = undefined;
}

function setMusicLevel(level: number, seconds: number): void {
  if (!ctx || !musicGain) return;
  const now = ctx.currentTime;
  musicGain.gain.cancelScheduledValues(now);
  musicGain.gain.setTargetAtTime(level, now, seconds);
}

export function effect(name: Effect, gain = 1): void {
  if (!prefs.effects || !ctx) return;
  void load(name).then((b) => b && playBuffer(b, gain, name === 'applause' || name === 'aww'));
}

/** A short synthesized beep for the 3-2-1 countdown: low for the numbers, high for GO. */
export function beep(high: boolean): void {
  const c = ctx;
  if (!prefs.effects || !c || c.state !== 'running') return;
  const t = c.currentTime;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = 'square';
  osc.frequency.value = high ? 1046.5 : 523.25;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.18, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + (high ? 0.5 : 0.18));
  osc.connect(g).connect(c.destination);
  osc.start(t);
  osc.stop(t + (high ? 0.55 : 0.2));
}

/**
 * The host says a line (a random take), ducking the music meanwhile. Resolves when the line is over, at once
 * when the host is off or audio is not unlocked yet, and never later than the line's length plus a margin.
 */
export function say(line: Line): Promise<void> {
  return speak(TAKES[line] > 1 ? `${line}-${1 + Math.floor(Math.random() * TAKES[line])}` : line);
}

/** Jev says its last word (server/taunt-lines.ts), after whatever the host is still saying. */
export function jevSays(taunt: string): Promise<void> {
  return speak(`jev-${taunt}`);
}

function speak(name: string): Promise<void> {
  if (!prefs.host || !ctx) return Promise.resolve();
  const epoch = hostEpoch;
  hostQueue = hostQueue.then(async () => {
    if (epoch !== hostEpoch) return;
    const buf = await Promise.race([load(name), sleep(3000).then(() => null)]);
    if (!buf || !prefs.host || epoch !== hostEpoch) return;
    setMusicLevel(DUCKED, 0.08);
    await playBuffer(buf, 1, true);
    if (epoch === hostEpoch) setMusicLevel(MUSIC_LEVEL, 0.4);
  });
  return hostQueue;
}

/** Stops the host (and drops lines still waiting) and the long effects; the music carries on at full level. */
export function hush(): void {
  hostEpoch++;
  for (const src of stoppable) {
    try {
      src.stop();
    } catch {
      // already ended
    }
  }
  stoppable.clear();
  setMusicLevel(MUSIC_LEVEL, 0.2);
}

export function setPref(key: keyof typeof prefs, on: boolean): void {
  prefs[key] = on;
  savePrefs();
  if (key === 'music') {
    if (on) {
      audio();
      void startMusic();
    } else stopMusic();
  }
  if (key === 'host' && !on) hush();
}

// A hidden tab is silent; coming back picks the music up where it was.
document.addEventListener('visibilitychange', () => {
  if (!ctx || ctx.state === 'closed') return;
  if (document.visibilityState === 'hidden') void ctx.suspend().catch(() => undefined);
  else void ctx.resume().catch(() => undefined);
});
