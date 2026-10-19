/**
 * The link preview for a shared game (1200 x 630 PNG): the two podiums, the scores, who won, and Jev's last
 * word, in the game's own look. Drawn as SVG and rendered with resvg using the fonts in assets/fonts (OFL).
 */
import { join } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import { formatScore, RANKED } from '../shared/game.ts';
import { winner, type ShareResult } from './scores.ts';
import { TAUNTS } from './taunt-lines.ts';

const FONTS = ['Bungee-Regular.ttf', 'BarlowCondensed-ExtraBold.ttf', 'BarlowCondensed-SemiBold.ttf'].map((f) => join(import.meta.dirname, '..', 'assets', 'fonts', f));
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const cache = new Map<string, Buffer>();

export function shareImage(token: string, r: ShareResult, jevName = 'Jev 1.14'): Buffer {
  const hit = cache.get(token);
  if (hit) return hit;
  const png = new Resvg(svg(r, jevName), { font: { fontFiles: FONTS, loadSystemFonts: false, defaultFontFamily: 'Barlow Condensed' } }).render().asPng();
  if (cache.size > 300) cache.delete(cache.keys().next().value!);
  cache.set(token, png);
  return png;
}

function svg(r: ShareResult, jevName: string): string {
  const who = r.initials || 'A PLAYER';
  const w = winner(r);
  const headline = w === 'person' ? `${who} BEAT JEV!` : w === 'jev' ? 'JEV WINS THIS ONE' : w === 'draw' ? 'A DRAW!' : `${who} PLAYED JEV`;
  const mode = RANKED[r.mode].label.toUpperCase();
  const detail = r.mode === 'streak' ? 'CARDS UNTIL THE FIRST MISS' : `${r.cards} CARDS · ${r.right} RIGHT${r.mode === 'versus' && r.limitMs && r.limitMs !== 10_000 ? ` · ${r.limitMs / 1000} S EACH` : ''}`;
  const taunt = TAUNTS.find((t) => t.id === r.taunt)?.text;
  const you = formatScore(r.mode, r.score).toUpperCase();
  const jev = r.jev ? formatScore(r.mode, r.jev.score).toUpperCase() : '?';
  const bulbs = Array.from({ length: 30 }, (_, i) => `<circle cx="${70 + i * 18}" cy="44" r="3.4" fill="#fff6c2"/><circle cx="${70 + i * 18}" cy="128" r="3.4" fill="#fff6c2"/>`).join('');
  const podium = (x: number, label: string, value: string, color: string, won: boolean) => `
    <g transform="translate(${x} 250)">
      <rect x="0" y="0" width="300" height="190" rx="22" fill="#0d1452" stroke="${won ? '#ffd23a' : '#2a3a9a'}" stroke-width="${won ? 6 : 3}"/>
      <rect x="20" y="-22" width="${Math.max(90, label.length * 19 + 34)}" height="44" rx="10" fill="${color}"/>
      <text x="${20 + Math.max(90, label.length * 19 + 34) / 2}" y="9" text-anchor="middle" font-family="Barlow Condensed" font-weight="800" font-size="26" letter-spacing="3" fill="#070a2c">${esc(label)}</text>
      <rect x="24" y="52" width="252" height="100" rx="14" fill="#05071c"/>
      <text x="150" y="${value.length > 9 ? 118 : 124}" text-anchor="middle" font-family="Bungee" font-size="${value.length > 9 ? 36 : 46}" fill="${color}">${esc(value)}</text>
    </g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <radialGradient id="stage" cx="50%" cy="25%" r="80%"><stop offset="0" stop-color="#2a3fd6"/><stop offset="0.5" stop-color="#121a6b"/><stop offset="1" stop-color="#070a2c"/></radialGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#stage)"/>
  <polygon points="150,-20 260,-20 520,630 320,630" fill="#ffffff" opacity="0.05"/>
  <polygon points="940,-20 1050,-20 880,630 680,630" fill="#ffffff" opacity="0.05"/>
  <g>
    <rect x="52" y="34" width="560" height="104" rx="18" fill="#0d1452" stroke="#ffd23a" stroke-width="7"/>
    ${bulbs}
    <text x="332" y="112" text-anchor="middle" font-family="Bungee" font-size="62" fill="#b3420f">JEV CARDS</text>
    <text x="332" y="106" text-anchor="middle" font-family="Bungee" font-size="62" fill="#ffd23a">JEV CARDS</text>
  </g>
  <text x="1148" y="80" text-anchor="end" font-family="Barlow Condensed" font-weight="800" font-size="30" letter-spacing="4" fill="#c9d1ff">${mode}</text>
  <text x="1148" y="116" text-anchor="end" font-family="Barlow Condensed" font-weight="600" font-size="24" letter-spacing="2" fill="#c9d1ff">${esc(detail)}</text>
  <text x="600" y="214" text-anchor="middle" font-family="Bungee" font-size="54" fill="#b3420f">${esc(headline)}</text>
  <text x="600" y="208" text-anchor="middle" font-family="Bungee" font-size="54" fill="#ffd23a">${esc(headline)}</text>
  ${podium(160, who, you, '#ff5b3a', w === 'person')}
  <text x="600" y="368" text-anchor="middle" font-family="Bungee" font-size="44" fill="#ffd23a">VS</text>
  ${podium(740, jevName.toUpperCase(), jev, '#3affc4', w === 'jev')}
  <rect x="160" y="478" width="300" height="62" rx="16" fill="#ffd23a"/>
  <text x="310" y="520" text-anchor="middle" font-family="Bungee" font-size="25" fill="#070a2c">PLAY IT YOURSELF</text>
  ${
    taunt
      ? `<rect x="490" y="478" width="550" height="62" rx="16" fill="#3affc4"/>
  <polygon points="868,480 890,450 912,480" fill="#3affc4"/>
  <text x="765" y="519" text-anchor="middle" font-family="Barlow Condensed" font-weight="800" font-size="${taunt.length > 34 ? 25 : 29}" fill="#070a2c">“${esc(taunt)}”</text>`
      : ''
  }
  <text x="600" y="600" text-anchor="middle" font-family="Barlow Condensed" font-weight="600" font-size="24" letter-spacing="2" fill="#c9d1ff">A VISUAL QUIZ: PEOPLE AGAINST A DECISION MODEL THAT ANSWERS IN 0.3 S</text>
</svg>`;
}

/** The link preview for a live match invite: the code, who hosts, who is in. Rendered fresh (rooms change). */
export function matchImage(m: { code: string; host: string; players: string[]; rounds: number }): Buffer {
  const others = m.players.length - 1;
  const who = `HOSTED BY ${m.host.toUpperCase()}${others > 0 ? ` · ${others} MORE ${others === 1 ? 'PLAYER' : 'PLAYERS'}` : ''} · JEV PLAYS TOO`;
  const bulbs = Array.from({ length: 30 }, (_, i) => `<circle cx="${70 + i * 18}" cy="44" r="3.4" fill="#fff6c2"/><circle cx="${70 + i * 18}" cy="128" r="3.4" fill="#fff6c2"/>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs><radialGradient id="stage" cx="50%" cy="25%" r="80%"><stop offset="0" stop-color="#2a3fd6"/><stop offset="0.5" stop-color="#121a6b"/><stop offset="1" stop-color="#070a2c"/></radialGradient></defs>
  <rect width="1200" height="630" fill="url(#stage)"/>
  <polygon points="150,-20 260,-20 520,630 320,630" fill="#ffffff" opacity="0.05"/>
  <polygon points="940,-20 1050,-20 880,630 680,630" fill="#ffffff" opacity="0.05"/>
  <rect x="52" y="34" width="560" height="104" rx="18" fill="#0d1452" stroke="#ffd23a" stroke-width="7"/>
  ${bulbs}
  <text x="332" y="112" text-anchor="middle" font-family="Bungee" font-size="62" fill="#b3420f">JEV CARDS</text>
  <text x="332" y="106" text-anchor="middle" font-family="Bungee" font-size="62" fill="#ffd23a">JEV CARDS</text>
  <text x="1148" y="80" text-anchor="end" font-family="Barlow Condensed" font-weight="800" font-size="30" letter-spacing="4" fill="#3affc4">LIVE MATCH</text>
  <text x="1148" y="116" text-anchor="end" font-family="Barlow Condensed" font-weight="600" font-size="24" letter-spacing="2" fill="#c9d1ff">${m.rounds} CARDS · 10 SECONDS EACH</text>
  <text x="600" y="228" text-anchor="middle" font-family="Bungee" font-size="58" fill="#b3420f">YOU'RE INVITED!</text>
  <text x="600" y="222" text-anchor="middle" font-family="Bungee" font-size="58" fill="#ffd23a">YOU'RE INVITED!</text>
  <rect x="380" y="262" width="440" height="150" rx="22" fill="#05071c" stroke="#3affc4" stroke-width="6"/>
  <text x="600" y="372" text-anchor="middle" font-family="Bungee" font-size="104" letter-spacing="14" fill="#3affc4">${esc(m.code)}</text>
  <text x="600" y="462" text-anchor="middle" font-family="Barlow Condensed" font-weight="800" font-size="30" letter-spacing="3" fill="#ffffff">${esc(who)}</text>
  <rect x="440" y="500" width="320" height="62" rx="16" fill="#ffd23a"/>
  <text x="600" y="542" text-anchor="middle" font-family="Bungee" font-size="26" fill="#070a2c">TAP TO JOIN</text>
  <text x="600" y="604" text-anchor="middle" font-family="Barlow Condensed" font-weight="600" font-size="22" letter-spacing="2" fill="#c9d1ff">EVERYONE GETS THE SAME CARDS AT THE SAME MOMENT. CAN YOU BEAT JEV?</text>
</svg>`;
  return new Resvg(svg, { font: { fontFiles: FONTS, loadSystemFonts: false, defaultFontFamily: 'Barlow Condensed' } }).render().asPng();
}
