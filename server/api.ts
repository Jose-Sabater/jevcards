/**
 * The page's API, as one Node request handler: mounted by the Vite dev server (vite.config.ts) and by the
 * production server (server/main.ts).
 *
 *   GET  /api/health   { ok, liveMatches }: matches a restart would end
 *   GET  /api/models   the models Jev can be played as, and which ones are reachable with the keys set
 *   POST /api/ask      { card, model, deal }: asks the model that card (by id; the server owns the pictures and the
 *                      questions, so this endpoint can only spend keys on the deck). Only a card in that deal, or
 *                      one of the how page's examples: Jev's answer, right or wrong, gives most answers away
 *   POST /api/taunt    { model, mode, winner, person, jev, ... }: Jev picks its last word after a match (numbers
 *                      only; the lines are fixed in server/taunts.ts)
 *   GET  /api/explain  ?card=: the exact request Jev gets for a card (its picture shortened), for the how-it-works
 *                      page; for that page's example cards, also their solution
 *   GET  /api/deal     ?mode=: a signed deal for a game, and its cards in order
 *   POST /api/mark     { deal, index, card, option | point, ms }: marks one answer as it is given, in order, and
 *                      answers { right, solution }; the page's deck has no answers (server/scores.ts)
 *   GET  /api/highscores           the leaderboards (the decision-benchmarks kit's { order, boards } shape)
 *   POST /api/result   { recording, initials?, enter? }: checks a finished game (the answers the server marked,
 *                      not the recording's); with enter, puts it on the board
 *                      under the initials. Answers with the server's own score, the place, the boards and a share
 *                      link (which shows the initials when given)
 *   GET  /api/share/<token>        a shared game, checked
 *   GET  /og/r/<token>.png         its link preview image
 *   POST /api/match                { name }: a live match (server/match.ts); answers { code, token }
 *   POST /api/match/<code>/join    { name } -> { token }
 *   GET  /api/match/<code>/state   ?token=&since=: the room once newer than version `since` (a long poll)
 *   GET  /api/match/<code>/info    whether the match exists (404 when it does not)
 *   POST /api/match/<code>/start | /answer | /rematch | /rounds | /ready | /leave   { token, ... }
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import type { Card } from '../cards/lib.ts';
import { ask, cardPng, DEFAULT_MODEL, findModel, JevError, MODELS, wireBody, type Env } from './jev.ts';
import { parseResult, taunt } from './taunts.ts';
import { dataDir, loadSecret, signer, type SignEnv } from './sign.ts';
import { Boards, checkGame, cleanInitials, dealtCards, GameError, Games, issueDeal, playable, readShare, shareToken, winner } from './scores.ts';
import { matchImage, shareImage } from './share-image.ts';
import { cleanName, Matches } from './match.ts';
import { isOffensive } from './names.ts';
import { cleanSetup, deal, formatScore, HOW_EXAMPLES, isRanked, jevAnswerMessage, RANKED, solutionOf } from '../shared/game.ts';

const MAX_BODY = 10_000;
/** Asks per second one visitor may make: a game asks at most a few. */
const RATE = 6;

/**
 * Answers one visitor may have marked: one a second, with room for a quick run. A person needs more than a second
 * a card; a script collecting the answers gets them slowly.
 */
const MARK_RATE = 1;
const MARK_BURST = 30;

/** Entries a visitor may put on the boards per hour, refused ones included. */
const ENTRIES_PER_HOUR = 20;

export function createApi(env: Env & SignEnv & { TRUST_PROXY?: string; PROXY_SECRET?: string; PUBLIC_ORIGIN?: string }, root = join(import.meta.dirname, '..'), publicDir = 'public') {
  const sign = signer(loadSecret(env, root));
  const boards = new Boards(dataDir(env, root));
  const games = new Games();
  const entries = new Map<string, number[]>();
  let matches: Matches | undefined;
  const buckets = new Map<string, { tokens: number; at: number }>();
  const markBuckets = new Map<string, { tokens: number; at: number }>();
  // The whole deck, answers included: not under public/, so it is never served as a file.
  const deckFile = join(root, 'cards/deck.json');
  let deck: { mtime: number; cards: Map<string, Card> } | undefined;

  /** The deck, read again when the file changes (cheap: one stat per ask). */
  const loadDeck = async (): Promise<Map<string, Card>> => {
    const mtime = (await stat(deckFile)).mtimeMs;
    if (!deck || deck.mtime !== mtime) {
      const cards: Card[] = JSON.parse(await readFile(deckFile, 'utf8')).cards;
      deck = { mtime, cards: new Map(cards.map((c) => [c.id, c])) };
    }
    return deck.cards;
  };

  const allow = (ip: string, pool = buckets, rate = RATE, burst = RATE * 2): boolean => {
    const now = Date.now();
    const b = pool.get(ip) ?? { tokens: burst, at: now };
    b.tokens = Math.min(burst, b.tokens + ((now - b.at) / 1000) * rate);
    b.at = now;
    pool.set(ip, b);
    if (pool.size > 10_000) for (const [k, v] of pool) if (now - v.at > (burst / rate) * 1000) pool.delete(k);
    if (b.tokens < 1) return false;
    b.tokens -= 1;
    return true;
  };

  /**
   * The visitor's address: the socket's, or from X-Forwarded-For behind a proxy. Behind the apps.sabater.io Worker
   * (PROXY_SECRET, checked in main.ts) the first entry is the one the Worker set, whatever hops were added after it;
   * behind TRUST_PROXY proxies it is the client end.
   */
  const visitor = (req: IncomingMessage): string => {
    const hops = Number(env.TRUST_PROXY ?? 0);
    const fwd = String(req.headers['x-forwarded-for'] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    if (env.PROXY_SECRET && fwd.length) return fwd[0];
    if (hops > 0 && fwd.length) return fwd[Math.max(0, fwd.length - hops)];
    return req.socket.remoteAddress ?? '?';
  };

  /**
   * Browsers send Origin on cross-site POSTs: refuse those, so other sites cannot spend this server's keys. The page's
   * own host is PUBLIC_ORIGIN's when set (behind the Worker: Railway rewrites the forwarded host to its own address),
   * else the host the request came to.
   */
  const publicHost = env.PUBLIC_ORIGIN && URL.canParse(env.PUBLIC_ORIGIN) ? new URL(env.PUBLIC_ORIGIN).host : '';
  const sameSite = (req: IncomingMessage): boolean => {
    const origin = req.headers.origin;
    if (!origin) return true;
    try {
      return new URL(origin).host === (publicHost || String(req.headers['x-forwarded-host'] ?? req.headers.host));
    } catch {
      return false;
    }
  };

  /** Names other players see: Jev refuses the ones it is sure are offensive (server/names.ts). */
  const refuseOffensive = async (name: string): Promise<void> => {
    if (await isOffensive(name, findModel(DEFAULT_MODEL)!, env)) throw new JevError(422, 'Jev flagged that name as offensive; pick another one');
  };

  const reachable = (m: (typeof MODELS)[number]): boolean => !!env.OPPER_API_KEY || (!!m.typesafeId && !!env.TYPESAFE_API_KEY);

  const handle = async function handle(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const url = new URL(req.url ?? '/', 'http://local');
    const og = url.pathname.match(/^\/og\/r\/([A-Za-z0-9_.-]{10,600})\.png$/);
    if (og) {
      const shared = readShare(sign, og[1]);
      if (!shared) {
        res.writeHead(404).end();
        return true;
      }
      res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400' });
      res.end(shareImage(og[1], shared));
      return true;
    }
    const invite = url.pathname.match(/^\/og\/m\/([A-Za-z0-9]{4})\.png$/);
    if (invite) {
      const m = matches?.summary(invite[1]);
      if (!m) {
        res.writeHead(404).end();
        return true;
      }
      res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=300' });
      res.end(matchImage(m));
      return true;
    }
    if (!url.pathname.startsWith('/api/')) return false;
    matches ??= new Matches(
      loadDeck,
      async (id) => {
        const card = (await loadDeck()).get(id)!;
        return ask(card, await cardPng(join(root, publicDir), card), findModel(DEFAULT_MODEL)!, env);
      },
      async (r) => (await taunt({ mode: 'versus', cards: 10, ...r }, findModel(DEFAULT_MODEL)!, env)).choice,
    );
    const send = (status: number, body: unknown) => {
      res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(body));
    };
    try {
      if (url.pathname === '/api/health' && req.method === 'GET') {
        // How many live matches a restart would end (rooms are in memory).
        send(200, { ok: true, liveMatches: matches.liveCount() });
        return true;
      }
      if (url.pathname === '/api/models' && req.method === 'GET') {
        send(200, { models: MODELS.map((m) => ({ id: m.id, name: m.name, box: m.box, available: reachable(m) })), default: DEFAULT_MODEL });
        return true;
      }
      const m = url.pathname.match(/^\/api\/match(?:\/([A-Za-z0-9]{4}))?(?:\/(join|state|info|start|answer|rematch|rounds|ready|leave))?$/);
      if (m) {
        const [, code, action] = m;
        if (action === 'info' && req.method === 'GET' && code) {
          // Whether a match exists, for /m/<code> links (an old invite, or a match lost to a restart).
          const room = matches.summary(code);
          send(room ? 200 : 404, room ? { code: room.code, host: room.host, players: room.players.length, phase: room.phase, rounds: room.rounds } : { error: 'no match with that code' });
          return true;
        }
        if (action === 'state' && req.method === 'GET' && code) {
          matches.poll(code, url.searchParams.get('token') ?? '', Number(url.searchParams.get('since') ?? -1), res);
          return true;
        }
        if (req.method !== 'POST') throw new JevError(405, 'method not allowed');
        if (!sameSite(req)) throw new JevError(403, 'cross-site requests are not served');
        if (!allow(visitor(req))) throw new JevError(429, 'too many requests: slow down');
        let body: Record<string, unknown>;
        try {
          body = JSON.parse(await readBody(req));
        } catch (e) {
          throw e instanceof JevError ? e : new JevError(400, 'body is not JSON');
        }
        const token = String(body.token ?? '');
        if (!code) {
          const name = cleanName(body.name);
          if (!name) throw new JevError(400, 'a name is 1 to 12 letters, digits or spaces');
          await refuseOffensive(name);
          send(200, matches.create(name));
        } else if (action === 'join') {
          const name = cleanName(body.name);
          if (!name) throw new JevError(400, 'a name is 1 to 12 letters, digits or spaces');
          await refuseOffensive(name);
          send(200, matches.join(code, name));
        } else if (action === 'start') {
          await matches.start(code, token);
          send(200, { ok: true });
        } else if (action === 'answer') {
          matches.answer(code, token, Number(body.index), { option: body.option as string | undefined, point: body.point as [number, number] | undefined });
          send(200, { ok: true });
        } else if (action === 'ready') {
          matches.setReady(code, token, body.ready === true);
          send(200, { ok: true });
        } else if (action === 'rounds') {
          matches.setRounds(code, token, Number(body.rounds));
          send(200, { ok: true });
        } else if (action === 'leave') {
          matches.leave(code, token);
          send(200, { ok: true });
        } else if (action === 'rematch') {
          matches.rematch(code, token);
          send(200, { ok: true });
        } else throw new JevError(404, 'not found');
        return true;
      }
      if (url.pathname === '/api/explain' && req.method === 'GET') {
        const card = (await loadDeck()).get(url.searchParams.get('card') ?? '');
        if (!card) throw new JevError(404, 'no such card');
        const body = wireBody(card, '', findModel(DEFAULT_MODEL)!.id) as { assets: Record<string, { data_base64: string }> };
        // The picture is the card's PNG; its bytes would only fill the page.
        for (const a of Object.values(body.assets)) a.data_base64 = `<the picture above: a ${card.width} x ${card.height} PNG>`;
        send(200, { request: body, solution: HOW_EXAMPLES.includes(card.id) ? solutionOf(card) : null });
        return true;
      }
      if (url.pathname === '/api/deal' && req.method === 'GET') {
        const q = url.searchParams;
        const setup = cleanSetup(q.get('mode'), q.get('cards'), q.get('limit'), q.get('box') ?? '1');
        if (!setup) throw new JevError(400, 'not a setup the game offers');
        const d = issueDeal(sign, setup);
        send(200, { deal: d.deal, ranked: isRanked(setup), cards: deal(playable(await loadDeck(), setup.box), setup.mode, d.seed, setup.cards) });
        return true;
      }
      if (url.pathname === '/api/mark' && req.method === 'POST') {
        if (!sameSite(req)) throw new JevError(403, 'cross-site requests are not served');
        if (!allow(visitor(req), markBuckets, MARK_RATE, MARK_BURST)) throw new JevError(429, 'too many answers: slow down');
        let body: Record<string, unknown>;
        try {
          body = JSON.parse(await readBody(req));
        } catch (e) {
          throw e instanceof JevError ? e : new JevError(400, 'body is not JSON');
        }
        try {
          send(200, games.mark(sign, await loadDeck(), body.deal, Number(body.index), body));
        } catch (e) {
          if (e instanceof GameError) throw new JevError(409, e.message);
          throw e;
        }
        return true;
      }
      if (url.pathname === '/api/highscores' && req.method === 'GET') {
        send(200, boards.view());
        return true;
      }
      const shareMatch = url.pathname.match(/^\/api\/share\/([A-Za-z0-9_.-]{10,600})$/);
      if (shareMatch && req.method === 'GET') {
        const shared = readShare(sign, shareMatch[1]);
        if (!shared) throw new JevError(404, 'this link is not valid');
        send(200, { result: shared, ...boards.view() });
        return true;
      }
      if (url.pathname === '/api/result' && req.method === 'POST') {
        if (!sameSite(req)) throw new JevError(403, 'cross-site requests are not served');
        const ip = visitor(req);
        if (!allow(ip)) throw new JevError(429, 'too many requests: slow down');
        let body: { recording?: unknown; initials?: unknown; enter?: unknown };
        try {
          body = JSON.parse(await readBody(req, 200_000));
        } catch (e) {
          throw e instanceof JevError ? e : new JevError(400, 'body is not JSON');
        }
        // What counts is what the server marked as the game went, whatever the recording says.
        const rec = body.recording as { deal?: unknown; answers?: unknown } | null;
        const held = rec && typeof rec === 'object' ? games.answers(rec.deal) : null;
        if (!held) throw new JevError(422, 'That game did not check out: the server has no answers for it (it may have restarted)');
        let game;
        try {
          game = checkGame(sign, { ...rec, answers: held }, await loadDeck());
        } catch (e) {
          if (e instanceof GameError) throw new JevError(422, `That game did not check out: ${e.message}`);
          throw e;
        }
        let place: number | null = null;
        let initials = '';
        if (body.initials !== undefined && body.initials !== '') {
          const clean = cleanInitials(body.initials);
          if (!clean) throw new JevError(400, 'initials are three letters, A to Z');
          initials = clean;
        }
        if (body.enter === true) {
          if (!initials) throw new JevError(400, 'initials are three letters, A to Z');
          await refuseOffensive(initials);
          const clean = initials;
          const now = Date.now();
          const recent = (entries.get(ip) ?? []).filter((t) => now - t < 3_600_000);
          recent.push(now);
          entries.set(ip, recent);
          if (entries.size > 50_000) entries.delete(entries.keys().next().value!);
          if (recent.length > ENTRIES_PER_HOUR) throw new JevError(429, 'too many entries this hour');
          try {
            place = boards.add(game, clean, sign.hash(ip, clean));
          } catch (e) {
            if (e instanceof GameError) throw new JevError(409, e.message);
            throw e;
          }
        }
        const share = shareToken(sign, { mode: game.mode, limitMs: game.mode === 'versus' ? game.setup.limitMs : 0, score: game.score, right: game.right, cards: game.cards, initials, jev: game.jev, taunt: game.taunt, at: Date.now() });
        send(200, { mode: game.mode, ranked: game.ranked, score: game.score, right: game.right, cards: game.cards, jev: game.jev, place, wouldPlace: game.ranked ? boards.placeFor(game.mode, game.score) : null, share: `/r/${share}`, ...boards.view() });
        return true;
      }
      if ((url.pathname === '/api/ask' || url.pathname === '/api/taunt') && req.method === 'POST') {
        if (!sameSite(req)) throw new JevError(403, 'cross-site requests are not served');
        if (!allow(visitor(req))) throw new JevError(429, 'too many questions: slow down');
        let body: Record<string, unknown>;
        try {
          body = JSON.parse(await readBody(req));
        } catch (e) {
          throw e instanceof JevError ? e : new JevError(400, 'body is not JSON');
        }
        if (url.pathname === '/api/taunt') {
          const m = findModel(body.model ?? DEFAULT_MODEL);
          if (!m) throw new JevError(400, 'unknown model');
          send(200, await taunt(parseResult(body), m, env));
          return true;
        }
        const model = findModel(body.model ?? DEFAULT_MODEL);
        if (!model) throw new JevError(400, 'unknown model');
        const deck = await loadDeck();
        const card = typeof body.card === 'string' ? deck.get(body.card) : undefined;
        if (!card) throw new JevError(404, 'no such card');
        if (!HOW_EXAMPLES.includes(card.id)) {
          let ids: string[];
          try {
            ids = dealtCards(sign, deck, body.deal).ids;
          } catch (e) {
            throw e instanceof GameError ? new JevError(409, e.message) : e;
          }
          if (!ids.includes(card.id)) throw new JevError(409, 'that card is not in this game');
        }
        const a = await ask(card, await cardPng(join(root, publicDir), card), model, env);
        // Signed, so a share link can show Jev's side without trusting the page.
        const signed = { card: card.id, correct: a.correct, latencyMs: a.latencyMs, model: model.id };
        send(200, { ...a, signed: { ...signed, sig: sign.sign('answer', jevAnswerMessage(signed)) } });
        return true;
      }
      send(404, { error: 'not found' });
    } catch (e) {
      const status = e instanceof JevError ? e.status : 500;
      if (status === 500) console.error(e);
      send(status, { error: e instanceof Error ? e.message : String(e) });
    }
    return true;
  };

  /**
   * The link preview for a page path: a share link (/r/<token>) or a live match invite (/m/<code>). Null when the
   * path is neither, or the link is not valid (the page then keeps its usual preview).
   */
  const preview = (path: string): { title: string; description: string; image: string } | null => {
    const m = path.match(/^\/m\/([A-Za-z0-9]{4})$/);
    if (m) {
      const room = matches?.summary(m[1]);
      if (!room) return null;
      const others = room.players.length - 1;
      return {
        title: `Join ${room.host}'s Jev Cards match: ${room.code}`,
        description: `${others > 0 ? `${room.host} and ${others} more are` : `${room.host} is`} in. Everyone gets the same ${room.rounds} cards at the same moment, and Jev plays too. Tap to join.`,
        image: `/og/m/${room.code}.png`,
      };
    }
    const token = path.match(/^\/r\/([A-Za-z0-9_.-]{10,600})$/)?.[1];
    const r = token ? readShare(sign, token) : null;
    if (!r) return null;
    const who = r.initials || 'Someone';
    const w = winner(r);
    const label = RANKED[r.mode].label;
    const you = formatScore(r.mode, r.score);
    const title = w === 'person' ? `${who} beat Jev at Jev Cards: ${you}` : w === 'jev' ? `Jev beat ${who} at Jev Cards` : w === 'draw' ? `${who} drew with Jev at Jev Cards` : `${who} played Jev Cards: ${you}`;
    const jev = r.jev ? ` against Jev's ${formatScore(r.mode, r.jev.score)}` : '';
    return { title, description: `${label}: ${you}${jev}. Can you do better? Play it yourself.`, image: `/og/r/${token}.png` };
  };

  return Object.assign(handle, { preview });
}

function readBody(req: IncomingMessage, max = MAX_BODY): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > max) {
        reject(new JevError(413, 'request too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}
