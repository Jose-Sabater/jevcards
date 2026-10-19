import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import type { Card } from '../cards/lib.ts';
import { wireBody } from './jev.ts';

const cards: Card[] = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'public', 'cards', 'deck.json'), 'utf8')).cards;

test("Jev's options carry neutral names, never the card's option ids", () => {
  for (const card of cards.filter((c) => c.options)) {
    const body = wireBody(card, '', 'm') as { questions: { answer: { criteria?: Record<string, string> } } };
    const keys = Object.keys(body.questions.answer.criteria ?? {});
    assert.deepEqual([...keys].sort(), card.options!.map((_, i) => `option-${i + 1}`).sort(), card.id);
    // No option id (they name the things: "peach") may appear as a key.
    for (const o of card.options!) assert.ok(!keys.includes(o.id), `${card.id}: ${o.id} sent as a name`);
  }
});
