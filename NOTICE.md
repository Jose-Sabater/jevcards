# Notices

Jev Cards is Copyright (C) 2026 Jose Sabater. The code is under the GNU AGPL 3.0 or later (`LICENSE`); the cards,
the sound and the preview image are under CC BY 4.0 (`LICENSE-CARDS`). This file lists what came from elsewhere and
how it was made.

## Made with AI tools

- **Photos** in `assets/objects/` (and the cards built from them) were generated with OpenAI GPT Image 2.5
  Sunburst, then reviewed by eye.
- **Music, sound effects and voices** in `assets/sound/` and `public/sound/` were generated with ElevenLabs
  (Music, Sound Effects and v3 voices), then loudness-normalized with ffmpeg
  (`scripts/make-sound.ts`).

Both were made through the [Opper](https://opper.ai) gateway.

## Bundled third-party files

| What | Where | License |
|---|---|---|
| Bungee font (The Bungee Project Authors) | `assets/fonts/Bungee-Regular.ttf` | SIL OFL 1.1, `assets/fonts/OFL-Bungee.txt` |
| Barlow Condensed font (The Barlow Project Authors) | `assets/fonts/BarlowCondensed-*.ttf` | SIL OFL 1.1, `assets/fonts/OFL-BarlowCondensed.txt` |
| Country borders (Natural Earth 4.1, via `world-atlas`) | drawn into the map cards | Natural Earth is public domain; `world-atlas` is ISC |

## Dependencies

Installed from npm, each under its own license: chess.js (BSD-2-Clause), d3-geo and topojson-client (ISC),
@resvg/resvg-js (MPL-2.0), the Fontsource fonts Bungee, Barlow Condensed and Fraunces (OFL-1.1), and the dev tools
in `package.json`.

## Names

Jev and System One are names of TypeSafe, whose API the game calls. The licenses here cover this repository, not Jev.
