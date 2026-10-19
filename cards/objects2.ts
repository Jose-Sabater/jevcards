/**
 * More object cards: AI-generated photos of lookalike things (OpenAI gpt-image-2.5 Sunburst through Opper), the
 * player taps the one the prompt names. Same layout as objects.ts. The pictures, downscaled, are in
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
/** Four tall cells in a row, for long thin things (crops in assets/objects/small/<name>-tall.png). */
const TALL: { x: number; y: number; w: number; h: number }[] = [24, 258, 492, 726].map((x) => ({ x, y: 10, w: 210, h: 700 }));
const TALL_WHERE = ['first from the left', 'second from the left', 'third from the left', 'on the far right'];
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

/** Four tall things in a row, each in a 210 x 700 cell. */
function tallLayout(things: Thing[], noun: string): { svg: string; options: Option[] } {
  const body = things
    .map((t, i) => {
      const c = TALL[i];
      return `<image href="${img(`${t.file}-tall`)}" x="${c.x}" y="${c.y}" width="${c.w}" height="${c.h}" preserveAspectRatio="xMidYMid meet"/>`;
    })
    .join('');
  const options = things.map((t, i): Option => {
    const c = TALL[i];
    return { id: t.id, label: t.label, region: rectPx(c.x, c.y, c.w, c.h), jev: `The ${noun} ${TALL_WHERE[i]}.` };
  });
  return { svg: svgDoc(body), options };
}

function card(
  c: Omit<CardSpec, 'svg' | 'options' | 'kind' | 'source'>,
  things: Thing[],
  noun: string,
  tall = false,
): CardSpec {
  return defineCard({ ...c, kind: 'pick', source: 'generated', ...(tall ? tallLayout : layout)(things, noun) });
}

const T = (id: string, label: string, file = id): Thing => ({ id, label, file });

const cards: CardSpec[] = [
  card(
    {
      id: 'camelid-alpaca',
      title: 'Alpaca',
      category: 'animals',
      difficulty: 2,
      prompt: 'Tap the alpaca.',
      answer: 'alpaca',
      explain: 'The alpaca is the smaller, fluffier one with short spear-shaped ears; the llama is taller with long banana-shaped ears, and the camel has a hump.',
      jev: {
        context: 'Three long-necked hoofed animals on a white background, side by side.',
        instructions: 'Which animal in `card` is the alpaca?',
      },
    },
    [T('dromedary', 'Dromedary camel'), T('llama', 'Llama'), T('alpaca', 'Alpaca')],
    'animal',
  ),
  card(
    {
      id: 'pinniped-sea-lion',
      title: 'Sea lion',
      category: 'animals',
      difficulty: 2,
      prompt: 'Tap the sea lion.',
      answer: 'sea-lion',
      explain: 'Sea lions have small ear flaps and prop themselves up on their front flippers; true seals like the spotted one have only ear holes and wriggle on their bellies, and the walrus has tusks.',
      jev: {
        context: 'Three flippered marine mammals on a white background, side by side.',
        instructions: 'Which animal in `card` is the sea lion?',
      },
    },
    [T('sea-lion', 'Sea lion'), T('harbor-seal', 'Harbor seal'), T('walrus', 'Walrus')],
    'animal',
  ),
  card(
    {
      id: 'shell-tortoise',
      title: 'Tortoise',
      category: 'animals',
      difficulty: 1,
      prompt: 'Tap the tortoise.',
      answer: 'tortoise',
      explain: 'Tortoises live on land, with a high domed shell and stumpy elephant-like legs; the sea turtle has paddle flippers and the red-eared slider is a freshwater turtle with webbed feet.',
      jev: {
        context: 'Three shelled reptiles on a white background, side by side.',
        instructions: 'Which animal in `card` is the tortoise?',
      },
    },
    [T('sea-turtle', 'Sea turtle'), T('tortoise', 'Tortoise'), T('pond-turtle', 'Red-eared slider')],
    'animal',
  ),
  card(
    {
      id: 'insect-hoverfly',
      title: 'Hoverfly',
      category: 'animals',
      difficulty: 3,
      prompt: 'Tap the hoverfly.',
      answer: 'hoverfly',
      explain: 'The hoverfly is a harmless fly dressed up as a wasp: huge eyes that cover most of its head, tiny stub antennae and only one pair of wings. Bees and wasps have long elbowed antennae and two pairs of wings.',
      jev: {
        context: 'Three yellow and black striped insects on a white background, side by side.',
        instructions: 'Which insect in `card` is the hoverfly?',
      },
    },
    [T('honeybee', 'Honeybee'), T('wasp', 'Wasp'), T('hoverfly', 'Hoverfly')],
    'insect',
  ),
  card(
    {
      id: 'insect-moth',
      title: 'Moth',
      category: 'animals',
      difficulty: 1,
      prompt: 'Tap the moth.',
      answer: 'moth',
      explain: 'The moth has feathery antennae and a thick furry body; butterflies have thin antennae with little clubs at the tips.',
      jev: {
        context: 'Three winged insects seen from above on a white background, side by side.',
        instructions: 'Which insect in `card` is the moth?',
      },
    },
    [T('butterfly', 'Monarch butterfly'), T('moth', 'Moth'), T('dragonfly', 'Dragonfly')],
    'insect',
  ),
  card(
    {
      id: 'dog-samoyed',
      title: 'Samoyed',
      category: 'animals',
      difficulty: 1,
      prompt: 'Tap the Samoyed.',
      answer: 'samoyed',
      explain: 'The Samoyed is the all-white, smiling one; the Siberian Husky and the heavier Alaskan Malamute are both grey and white.',
      jev: {
        context: 'Three fluffy spitz-type sled dogs on a white background, side by side.',
        instructions: 'Which dog in `card` is the Samoyed?',
      },
    },
    [T('samoyed', 'Samoyed'), T('husky', 'Siberian Husky'), T('malamute', 'Alaskan Malamute')],
    'dog',
  ),
  card(
    {
      id: 'pasta-rigatoni',
      title: 'Rigatoni',
      category: 'objects',
      difficulty: 2,
      prompt: 'Tap the rigatoni.',
      answer: 'rigatoni',
      explain: 'Rigatoni are wide ridged tubes cut straight across; penne are narrower tubes cut on a slant, like the nib of a pen.',
      jev: {
        context: 'Four heaps of dry pasta on a white background in a two by two grid.',
        instructions: 'Which pasta in `card` is the rigatoni?',
      },
    },
    [T('penne', 'Penne'), T('farfalle', 'Farfalle'), T('rigatoni', 'Rigatoni'), T('fusilli', 'Fusilli')],
    'pasta',
  ),
  card(
    {
      id: 'bread-ciabatta',
      title: 'Ciabatta',
      category: 'objects',
      difficulty: 2,
      prompt: 'Tap the ciabatta.',
      answer: 'ciabatta',
      explain: 'Ciabatta is the flat, floury, slipper-shaped Italian loaf with big holes inside; the baguette is long and thin, and the brioche is a rich, shiny loaf with a topknot.',
      jev: {
        context: 'Three loaves of bread on a white background, side by side.',
        instructions: 'Which bread in `card` is the ciabatta?',
      },
    },
    [T('baguette', 'Baguette'), T('brioche', 'Brioche'), T('ciabatta', 'Ciabatta')],
    'bread',
  ),
  card(
    {
      id: 'woodwind-oboe',
      title: 'Oboe',
      category: 'objects',
      difficulty: 3,
      prompt: 'Tap the oboe.',
      answer: 'oboe',
      explain: 'The oboe is played through a thin double reed sticking out of the top; the clarinet has a black beak-shaped mouthpiece with a single reed and a wider flared bell.',
      jev: {
        context: 'Four woodwind instruments standing upright on a white background, side by side.',
        instructions: 'Which instrument in `card` is the oboe?',
      },
    },
    [T('clarinet', 'Clarinet'), T('oboe', 'Oboe'), T('recorder', 'Recorder'), T('flute', 'Flute')],
    'instrument',
    true,
  ),
  card(
    {
      id: 'hammer-ball-peen',
      title: 'Ball-peen hammer',
      category: 'objects',
      difficulty: 2,
      prompt: 'Tap the ball-peen hammer.',
      answer: 'ball-peen',
      explain: 'The ball-peen hammer has a rounded ball on the back of its head, for shaping metal; the claw hammer has a split claw for pulling nails.',
      jev: {
        context: 'Four hammers with wooden handles on a white background in a two by two grid.',
        instructions: 'Which hammer in `card` is the ball-peen hammer?',
      },
    },
    [T('sledgehammer', 'Sledgehammer'), T('claw-hammer', 'Claw hammer'), T('rubber-mallet', 'Rubber mallet'), T('ball-peen', 'Ball-peen hammer')],
    'hammer',
  ),
  card(
    {
      id: 'tower-big-ben',
      title: 'Big Ben',
      category: 'landmarks',
      difficulty: 2,
      prompt: 'Tap Big Ben.',
      answer: 'big-ben',
      explain: 'Big Ben\'s tower in London (the Elizabeth Tower) has its four clocks near the top under a dark pointed roof; the Kremlin\'s Spasskaya Tower is red brick with a star, and Mumbai\'s Rajabai Tower was modeled on Big Ben.',
      jev: {
        context: 'Three clock towers on a white background, side by side.',
        instructions: 'Which tower in `card` is Big Ben (the Elizabeth Tower in London)?',
      },
    },
    [T('spasskaya', 'Spasskaya Tower'), T('big-ben', 'Big Ben (Elizabeth Tower)'), T('rajabai', 'Rajabai Clock Tower')],
    'tower',
  ),
  card(
    {
      id: 'tomb-taj-mahal',
      title: 'Taj Mahal',
      category: 'landmarks',
      difficulty: 1,
      prompt: 'Tap the Taj Mahal.',
      answer: 'taj-mahal',
      explain: 'The Taj Mahal is all white marble with four separate minarets at its corners; Humayun\'s Tomb in Delhi, which inspired it, is red sandstone, and Lahore\'s Badshahi Mosque is red with three domes.',
      jev: {
        context: 'Three domed Mughal buildings on a white background, side by side.',
        instructions: 'Which building in `card` is the Taj Mahal?',
      },
    },
    [T('humayun-tomb', 'Humayun\'s Tomb'), T('badshahi', 'Badshahi Mosque'), T('taj-mahal', 'Taj Mahal')],
    'building',
  ),
  card(
    {
      id: 'reptile-alligator',
      title: 'Alligator',
      category: 'animals',
      difficulty: 3,
      prompt: 'Tap the alligator.',
      answer: 'alligator',
      explain: 'Alligators have a broad, rounded U-shaped snout; crocodiles have a narrower, pointed V-shaped one, and the gharial\'s snout is extremely thin.',
      jev: {
        context: 'Three crocodilians seen from directly above on a white background, side by side.',
        instructions: 'Which animal in `card` is the alligator?',
      },
    },
    [T('crocodile', 'Nile crocodile'), T('alligator', 'American alligator'), T('gharial', 'Gharial')],
    'animal',
  ),
  card(
    {
      id: 'rodent-gerbil',
      title: 'Gerbil',
      category: 'animals',
      difficulty: 2,
      prompt: 'Tap the gerbil.',
      answer: 'gerbil',
      explain: 'The gerbil has a long furry tail with a tuft at the end; hamsters have a tiny stub of a tail and guinea pigs have none.',
      jev: {
        context: 'Three small pet rodents on a white background, side by side.',
        instructions: 'Which animal in `card` is the gerbil?',
      },
    },
    [T('gerbil', 'Gerbil'), T('guinea-pig', 'Guinea pig'), T('hamster', 'Hamster')],
    'animal',
  ),
];

export default cards;
