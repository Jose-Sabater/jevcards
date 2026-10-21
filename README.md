# Jev Cards

> **Jev Cards v2 continues at Opper:** play it at
> [opper.ai/decision-benchmarks/jevcards](https://opper.ai/decision-benchmarks/jevcards/). jevcards.com now goes
> there. This repository stays the original, open-source version that launched on
> [Show HN](https://news.ycombinator.com/item?id=50167617) on 20 October 2026, and it still runs as it is: see below.

A visual quiz game: you against Jev, TypeSafe's vision decision model, on the same picture cards. Tap the peach
among the fruit, point at Egypt on a map, find the chess move that mates, say what color the ink is. Jev looks at
the same picture and answers in about a quarter of a second.

Jev never writes text: each card is one typed question (a `choice` with a probability per option, or a `box`
for "tap the place" cards), asked with the card's picture through the System One API.

## Modes

| Mode | How it plays | Score |
|---|---|---|
| **Sprint** | N cards (5, 10, 20 or all) against the clock | Time spent answering plus 5 s per miss; lower is better. Jev's time on the same cards is its answer times plus the same penalty. |
| **Versus Jev** | 10 rounds, live: Jev is asked the moment the card is dealt, you get the seconds you picked (3, 5, 10 or 15) | 100 for a right answer in time, plus up to 50 for speed. |
| **Streak** | Cards until your first miss, 10 s each | Your run against Jev's run on the same cards in the same order. |
| **Live match** | Share a link; up to 12 people and Jev get the same cards at the same moment, 10 s each. The host picks 5, 10, 15 or 20 rounds and starts when the guests are ready | Like Versus, with a podium after every card and a leaderboard for the match. |

The page never has the answers: its deck (`public/cards/deck.json`) leaves them out, and the server marks each answer
as it is given (`POST /api/mark`), sending back right or wrong and the card's solution. Games on the standard settings
go on a top-10 leaderboard per mode. The server checks each one before it counts, from the answers it marked: the
cards were dealt by the server (signed), the times are possible, and Jev's answers are the ones it signed. Every
game has a share link with a preview image (`/r/...`), and so does every live match invite (`/m/<code>`).

## Cards

Each card is a picture plus one question, written in `cards/*.ts` as an SVG of 960 x 720, so the picture and its
answer come from the same source. Three kinds:

- **pick**: tap one thing in the picture. Jev gets a `choice` whose options say where each thing is ("the
  object on the left"), never what it is.
- **buttons**: pick a button under the picture. Jev gets the same options.
- **point**: tap a place. Jev answers a `box`; it counts when the box's center is inside the target.

Games deal the themes in turn (`deal()` in `shared/game.ts`), so a 10-card game has 10 themes, whatever their
sizes. On the first 200 cards, Jev 1.14 answers 160 right at a median of 261 ms (2026-10-16), and 28 of the next 40:
nearly every photo card, fewer of the reasoning and "know the convention" ones.

Newer cards come in seasons (`cards/season<N>/`, which the deck builder picks up and tags `season: N`). The live
game deals them too; a season is published here once it is no longer new. New photos are made with
`scripts/make-image.ts`, which keeps a shared spending cap.

| File | Cards | Pictures |
|---|---|---|
| `cards/objects.ts`, `cards/objects2.ts` | 24 look-alikes: peach, lime, cheetah, whisk, croissant, ukulele, corgi, Eiffel Tower, hedgehog, macaron, alpaca, sea lion, tortoise, hoverfly, moth, Samoyed, rigatoni, ciabatta, oboe, ball-peen hammer, Big Ben, Taj Mahal, alligator, gerbil | generated with GPT Image 2.5 Sunburst, each object on its own, reviewed by eye; in `assets/objects/small/` |
| `cards/maps.ts`, `cards/maps2.ts` | 19: point at a country, name a highlighted one | Natural Earth borders drawn with d3-geo; targets are the country polygons, checked against neighbours |
| `cards/chess.ts`, `cards/games.ts` | 17: mate in one, pins, forks, hanging pieces, castling, tic-tac-toe, connect four, sudoku, poker, a cube net, battleship | drawn; every claim checked in code when the card is built (chess with chess.js) |
| `cards/flags.ts`, `cards/flags2.ts` | 16: Nordic crosses and look-alike flags | drawn to the official colors and proportions |
| `cards/perception.ts`, `cards/puzzles.ts`, `cards/puzzles2.ts` | 24: Stroop, illusions, counting, clocks, dice, Roman numerals, gears, scales, a maze, shadows, sequences, spot the difference | drawn; answers exact by construction |
| `cards/objects3.ts`, `cards/nature.ts` | 30 more photos: cheeses, sushi, plugs, bikes, owls, leaves, shells, and taxonomy traps ("Tap the dolphin": the orca) | generated and reviewed like the first set |
| `cards/geo.ts` | 14: country silhouettes, true sizes on a Mercator map, borders, landlocked countries | computed from the map data at build time |
| `cards/symbols.ts` | 14: writing systems, road signs, hazard and laundry symbols, weather fronts, currency, music, Morse | drawn |
| `cards/charts.ts`, `cards/math.ts`, `cards/science.ts` | 42: charts and gauges, quick maths, circuits, magnets, moon phases, levers, floating | drawn; answers computed from the same data |
| `cards/conventions.ts`, `cards/traps.ts`, `cards/calendar-geometry.ts` | 40: alto clef and key signatures, Mercator and conic maps, log and broken axes, taxonomy traps, plugs, calendars, angles, symmetry | drawn or generated; answers computed or textbook facts |

`cards/lib.ts` has the format and the scoring helpers (`inside`, `optionAt`, `boxHits`), shared by the build, the
server and the page.

## How Jev plays

The page at `/how` shows the exact request Jev gets for a card (`GET /api/explain`) and asks Jev live. Options go to
Jev under neutral names (`option-1`, ...) in a random order, so the request never says what anything is.

## Sound

Soft quiz-show music, effects (a chime, a buzzer, applause) and a host who opens and closes each game, all made
with ElevenLabs (music, sound effects and v3 voice) by `scripts/make-sound.ts`. Music, effects and the
host can each be switched off on the home screen.

## Run it

```bash
npm install
cp .env.example .env     # an API key for Jev
npm run deck             # render cards/*.ts to public/cards/*.png, cards/deck.json and public/cards/deck.json
npm run dev              # http://localhost:5173
npm test
```

In production, `npm run build` then `npm start` serves the built page and the API from one Node process. The
`Dockerfile` does the same (with `railway.json` for Railway); mount a volume at `/data`.

| Variable | What it is |
|---|---|
| `OPPER_API_KEY` | Calls Jev through the [Opper](https://opper.ai) gateway. Every question Jev answers is paid by this key (about $0.0001 a card). |
| `TYPESAFE_API_KEY` | Or calls Jev on TypeSafe directly (with both keys set, `JEV_ROUTE=typesafe` picks this one). |
| `SESSION_SECRET` | Signs deals, Jev's answers and share links. Set it in production; locally one is made in `DATA_DIR/secret`. |
| `DATA_DIR` | Where the leaderboards, Jev's tally of wins (`tally.json`) and the play log (`stats.jsonl`: one line per answer and per finished game, no addresses or names; see `server/stats.ts`) are kept (default `data/`). Mount a volume here. |
| `BOARDS` | `off` closes the leaderboards: no new entries, and the page hides them. What is on them is kept for when they open again. |
| `TRUST_PROXY` | `1` behind a proxy, so the visitor's address comes from `X-Forwarded-For`. |
| `PUBLIC_ORIGIN` | The site's public address (`https://jevcards.com`), for link previews and the same-site check behind a proxy that rewrites the host. |
| `PROXY_SECRET` | Behind a proxy that sends it as `X-Proxy-Secret`: requests without it are refused (all but `/api/health`), so the server's own address cannot skip the proxy. |
| `PORT`, `STATIC_DIR` | Port (default 3000) and the built page (default `dist/`). |

`npm run bench` asks Jev every card and prints what it answered, right or wrong, and how fast
(`--model typesafe/jev-1.13.0`, `--cards a,b`, `--runs 3`).

## Jev's calls

Point cards need Jev 1.14 (box answers). Every call is one System One request, built by `wireBody()` in
`server/jev.ts`.

The server only asks Jev about cards in a game in progress (`POST /api/ask` takes a card id and the game's deal;
the how-it-works page's six examples need no deal), since Jev's answer would give most answers away. It refuses cross-site requests,
and limits each visitor to a few questions a second. Live match names and leaderboard initials get one quick check
by Jev, and are refused only when Jev is at least 90% sure they are offensive.

## License

Copyright (C) 2026 Jose Sabater.

- **The code** is free software under the [GNU Affero General Public License 3.0](LICENSE) or later. If you run a
  changed version as a website, the AGPL asks you to offer its source to the people who play it.
- **The cards** (the pictures, `cards/deck.json`, the questions and answers in `cards/*.ts`), the sound and
  the preview image are under [Creative Commons Attribution 4.0](LICENSE-CARDS). Use them for anything, including
  training or evaluating models, as long as you credit them:

  > Cards from Jev Cards by Jose Sabater (https://jose.sabater.io), CC BY 4.0

Fonts, map data and how the pictures and sound were made: see [NOTICE.md](NOTICE.md).
