/**
 * Signing: deals, Jev's answers and share links all carry an HMAC made with one server secret, so the page can
 * hold them but not forge them. The secret is SESSION_SECRET, or else one made on first start and kept in the
 * data directory (DATA_DIR, default data/), so links stay valid across restarts.
 */
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export interface SignEnv {
  SESSION_SECRET?: string;
  DATA_DIR?: string;
}

export const dataDir = (env: SignEnv, root: string): string => env.DATA_DIR || join(root, 'data');

export function loadSecret(env: SignEnv, root: string): string {
  if (env.SESSION_SECRET && env.SESSION_SECRET.length >= 16) return env.SESSION_SECRET;
  const dir = dataDir(env, root);
  const file = join(dir, 'secret');
  try {
    const s = readFileSync(file, 'utf8').trim();
    if (s.length >= 32) return s;
  } catch {
    // made below
  }
  mkdirSync(dir, { recursive: true });
  const s = randomBytes(32).toString('base64url');
  writeFileSync(file, s, { mode: 0o600 });
  return s;
}

export interface Signer {
  sign(purpose: string, message: string): string;
  verify(purpose: string, message: string, sig: string): boolean;
  /** A short one-way hash for telling players apart without keeping who they are. */
  hash(...parts: string[]): string;
}

export function signer(secret: string): Signer {
  const mac = (purpose: string, message: string) => createHmac('sha256', secret).update(`jev-cards:${purpose}:${message}`).digest().subarray(0, 16).toString('base64url');
  return {
    sign: mac,
    verify(purpose, message, sig) {
      const want = Buffer.from(mac(purpose, message));
      const got = Buffer.from(String(sig));
      return want.length === got.length && timingSafeEqual(want, got);
    },
    hash: (...parts) => createHash('sha256').update(secret).update(parts.join('\u0000')).digest('hex').slice(0, 16),
  };
}
