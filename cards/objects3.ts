/**
 * Even more lookalike cards, food and everyday things: AI-generated photos (OpenAI gpt-image-2.5 Sunburst through
 * Opper), the player taps the one the prompt names. Same layout as objects2.ts. The pictures, downscaled, are in
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

function card(c: Omit<CardSpec, 'svg' | 'options' | 'kind' | 'source'>, things: Thing[], noun: string): CardSpec {
  return defineCard({ ...c, kind: 'pick', source: 'generated', ...layout(things, noun) });
}

const T = (id: string, label: string, file = id): Thing => ({ id, label, file });

const cards: CardSpec[] = [
  card(
    {
      id: 'cheese-emmental',
      title: 'Emmental',
      category: 'food',
      difficulty: 1,
      prompt: 'Tap the Emmental.',
      answer: 'emmental',
      explain: 'Emmental is the Swiss cheese full of big round holes; Gouda has a smooth waxed rind and a dense inside, and Parmesan is a hard, grainy wheel with a dotted rind.',
      jev: {
        context: 'Three cheeses on a white background, side by side.',
        instructions: 'Which cheese in `card` is the Emmental?',
      },
    },
    [T('gouda', 'Gouda'), T('emmental', 'Emmental'), T('parmesan', 'Parmigiano Reggiano')],
    'cheese',
  ),
  card(
    {
      id: 'sushi-nigiri',
      title: 'Nigiri',
      category: 'food',
      difficulty: 2,
      prompt: 'Tap the nigiri.',
      answer: 'nigiri',
      explain: 'Nigiri is a hand-pressed mound of rice with a slice of fish laid on top; maki is rolled in seaweed and sliced, and sashimi is fish with no rice at all.',
      jev: {
        context: 'Three servings of sushi and raw fish on a white background, side by side.',
        instructions: 'Which one in `card` is the nigiri?',
      },
    },
    [T('maki', 'Maki'), T('sashimi', 'Sashimi'), T('nigiri', 'Nigiri')],
    'food',
  ),
  card(
    {
      id: 'dumpling-gyoza',
      title: 'Gyoza',
      category: 'food',
      difficulty: 2,
      prompt: 'Tap the gyoza.',
      answer: 'gyoza',
      explain: 'Gyoza are thin-skinned Japanese dumplings pleated along one edge and pan-fried until the bottoms go crisp and brown; pierogi are thicker boiled half-moons with pressed edges, and bao are fluffy steamed buns.',
      jev: {
        context: 'Three plates of dumplings on a white background, side by side.',
        instructions: 'Which dumplings in `card` are the gyoza?',
      },
    },
    [T('pierogi', 'Pierogi'), T('gyoza', 'Gyoza'), T('bao', 'Bao buns')],
    'plate',
  ),
  card(
    {
      id: 'chili-habanero',
      title: 'Habanero',
      category: 'food',
      difficulty: 2,
      prompt: 'Tap the habanero.',
      answer: 'habanero',
      explain: 'The habanero is the small orange chili shaped like a lantern; the jalapeno is a smooth green bullet, and bird\'s eye chilies are tiny, thin and red.',
      jev: {
        context: 'Three kinds of chili pepper on a white background, side by side.',
        instructions: 'Which pepper in `card` is the habanero?',
      },
    },
    [T('habanero', 'Habanero'), T('jalapeno', 'Jalapeno'), T('birds-eye', 'Bird\'s eye chili')],
    'pepper',
  ),
  card(
    {
      id: 'berry-mulberry',
      title: 'Mulberry',
      category: 'food',
      difficulty: 3,
      prompt: 'Tap the mulberries.',
      answer: 'mulberry',
      explain: 'Mulberries are long and narrow and keep a thin green stem; blackberries are short and round, and raspberries are red and hollow where they came off the plant.',
      jev: {
        context: 'Three small heaps of berries on a white background, side by side.',
        instructions: 'Which berries in `card` are the mulberries?',
      },
    },
    [T('blackberry', 'Blackberries'), T('mulberry', 'Mulberries'), T('raspberry', 'Raspberries')],
    'heap of berries',
  ),
  card(
    {
      id: 'nut-pecan',
      title: 'Pecan',
      category: 'food',
      difficulty: 2,
      prompt: 'Tap the pecan.',
      answer: 'pecan',
      explain: 'The pecan is a long, smooth oval with neat reddish-brown ridges; walnut halves are paler, lumpy and shaped like a brain.',
      jev: {
        context: 'Four kinds of shelled nuts on a white background in a two by two grid.',
        instructions: 'Which nut in `card` is the pecan?',
      },
    },
    [T('walnut', 'Walnuts'), T('almond', 'Almonds'), T('pecan', 'Pecan'), T('hazelnut', 'Hazelnuts')],
    'nuts',
  ),
  card(
    {
      id: 'squash-acorn',
      title: 'Acorn squash',
      category: 'food',
      difficulty: 2,
      prompt: 'Tap the acorn squash.',
      answer: 'acorn-squash',
      explain: 'The acorn squash is dark green with deep ribs and a pointed end, like a giant acorn; butternut is tan with a long neck, spaghetti squash is a smooth yellow oval, and the pumpkin is round and orange.',
      jev: {
        context: 'Four winter squashes on a white background in a two by two grid.',
        instructions: 'Which squash in `card` is the acorn squash?',
      },
    },
    [T('butternut', 'Butternut squash'), T('pumpkin', 'Pumpkin'), T('spaghetti-squash', 'Spaghetti squash'), T('acorn-squash', 'Acorn squash')],
    'squash',
  ),
  card(
    {
      id: 'kitchen-mandoline',
      title: 'Mandoline',
      category: 'objects',
      difficulty: 2,
      prompt: 'Tap the mandoline.',
      answer: 'mandoline',
      explain: 'A mandoline is a flat platform with a blade set across it, for slicing vegetables thin and even; the long rasp is a zester and the four-sided tower is a box grater.',
      jev: {
        context: 'Four kitchen gadgets on a white background in a two by two grid.',
        instructions: 'Which tool in `card` is the mandoline (the kitchen slicer)?',
      },
    },
    [T('zester', 'Zester'), T('mandoline', 'Mandoline slicer'), T('box-grater', 'Box grater'), T('garlic-press', 'Garlic press')],
    'tool',
  ),
  card(
    {
      id: 'plug-australian',
      title: 'Australian plug',
      category: 'objects',
      difficulty: 3,
      prompt: 'Tap the Australian plug.',
      answer: 'plug-au',
      explain: 'The Australian plug has two flat blades set at an angle like a V, plus an earth pin below; the UK plug has three thick rectangular pins, the US plug two parallel flat blades, and the Europlug two round pins.',
      jev: {
        context: 'Four electrical plugs on a white background in a two by two grid.',
        instructions: 'Which plug in `card` is the Australian one?',
      },
    },
    [T('plug-uk', 'UK plug (Type G)'), T('plug-us', 'US plug (Type A)'), T('plug-au', 'Australian plug (Type I)'), T('plug-eu', 'Europlug (Type C)')],
    'plug',
  ),
  card(
    {
      id: 'bulb-led',
      title: 'LED bulb',
      category: 'objects',
      difficulty: 2,
      prompt: 'Tap the LED bulb.',
      answer: 'bulb-led',
      explain: 'The LED bulb has a frosted dome on a thick ribbed neck that carries heat away from the chips; the incandescent bulb shows a glowing wire filament, and the compact fluorescent is a spiral tube.',
      jev: {
        context: 'Three screw-in light bulbs on a white background, side by side.',
        instructions: 'Which bulb in `card` is the LED bulb?',
      },
    },
    [T('bulb-incandescent', 'Incandescent bulb'), T('bulb-cfl', 'Compact fluorescent bulb'), T('bulb-led', 'LED bulb')],
    'bulb',
  ),
  card(
    {
      id: 'ball-rugby',
      title: 'Rugby ball',
      category: 'objects',
      difficulty: 2,
      prompt: 'Tap the rugby ball.',
      answer: 'rugby-ball',
      explain: 'A rugby ball is fatter with blunt, rounded ends and has no laces; the American football is pointed with white laces, and the red Australian rules ball also has laces.',
      jev: {
        context: 'Three oval balls on a white background, side by side.',
        instructions: 'Which ball in `card` is the rugby ball?',
      },
    },
    [T('american-football', 'American football'), T('aussie-ball', 'Australian rules football'), T('rugby-ball', 'Rugby ball')],
    'ball',
  ),
  card(
    {
      id: 'boat-canoe',
      title: 'Canoe',
      category: 'objects',
      difficulty: 2,
      prompt: 'Tap the canoe.',
      answer: 'canoe',
      explain: 'A canoe is open on top and paddled with a single-bladed paddle; a kayak has a closed deck and a double-bladed paddle, and a rowing boat has a square stern and oars in oarlocks.',
      jev: {
        context: 'Three small boats on a white background, side by side.',
        instructions: 'Which boat in `card` is the canoe?',
      },
    },
    [T('kayak', 'Kayak'), T('rowboat', 'Rowing boat'), T('canoe', 'Canoe')],
    'boat',
  ),
  card(
    {
      id: 'bike-bmx',
      title: 'BMX',
      category: 'objects',
      difficulty: 1,
      prompt: 'Tap the BMX.',
      answer: 'bmx',
      explain: 'The BMX is the small bike with 20-inch wheels and high straight handlebars; the road bike has curled drop handlebars and thin tyres, and the mountain bike has fat knobbly tyres and suspension.',
      jev: {
        context: 'Three bicycles seen from the side on a white background, side by side.',
        instructions: 'Which bicycle in `card` is the BMX?',
      },
    },
    [T('road-bike', 'Road bike'), T('mountain-bike', 'Mountain bike'), T('bmx', 'BMX')],
    'bicycle',
  ),
  card(
    {
      id: 'fastener-bolt',
      title: 'Bolt',
      category: 'objects',
      difficulty: 2,
      prompt: 'Tap the bolt.',
      answer: 'bolt',
      explain: 'A bolt has a hex head, an even machine thread and a blunt end, because it goes through a hole into a nut; a wood screw tapers to a sharp point, a nail has no thread, and a pop rivet has a pin sticking out of it.',
      jev: {
        context: 'Four metal fasteners on a white background in a two by two grid.',
        instructions: 'Which fastener in `card` is the bolt?',
      },
    },
    [T('wood-screw', 'Wood screw'), T('nail', 'Nail'), T('rivet', 'Pop rivet'), T('bolt', 'Hex bolt')],
    'fastener',
  ),
  card(
    {
      id: 'pliers-locking',
      title: 'Locking pliers',
      category: 'objects',
      difficulty: 2,
      prompt: 'Tap the locking pliers.',
      answer: 'locking-pliers',
      explain: 'Locking pliers (Vise-Grips) have a screw knob at the end of one handle and a release lever, so they clamp shut on their own; needle-nose pliers have long thin jaws and wire cutters have angled blades.',
      jev: {
        context: 'Four kinds of pliers on a white background in a two by two grid.',
        instructions: 'Which tool in `card` is the locking pliers?',
      },
    },
    [T('needle-nose', 'Needle-nose pliers'), T('locking-pliers', 'Locking pliers'), T('wire-cutters', 'Diagonal wire cutters'), T('slip-joint', 'Slip-joint pliers')],
    'tool',
  ),
  card(
    {
      id: 'glass-coupe',
      title: 'Coupe glass',
      category: 'objects',
      difficulty: 2,
      prompt: 'Tap the coupe.',
      answer: 'coupe-glass',
      explain: 'The coupe is the stemmed glass with a broad, shallow, rounded saucer of a bowl; the martini glass is a straight-sided V, the flute is tall and narrow, and the wine glass has a big round bowl.',
      jev: {
        context: 'Four stemmed drinking glasses on a white background in a two by two grid.',
        instructions: 'Which glass in `card` is the coupe?',
      },
    },
    [T('martini-glass', 'Martini glass'), T('champagne-flute', 'Champagne flute'), T('wine-glass', 'Wine glass'), T('coupe-glass', 'Coupe')],
    'glass',
  ),
];

export default cards;
