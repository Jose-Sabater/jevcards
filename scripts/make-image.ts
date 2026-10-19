/**
 * Makes one photo for a card through Opper (GPT Image 2.5 Sunburst), under a spending cap shared by everyone
 * making cards at the same time: every image's cost (from the response) goes into a ledger, and no call starts once
 * the ledger, plus what this call may cost, would pass the cap.
 *
 *   node scripts/make-image.ts --name red-panda --prompt "A red panda on a branch, ..." [--quality medium|high] [--size 1024x1024|1024x1536|1536x1024]
 *
 * The original goes to assets/objects/<name>.png (kept local, not in git) and a 360 px copy (longest side) to
 * assets/objects/small/<name>.png, which the cards embed. Needs OPPER_API_KEY and macOS `sips`.
 *
 *   SPEND_CAP   dollars, default 10        SPEND_LEDGER   default scratch/image-spend.jsonl
 *   --by        who is spending (an agent name), written to the ledger
 */
import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const root = join(import.meta.dirname, '..');
const arg = (name: string, fallback?: string): string | undefined => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const name = arg('name');
const prompt = arg('prompt');
const quality = arg('quality', 'medium')!;
const size = arg('size', '1024x1024')!;
const by = arg('by', 'unknown')!;
if (!name || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name) || !prompt) throw new Error('usage: --name kebab-name --prompt "..." [--quality medium|high] [--size WxH] [--by who]');
if (!['medium', 'high'].includes(quality)) throw new Error('quality is medium or high');
const key = process.env.OPPER_API_KEY;
if (!key) throw new Error('OPPER_API_KEY is not set');

const cap = Number(process.env.SPEND_CAP ?? 10);
const ledger = join(root, process.env.SPEND_LEDGER ?? 'scratch/image-spend.jsonl');
// What one image may cost, before the response says what it did: a margin over the measured price.
const worst = quality === 'high' ? 0.08 : 0.025;
const spent = () => (existsSync(ledger) ? readFileSync(ledger, 'utf8').trim().split('\n').filter(Boolean).reduce((s, l) => s + (JSON.parse(l).cost ?? 0), 0) : 0);

const before = spent();
if (before + worst > cap) {
  console.error(`over the cap: $${before.toFixed(3)} spent of $${cap}; not making ${name}`);
  process.exit(2);
}

const res = await fetch('https://api.opper.ai/v3/images', {
  method: 'POST',
  headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ model: 'openai/gpt-image-2.5-sunburst', prompt, size, quality }),
});
const body = (await res.json().catch(() => ({}))) as { data?: { b64_json?: string }[]; usage?: { cost?: number }; error?: unknown };
const cost = body.usage?.cost ?? (res.ok ? worst : 0);
mkdirSync(dirname(ledger), { recursive: true });
appendFileSync(ledger, JSON.stringify({ at: new Date().toISOString(), by, name, quality, size, cost, ok: res.ok }) + '\n');
const b64 = body.data?.[0]?.b64_json;
if (!res.ok || !b64) {
  console.error(`failed (${res.status}): ${JSON.stringify(body.error ?? body).slice(0, 300)}`);
  process.exit(1);
}

const original = join(root, 'assets/objects', `${name}.png`);
const small = join(root, 'assets/objects/small', `${name}.png`);
mkdirSync(dirname(small), { recursive: true });
writeFileSync(original, Buffer.from(b64, 'base64'));
execFileSync('sips', ['-s', 'format', 'png', '-Z', '360', original, '--out', small], { stdio: 'ignore' });
console.log(`${name}: $${cost.toFixed(4)} (total $${(before + cost).toFixed(3)} of $${cap}) -> ${small}`);
