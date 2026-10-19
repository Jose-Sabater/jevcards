/**
 * Object cards: AI-generated photos of lookalike things (OpenAI gpt-image-2.5 Sunburst through Opper), the
 * player taps the one the prompt names. The pictures, downscaled, are in
 * assets/objects/small/ and embedded in the SVG.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { defineCard, rectPx, svgDoc, type CardSpec, type Option } from './lib.ts';

const dir = join(import.meta.dirname, '..', 'assets', 'objects', 'small');
const img = (name: string): string => `data:image/png;base64,${readFileSync(join(dir, `${name}.png`)).toString('base64')}`;

type Cell = { x: number; y: number; s: number };

/** Three in a row, 300 px each. */
const ROW: Cell[] = [
  { x: 15, y: 210, s: 300 },
  { x: 330, y: 210, s: 300 },
  { x: 645, y: 210, s: 300 },
];
/** 2x2 grid, 330 px each: top left, top right, bottom left, bottom right. */
const GRID: Cell[] = [
  { x: 130, y: 20, s: 330 },
  { x: 500, y: 20, s: 330 },
  { x: 130, y: 370, s: 330 },
  { x: 500, y: 370, s: 330 },
];

const ROW_WHERE = ['on the left', 'in the middle', 'on the right'];
const GRID_WHERE = ['top left', 'top right', 'bottom left', 'bottom right'];

interface Thing {
  id: string;
  label: string;
  /** file name in assets/objects/small, without .png */
  file: string;
}

/** Lay out the things (row of 3 or 2x2 grid) and return the svg and the options. */
function layout(things: Thing[], noun: string): { svg: string; options: Option[] } {
  const grid = things.length === 4;
  const cells = grid ? GRID : ROW;
  const body = things
    .map((t, i) => {
      const c = cells[i];
      return `<image href="${img(t.file)}" x="${c.x}" y="${c.y}" width="${c.s}" height="${c.s}" preserveAspectRatio="xMidYMid meet"/>`;
    })
    .join('');
  const options = things.map((t, i): Option => {
    const c = cells[i];
    return {
      id: t.id,
      label: t.label,
      region: rectPx(c.x, c.y, c.s, c.s),
      jev: grid ? `The ${GRID_WHERE[i]} ${noun}.` : `The ${noun} ${ROW_WHERE[i]}.`,
    };
  });
  return { svg: svgDoc(body), options };
}

function card(
  c: Omit<CardSpec, 'svg' | 'options' | 'kind' | 'source'>,
  things: Thing[],
  noun: string,
): CardSpec {
  return defineCard({ ...c, kind: 'pick', source: 'generated', ...layout(things, noun) });
}

const T = (id: string, label: string, file = id): Thing => ({ id, label, file });

const cards: CardSpec[] = [
  card(
    {
      id: 'fruit-peach',
      title: 'Peach',
      category: 'objects',
      difficulty: 1,
      prompt: 'Tap the peach.',
      answer: 'peach',
      explain: 'The peach is the fuzzy one with a seam down one side; peaches and apples are both in the rose family, like the pear.',
      jev: {
        context: 'Three pieces of fruit on a white background, side by side.',
        instructions: 'Which object in `card` is the peach?',
      },
    },
    [T('apple', 'Apple'), T('pear', 'Pear'), T('peach', 'Peach')],
    'fruit',
  ),
  card(
    {
      id: 'citrus-lime',
      title: 'Lime',
      category: 'objects',
      difficulty: 1,
      prompt: 'Tap the lime.',
      answer: 'lime',
      explain: 'The lime has dimpled citrus peel and pointed ends like a lemon; the green apple is smooth with a stem, and limes actually turn yellow if left to ripen.',
      jev: {
        context: 'Four pieces of fruit on a white background in a two by two grid.',
        instructions: 'Which object in `card` is the lime?',
      },
    },
    [T('lemon', 'Lemon'), T('lime', 'Lime'), T('green-apple', 'Green apple'), T('kiwi', 'Kiwi')],
    'fruit',
  ),
  card(
    {
      id: 'big-cat-cheetah',
      title: 'Cheetah',
      category: 'animals',
      difficulty: 3,
      prompt: 'Tap the cheetah.',
      answer: 'cheetah',
      explain: 'Cheetahs have solid round spots and black tear lines down the face; leopards have small rosettes, and jaguars have big rosettes with dots inside.',
      jev: {
        context: 'Three big spotted cats on a white background, side by side.',
        instructions: 'Which animal in `card` is the cheetah?',
      },
    },
    [T('leopard', 'Leopard'), T('cheetah', 'Cheetah'), T('jaguar', 'Jaguar')],
    'animal',
  ),
  card(
    {
      id: 'kitchen-whisk',
      title: 'Whisk',
      category: 'objects',
      difficulty: 1,
      prompt: 'Tap the whisk.',
      answer: 'whisk',
      explain: 'The whisk is the balloon of looped wires; the one with a single wavy wire is a potato masher.',
      jev: {
        context: 'Four steel kitchen utensils on a white background in a two by two grid.',
        instructions: 'Which object in `card` is the whisk?',
      },
    },
    [T('whisk', 'Whisk'), T('ladle', 'Ladle'), T('masher', 'Potato masher'), T('spatula', 'Spatula')],
    'object',
  ),
  card(
    {
      id: 'pastry-croissant',
      title: 'Croissant',
      category: 'objects',
      difficulty: 2,
      prompt: 'Tap the croissant.',
      answer: 'croissant',
      explain: 'The croissant is the crescent; the rectangular roll with chocolate peeking out is a pain au chocolat, made from the same laminated dough.',
      jev: {
        context: 'Four baked goods on a white background in a two by two grid.',
        instructions: 'Which object in `card` is the croissant?',
      },
    },
    [T('pretzel', 'Pretzel'), T('pain-au-chocolat', 'Pain au chocolat'), T('croissant', 'Croissant'), T('cinnamon-roll', 'Cinnamon roll')],
    'object',
  ),
  card(
    {
      id: 'strings-ukulele',
      title: 'Ukulele',
      category: 'objects',
      difficulty: 3,
      prompt: 'Tap the ukulele.',
      answer: 'ukulele',
      explain: 'Count the tuning pegs: the ukulele has four strings, the little guitar six, and the mandolin eight in pairs.',
      jev: {
        context: 'Four string instruments on a white background in a two by two grid, all shown at the same size.',
        instructions: 'Which object in `card` is the ukulele?',
      },
    },
    [T('guitar', 'Guitar'), T('ukulele', 'Ukulele'), T('mandolin', 'Mandolin'), T('violin', 'Violin')],
    'object',
  ),
  card(
    {
      id: 'dog-corgi',
      title: 'Corgi',
      category: 'animals',
      difficulty: 2,
      prompt: 'Tap the corgi.',
      answer: 'corgi',
      explain: 'The corgi is the one with the very short legs and long body; the Shiba Inu and the Basenji both curl their tails over their backs.',
      jev: {
        context: 'Three red and white dogs on a white background, side by side.',
        instructions: 'Which animal in `card` is the corgi?',
      },
    },
    [T('corgi', 'Corgi'), T('shiba', 'Shiba Inu'), T('basenji', 'Basenji')],
    'animal',
  ),
  card(
    {
      id: 'tower-eiffel',
      title: 'Eiffel Tower',
      category: 'landmarks',
      difficulty: 2,
      prompt: 'Tap the Eiffel Tower.',
      answer: 'eiffel',
      explain: 'The Eiffel Tower stands on four legs joined by big arches; Prague\'s Petrin tower and England\'s Blackpool Tower were built in its image, and Tokyo Tower is painted orange and white for air safety.',
      jev: {
        context: 'Four steel lattice towers on a white background in a two by two grid.',
        instructions: 'Which tower in `card` is the Eiffel Tower?',
      },
    },
    [T('tokyo-tower', 'Tokyo Tower'), T('petrin', 'Petrin Lookout Tower'), T('eiffel', 'Eiffel Tower'), T('blackpool', 'Blackpool Tower')],
    'tower',
  ),
  card(
    {
      id: 'spiky-hedgehog',
      title: 'Hedgehog',
      category: 'animals',
      difficulty: 2,
      prompt: 'Tap the hedgehog.',
      answer: 'hedgehog',
      explain: 'The hedgehog is the small one with short, tidy spines; the porcupine is a rodent with long quills and the echidna is an egg-laying mammal with a long snout.',
      jev: {
        context: 'Three spiny animals on a white background, side by side.',
        instructions: 'Which animal in `card` is the hedgehog?',
      },
    },
    [T('echidna', 'Echidna'), T('porcupine', 'Porcupine'), T('hedgehog', 'Hedgehog')],
    'animal',
  ),
  card(
    {
      id: 'cookie-macaron',
      title: 'Macaron',
      category: 'objects',
      difficulty: 2,
      prompt: 'Tap the macaron.',
      answer: 'macaron',
      explain: 'The macaron (one o) is the French almond sandwich with ruffled feet. The coconut mound is a macaroon (two o\'s), the usual trap.',
      jev: {
        context: 'Four cookies on a white background in a two by two grid.',
        instructions: 'Which object in `card` is the French macaron?',
      },
    },
    [T('macaron', 'Macaron'), T('whoopie-pie', 'Whoopie pie'), T('sandwich-cookie', 'Sandwich cookie'), T('macaroon', 'Macaroon')],
    'object',
  ),
];

export default cards;
