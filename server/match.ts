/**
 * Live matches: people join one room by its code and play the same cards at the same moment, with Jev as one of
 * the contestants. The server runs the clock: it deals the cards, says when each one starts, times every answer
 * itself (so a slow phone or a clever page gains nothing), asks Jev once per card, and scores like Versus.
 *
 *   lobby    the host creates the room; others join with their names; Jev is always in
 *   playing  card after card: shown at `startsAt`, open for `limitMs`, then revealed with the round's podium
 *   final    the standings are the match's own leaderboard; Jev gets the last word; the host can rematch
 *
 * Rooms live in memory (fine for one server; a shared store would be needed behind several). The page follows a
 * room by long polling: it asks for the room newer than the version it has, and the server holds the request
 * until the room changes (or 20 s pass). Plain requests, so tunnels and proxies that hold back streams cannot
 * stall a match.
 */
import { randomBytes } from 'node:crypto';
import type { ServerResponse } from 'node:http';
import type { Card } from '../cards/lib.ts';
import { deal, isRight, solutionOf, versusPoints, type RecordedAnswer, type Solution } from '../shared/game.ts';
import { JevError } from './jev.ts';

/** The match lengths a host can pick. */
export const ROUND_CHOICES = [5, 10, 15, 20];
export const MATCH_CARDS = 10;
export const LIMIT_MS = 10_000;
/** Time from Start to the first card: the 3-2-1 on every screen. */
const FIRST_CARD_MS = 4_500;
/** Time the reveal stays up before the next card. */
const REVEAL_MS = 5_000;
const MAX_PLAYERS = 12;
const MAX_ROOMS = 300;
/** A room with nobody watching for this long is closed. */
const IDLE_MS = 30 * 60 * 1000;
/** No one reads a card and answers in under 150 ms. */
const MIN_MS = 150;
/** How long a poll waits for a change. */
const POLL_MS = 20_000;
/** A player who has not asked for the room in this long has left (a poll comes at least every POLL_MS). */
const GONE_MS = POLL_MS + 8_000;
/** How long a host may be away before the room passes to someone else. */
const HOST_AWAY_MS = 3 * 60_000;

interface Player {
  id: string;
  token: string;
  name: string;
  score: number;
  /** Said they are ready, in the lobby (the host starts, so the host has no ready). */
  ready: boolean;
  /** A poll waiting for the room to change. */
  waiting: { res: ServerResponse; timer: NodeJS.Timeout } | null;
  seen: number;
  joinedAt: number;
}

interface RoundAnswer {
  option?: string;
  point?: [number, number];
  right: boolean;
  ms: number;
  points: number;
}

interface Round {
  index: number;
  card: string;
  startsAt: number;
  revealed: boolean;
  answers: Map<string, RoundAnswer>;
  /** The card's answer and why, shown to everyone at the reveal (the page's deck has no answers). */
  solution?: Solution;
  jev?: { right: boolean; ms: number; points: number; choice?: string; box?: { top: number; bottom: number; left: number; right: number } } | null;
}

export interface JevAsk {
  (cardId: string): Promise<{ correct: boolean; latencyMs: number; choice?: string; box?: { top: number; bottom: number; left: number; right: number } }>;
}
export interface JevTaunt {
  (r: { winner: 'jev' | 'person' | 'draw'; person: number; jev: number; personRight: number; jevRight: number }): Promise<string | null>;
}

interface Room {
  code: string;
  host: string;
  phase: 'lobby' | 'playing' | 'final';
  players: Map<string, Player>;
  jevScore: number;
  jevRight: number;
  cards: string[];
  round: Round | null;
  rounds: number;
  taunt: string | null;
  timer?: NodeJS.Timeout;
  touched: number;
  matchNo: number;
  version: number;
}

/** A player's name: 1 to 12 letters (any alphabet), digits, spaces and . _ ' -; null when it is not one. */
export function cleanName(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const name = v.normalize('NFC').trim().replace(/\s+/g, ' ');
  return name.length >= 1 && [...name].length <= 12 && /^[\p{L}\p{N}][\p{L}\p{N} ._'-]*$/u.test(name) ? name : null;
}

const CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newCode = () => Array.from(randomBytes(4), (b) => CODE_LETTERS[b % CODE_LETTERS.length]).join('');
const newToken = () => randomBytes(16).toString('base64url');
const newId = () => randomBytes(4).toString('hex');

export class Matches {
  private rooms = new Map<string, Room>();
  private deck: () => Promise<Map<string, Card>>;
  private askJev: JevAsk;
  private taunt: JevTaunt;

  constructor(deck: () => Promise<Map<string, Card>>, askJev: JevAsk, taunt: JevTaunt) {
    this.deck = deck;
    this.askJev = askJev;
    this.taunt = taunt;
    setInterval(() => this.sweep(), 60_000).unref();
  }

  create(name: string): { code: string; token: string } {
    if (this.rooms.size >= MAX_ROOMS) this.sweep();
    if (this.rooms.size >= MAX_ROOMS) throw new JevError(503, 'too many matches right now, try again soon');
    let code = newCode();
    while (this.rooms.has(code)) code = newCode();
    const room: Room = { code, host: '', phase: 'lobby', players: new Map(), jevScore: 0, jevRight: 0, cards: [], round: null, rounds: MATCH_CARDS, taunt: null, touched: Date.now(), matchNo: 0, version: 0 };
    this.rooms.set(code, room);
    const p = this.addPlayer(room, name);
    room.host = p.id;
    return { code, token: p.token };
  }

  join(code: string, name: string): { token: string } {
    const room = this.room(code);
    if (room.phase !== 'lobby') throw new JevError(409, 'this match has started; wait for the next one');
    if (room.players.size >= MAX_PLAYERS) throw new JevError(409, 'this match is full');
    return { token: this.addPlayer(room, name).token };
  }

  /**
   * The room as this player sees it, once it is newer than `since`: at once when it already is, else when it
   * next changes, or after POLL_MS with no change.
   */
  poll(code: string, token: string, since: number, res: ServerResponse): void {
    const room = this.room(code);
    const p = this.player(room, token);
    const wasAway = !this.here(p);
    p.seen = Date.now();
    room.touched = p.seen;
    if (p.waiting) this.answerPoll(room, p);
    if (since !== room.version || wasAway) {
      // Coming back changes who is here: everyone hears of it.
      if (wasAway) this.broadcast(room);
      if (!res.headersSent) this.send(res, room, p);
      return;
    }
    const timer = setTimeout(() => this.answerPoll(room, p), POLL_MS);
    p.waiting = { res, timer };
    res.on('close', () => {
      if (p.waiting?.res === res) {
        clearTimeout(timer);
        p.waiting = null;
      }
    });
  }

  async start(code: string, token: string): Promise<void> {
    const room = this.room(code);
    const p = this.player(room, token);
    if (p.id !== room.host) throw new JevError(403, 'only the host starts the match');
    if (room.phase === 'playing') return;
    const deck = await this.deck();
    room.cards = deal([...deck.values()], 'versus', Math.floor(Math.random() * 2 ** 31), room.rounds);
    room.phase = 'playing';
    room.jevScore = 0;
    room.jevRight = 0;
    room.taunt = null;
    room.matchNo++;
    for (const pl of room.players.values()) {
      pl.score = 0;
      pl.ready = false;
    }
    this.openRound(room, 0, Date.now() + FIRST_CARD_MS);
  }

  answer(code: string, token: string, index: number, a: Pick<RecordedAnswer, 'option' | 'point'>): void {
    const room = this.room(code);
    const p = this.player(room, token);
    const r = room.round;
    if (room.phase !== 'playing' || !r || r.index !== index || r.revealed) throw new JevError(409, 'this card is closed');
    if (r.answers.has(p.id)) throw new JevError(409, 'you already answered');
    const ms = Date.now() - r.startsAt;
    if (ms < MIN_MS) throw new JevError(409, 'too early');
    if (ms > LIMIT_MS + 500) throw new JevError(409, 'too late');
    void this.deck().then((deck) => {
      const card = deck.get(r.card)!;
      const point = Array.isArray(a.point) && a.point.length === 2 && a.point.every((v) => typeof v === 'number' && v >= 0 && v <= 1) ? (a.point as [number, number]) : undefined;
      const option = typeof a.option === 'string' ? a.option.slice(0, 40) : undefined;
      const right = isRight(card, { card: r.card, option, point, ms });
      const points = versusPoints(right, Math.min(ms, LIMIT_MS), LIMIT_MS);
      r.answers.set(p.id, { option, point, right, ms, points });
      p.score += points;
      room.touched = Date.now();
      if (!this.revealIfDone(room)) this.broadcast(room);
    });
  }

  /** A player in the lobby says they are ready, or not. */
  setReady(code: string, token: string, ready: boolean): void {
    const room = this.room(code);
    const p = this.player(room, token);
    if (room.phase !== 'lobby') throw new JevError(409, 'the match has started');
    p.ready = ready;
    this.broadcast(room);
  }

  /** Host only, in the lobby: how many cards the match will have. */
  setRounds(code: string, token: string, rounds: number): void {
    const room = this.room(code);
    if (this.player(room, token).id !== room.host) throw new JevError(403, 'only the host picks the rounds');
    if (room.phase !== 'lobby') throw new JevError(409, 'the match has started');
    if (!ROUND_CHOICES.includes(rounds)) throw new JevError(400, `rounds are one of ${ROUND_CHOICES.join(', ')}`);
    room.rounds = rounds;
    this.broadcast(room);
  }

  /** A player leaves for good: out of the room, and the room ends when nobody is left. */
  leave(code: string, token: string): void {
    const room = this.room(code);
    const p = this.player(room, token);
    if (p.waiting) {
      clearTimeout(p.waiting.timer);
      p.waiting = null;
    }
    room.players.delete(p.id);
    if (room.players.size === 0) {
      clearTimeout(room.timer);
      this.rooms.delete(room.code);
      return;
    }
    // The card may have been waiting only for them.
    if (room.phase !== 'playing' || !this.revealIfDone(room)) this.broadcast(room);
  }

  /** Host only: back to the lobby with the same players, for a rematch, or to end a match early. */
  rematch(code: string, token: string): void {
    const room = this.room(code);
    if (this.player(room, token).id !== room.host) throw new JevError(403, 'only the host starts a rematch');
    clearTimeout(room.timer);
    room.phase = 'lobby';
    room.round = null;
    this.broadcast(room);
  }

  // ------------------------------------------------------------------------------------------------ rounds

  private openRound(room: Room, index: number, startsAt: number): void {
    const round: Round = { index, card: room.cards[index], startsAt, revealed: false, answers: new Map() };
    room.round = round;
    void this.deck().then((deck) => (round.solution = solutionOf(deck.get(round.card)!)));
    this.broadcast(room);
    // Jev is asked as the card appears, like everyone else sees it.
    clearTimeout(room.timer);
    room.timer = setTimeout(() => {
      if (room.round !== round) return;
      const asked = Date.now();
      this.askJev(round.card).then(
        (a) => {
          const ms = Math.max(a.latencyMs, Date.now() - asked);
          const right = a.correct && ms <= LIMIT_MS;
          round.jev = { right, ms, points: versusPoints(right, ms, LIMIT_MS), choice: a.choice, box: a.box };
          if (round.revealed) return;
          room.jevScore += round.jev.points;
          if (right) room.jevRight++;
          if (!this.revealIfDone(room)) this.broadcast(room);
        },
        () => {
          round.jev = null;
          this.revealIfDone(room);
        },
      );
      room.timer = setTimeout(() => this.reveal(room), LIMIT_MS + 300);
    }, Math.max(0, startsAt - Date.now()));
  }

  /** Reveals the card once every player here and Jev have answered (or Jev failed). */
  private revealIfDone(room: Room): boolean {
    const r = room.round;
    if (!r || r.revealed || r.jev === undefined || r.answers.size < this.connected(room).length) return false;
    this.reveal(room);
    return true;
  }

  private reveal(room: Room): void {
    const r = room.round;
    if (!r || r.revealed) return;
    r.revealed = true;
    clearTimeout(room.timer);
    this.broadcast(room);
    room.timer = setTimeout(() => {
      if (r.index + 1 < room.cards.length) this.openRound(room, r.index + 1, Date.now() + 600);
      else void this.finish(room);
    }, REVEAL_MS);
  }

  private async finish(room: Room): Promise<void> {
    room.phase = 'final';
    room.round = null;
    this.broadcast(room);
    const players = [...room.players.values()];
    const best = players.reduce((m, p) => Math.max(m, p.score), 0);
    const winner = room.jevScore > best ? 'jev' : room.jevScore === best ? 'draw' : 'person';
    const match = room.matchNo;
    const line = await this.taunt({ winner, person: best, jev: room.jevScore, personRight: 0, jevRight: room.jevRight }).catch(() => null);
    if (room.matchNo !== match || room.phase !== 'final') return;
    room.taunt = line;
    this.broadcast(room);
  }

  // ------------------------------------------------------------------------------------------------ views

  /** Asked for the room lately: still in the match. */
  private here(p: Player | undefined): boolean {
    return !!p && (!!p.waiting || Date.now() - p.seen < GONE_MS);
  }

  private connected(room: Room): Player[] {
    return [...room.players.values()].filter((p) => this.here(p));
  }

  /** Rooms where someone is still around: a restart would end them. */
  liveCount(): number {
    return [...this.rooms.values()].filter((r) => this.connected(r).length > 0).length;
  }

  /** What an invite link may show about a room: its code, host and players. Null when there is no such room. */
  summary(code: string): { code: string; host: string; players: string[]; phase: Room['phase']; rounds: number } | null {
    const room = this.rooms.get(String(code).toUpperCase());
    if (!room) return null;
    return { code: room.code, host: room.players.get(room.host)?.name ?? '', players: [...room.players.values()].map((p) => p.name), phase: room.phase, rounds: room.rounds };
  }

  /** The room as player `me` may see it: other people's answers only after the reveal. */
  view(room: Room, me: Player): unknown {
    const r = room.round;
    const players = [...room.players.values()].map((p) => ({
      id: p.id,
      name: p.name,
      score: p.score,
      ready: p.ready,
      online: this.here(p),
      answered: !!r?.answers.has(p.id),
    }));
    return {
      code: room.code,
      phase: room.phase,
      me: me.id,
      host: room.host,
      players,
      jev: { score: room.jevScore, right: room.jevRight },
      rounds: room.rounds,
      round: r && {
        index: r.index,
        of: room.cards.length,
        card: r.card,
        startsAt: r.startsAt,
        limitMs: LIMIT_MS,
        revealed: r.revealed,
        jevAnswered: r.jev !== undefined && r.jev !== null,
        mine: r.answers.get(me.id) ?? null,
        answers: r.revealed ? Object.fromEntries([...r.answers].map(([id, a]) => [id, a])) : null,
        jevAnswer: r.revealed ? (r.jev ?? null) : null,
        solution: r.revealed ? (r.solution ?? null) : null,
      },
      taunt: room.taunt,
      serverNow: Date.now(),
      version: room.version,
    };
  }

  private broadcast(room: Room): void {
    room.version++;
    // A host who left, or has been away for minutes, hands the room to the longest-waiting player still here. Not
    // sooner: a phone stops asking while its owner shares the invite in another app.
    const host = room.players.get(room.host);
    if (!host || (!this.here(host) && Date.now() - host.seen > HOST_AWAY_MS)) {
      const next = [...room.players.values()].filter((p) => this.here(p)).sort((a, b) => a.joinedAt - b.joinedAt)[0];
      if (next) room.host = next.id;
    }
    for (const p of room.players.values()) if (p.waiting) this.answerPoll(room, p);
  }

  private answerPoll(room: Room, p: Player): void {
    const w = p.waiting;
    if (!w) return;
    clearTimeout(w.timer);
    p.waiting = null;
    if (!w.res.writableEnded) this.send(w.res, room, p);
  }

  private send(res: ServerResponse, room: Room, p: Player): void {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(this.view(room, p)));
  }

  // ------------------------------------------------------------------------------------------------ helpers

  private addPlayer(room: Room, name: string): Player {
    const key = name.toLowerCase();
    if (key === 'jev' || [...room.players.values()].some((p) => p.name.toLowerCase() === key)) throw new JevError(409, `${name} is taken in this match; pick another name`);
    const p: Player = { id: newId(), token: newToken(), name, score: 0, ready: false, waiting: null, seen: Date.now(), joinedAt: Date.now() };
    room.players.set(p.id, p);
    room.touched = Date.now();
    this.broadcast(room);
    return p;
  }

  private room(code: string): Room {
    const room = this.rooms.get(String(code).toUpperCase());
    if (!room) throw new JevError(404, 'no match with that code');
    return room;
  }

  private player(room: Room, token: string): Player {
    const p = [...room.players.values()].find((x) => x.token === token);
    if (!p) throw new JevError(403, 'you are not in this match');
    return p;
  }

  private sweep(): void {
    const now = Date.now();
    for (const [code, room] of this.rooms) {
      if (this.connected(room).length === 0 && now - room.touched > IDLE_MS) {
        clearTimeout(room.timer);
        this.rooms.delete(code);
      }
    }
  }
}
