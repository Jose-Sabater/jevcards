#!/usr/bin/env bash
# Builds the public copy of this repo (github.com/Jose-Sabater/jevcards) from HEAD into scratch/open, without the seasons: cards/season*/ stay
# private while they are new. The deck and the card pictures are rebuilt from the cards that remain, and photos
# only the seasons use are left out. Publishing that folder is a separate, deliberate step.
#
#   scripts/make-open.sh
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
stage=$root/scratch/open

[ -z "$(git -C "$root" status --porcelain -- . ':!scratch')" ] || { echo "commit first: the public copy is made from HEAD" >&2; exit 1; }
rm -rf "$stage" && mkdir -p "$stage"
git -C "$root" archive HEAD | tar -x -C "$stage"
rm -rf "$stage"/cards/season*

# Photos the remaining cards name ("<name>", or "<name>-tall" crops of it); the rest belong to the seasons.
for f in "$stage"/assets/objects/small/*.png; do
  n=$(basename "$f" .png)
  grep -qE "['\"\`]${n%-tall}['\"\`-]" "$stage"/cards/*.ts || rm "$f"
done

# Rebuild the pictures and the deck from what is left; a missing photo fails the build here.
rm -f "$stage"/public/cards/*.png "$stage"/public/cards/deck.json "$stage"/cards/deck.json
ln -s "$root/node_modules" "$stage/node_modules"
(cd "$stage" && node scripts/build-deck.ts >/dev/null && npx tsc --noEmit -p . && node --test server/*.test.ts >/dev/null)
rm "$stage/node_modules"
echo "public copy in $stage: $(grep -c '^{"id"' "$stage/cards/deck.json") cards, $(ls "$stage"/assets/objects/small | wc -l | tr -d ' ') photos"
