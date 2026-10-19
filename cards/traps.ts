/**
 * Trap cards: the picture looks easy, but the answer needs a bit of knowledge (taxonomy, botany, which country uses which
 * plug). AI-generated photos (OpenAI gpt-image-2.5 Sunburst through Opper), same layout as nature.ts. The pictures, downscaled, are in
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

/** One big photo in the middle, answered with buttons under it. */
const single = (file: string): string =>
  svgDoc(`<image href="${img(file)}" x="150" y="30" width="660" height="660" preserveAspectRatio="xMidYMid meet"/>`);
const buttons = (names: string[]): Option[] => names.map((n) => ({ id: n.toLowerCase().replace(/[^a-z]+/g, '-'), label: n, jev: n }));
const plugJev = { context: 'One electrical plug on a white background.', instructions: 'Which country uses the plug in `card`?' };

function plugCard(c: Omit<CardSpec, 'svg' | 'options' | 'kind' | 'source' | 'jev' | 'prompt'>, file: string, countries: string[]): CardSpec {
  return defineCard({ ...c, prompt: 'Which country uses this plug?', kind: 'buttons', source: 'generated', svg: single(file), options: buttons(countries), jev: plugJev });
}

const cards: CardSpec[] = [
  card(
    {
      id: 'relative-elephant',
      title: 'Elephant\'s cousin',
      category: 'animals',
      difficulty: 3,
      prompt: 'Tap the elephant\'s closest relative.',
      answer: 'rock-hyrax',
      explain: 'The rock hyrax looks like a big guinea pig, but hyraxes, together with manatees and dugongs, are the elephant\'s closest living relatives. The aardvark is a more distant African cousin, and the capybara is a rodent.',
      jev: {
        context: 'Three mammals standing on a white background, side by side.',
        instructions: 'Which animal in `card` is the closest living relative of the elephant?',
      },
    },
    [T('aardvark', 'Aardvark'), T('rock-hyrax', 'Rock hyrax'), T('capybara', 'Capybara')],
    'animal',
  ),
  card(
    {
      id: 'not-a-fish-cuttlefish',
      title: 'Not a fish',
      category: 'animals',
      difficulty: 2,
      prompt: 'Tap the one that is not a fish.',
      answer: 'cuttlefish',
      explain: 'Despite its name, the cuttlefish is a mollusc, a cousin of squid and octopus. The seahorse is a bony fish, the whale shark is a shark and the manta is a ray, so all three are fish.',
      jev: {
        context: 'Four sea animals on a white background in a two by two grid.',
        instructions: 'Which animal in `card` is not a fish?',
      },
    },
    [T('seahorse', 'Seahorse'), T('cuttlefish', 'Cuttlefish'), T('whale-shark', 'Whale shark'), T('manta-ray', 'Manta ray')],
    'animal',
  ),
  card(
    {
      id: 'relative-spider',
      title: 'Spider\'s cousin',
      category: 'animals',
      difficulty: 3,
      prompt: 'Tap the spider\'s closest relative.',
      answer: 'horseshoe-crab',
      explain: 'The horseshoe crab is not a crab: like spiders and scorpions it is a chelicerate, with pincer-like mouthparts. Crabs are crustaceans and beetles are insects, and those two are closer to each other than to spiders.',
      jev: {
        context: 'Three animals with hard shells seen from above on a white background, side by side.',
        instructions: 'Which animal in `card` is the closest relative of a spider?',
      },
    },
    [T('crab', 'Edible crab'), T('stag-beetle', 'Stag beetle'), T('horseshoe-crab', 'Horseshoe crab')],
    'animal',
  ),
  card(
    {
      id: 'relative-whale',
      title: 'Whale\'s cousin',
      category: 'animals',
      difficulty: 2,
      prompt: 'Tap the whale\'s closest relative.',
      answer: 'hippo',
      explain: 'Whales evolved from hoofed land mammals, and the hippo is their closest living relative. Seals are carnivores, related to dogs and bears, and the shark is a fish.',
      jev: {
        context: 'Three animals on a white background, side by side.',
        instructions: 'Which animal in `card` is the closest living relative of the whales?',
      },
    },
    [T('harbor-seal', 'Harbor seal'), T('great-white-shark', 'Great white shark'), T('hippo', 'Hippopotamus')],
    'animal',
  ),
  card(
    {
      id: 'not-a-bear',
      title: 'Not a bear',
      category: 'animals',
      difficulty: 2,
      prompt: 'Tap the one that is not a bear.',
      answer: 'red-panda',
      explain: 'The red panda is not a bear: it is the only living member of its own family. The giant panda and the sun bear are both true bears.',
      jev: {
        context: 'Three furry mammals on a white background, side by side.',
        instructions: 'Which animal in `card` is not a bear?',
      },
    },
    [T('sun-bear', 'Sun bear'), T('red-panda', 'Red panda'), T('giant-panda', 'Giant panda')],
    'animal',
  ),
  card(
    {
      id: 'which-is-bird',
      title: 'The bird',
      category: 'animals',
      difficulty: 1,
      prompt: 'Tap the bird.',
      answer: 'african-penguin',
      explain: 'The penguin is a bird that cannot fly. The bat and the flying squirrel take to the air, but both are mammals with fur that feed their young on milk.',
      jev: {
        context: 'Three animals on a white background, side by side.',
        instructions: 'Which animal in `card` is a bird?',
      },
    },
    [T('bat', 'Fruit bat'), T('flying-squirrel', 'Flying squirrel'), T('african-penguin', 'African penguin')],
    'animal',
  ),
  card(
    {
      id: 'legume-peanut',
      title: 'The legume',
      category: 'nature',
      difficulty: 2,
      prompt: 'Tap the legume.',
      answer: 'peanut',
      explain: 'The peanut grows in a pod under the ground, like a pea or a bean, so it is a legume. Walnuts, almonds and hazelnuts grow on trees.',
      jev: {
        context: 'Four kinds of nuts on a white background in a two by two grid.',
        instructions: 'Which one in `card` is a legume?',
      },
    },
    [T('walnut', 'Walnuts'), T('almond', 'Almonds'), T('peanut', 'Peanuts'), T('hazelnut', 'Hazelnuts')],
    'nuts',
  ),
  card(
    {
      id: 'botanical-fruit-tomato',
      title: 'The fruit',
      category: 'nature',
      difficulty: 1,
      prompt: 'Tap the fruit.',
      answer: 'tomato',
      explain: 'To a botanist, a fruit grows from the flower and holds the seeds, so the tomato is a fruit. The carrot is a root and the potato is a tuber, a swollen underground stem.',
      jev: {
        context: 'Three vegetables from the kitchen on a white background, side by side.',
        instructions: 'Which one in `card` is botanically a fruit?',
      },
    },
    [T('potato', 'Potato'), T('tomato', 'Tomato'), T('carrot', 'Carrot')],
    'vegetable',
  ),
  card(
    {
      id: 'true-berry-banana',
      title: 'The true berry',
      category: 'nature',
      difficulty: 3,
      prompt: 'Tap the true berry.',
      answer: 'banana',
      explain: 'Botanically, a berry is a fleshy fruit grown from a single ovary with the seeds inside, and the banana is one. The strawberry\'s seeds sit outside on swollen flower tissue, and raspberries and blackberries are clusters of tiny fruits.',
      jev: {
        context: 'Four fruits on a white background in a two by two grid.',
        instructions: 'Which fruit in `card` is a true berry in the botanical sense?',
      },
    },
    [T('strawberry', 'Strawberry'), T('raspberry', 'Raspberries'), T('banana', 'Banana'), T('blackberry', 'Blackberries')],
    'fruit',
  ),
  plugCard(
    {
      id: 'plug-country-uk',
      title: 'Three flat pins',
      category: 'objects',
      difficulty: 1,
      answer: 'united-kingdom',
      explain: 'This is Type G, with three thick rectangular pins, the plug of the United Kingdom. Germany uses round-pin Types C and F, and the United States and Japan use flat-bladed Types A and B.',
    },
    'plug-uk',
    ['Germany', 'United States', 'United Kingdom', 'Japan'],
  ),
  plugCard(
    {
      id: 'plug-country-switzerland',
      title: 'Hexagon with three pins',
      category: 'objects',
      difficulty: 2,
      answer: 'switzerland',
      explain: 'This is Type J: a hexagonal plug with three round pins, the earth pin set below the other two. It is used in Switzerland; Germany and Austria use Types C and F, and Italy\'s own plug has its three pins in a straight line.',
    },
    'plug-ch',
    ['Germany', 'Switzerland', 'Austria', 'Italy'],
  ),
  plugCard(
    {
      id: 'plug-country-italy',
      title: 'Three pins in a row',
      category: 'objects',
      difficulty: 3,
      answer: 'italy',
      explain: 'This is Type L, with three round pins in a straight line, the earth in the middle. It is used in Italy; France uses Type E, Spain Types C and F, and Switzerland Type J, whose earth pin sits lower.',
    },
    'plug-it',
    ['France', 'Switzerland', 'Spain', 'Italy'],
  ),
  plugCard(
    {
      id: 'plug-country-india',
      title: 'Three round pins in a triangle',
      category: 'objects',
      difficulty: 2,
      answer: 'india',
      explain: 'This is Type D, with three round pins in a triangle and a thicker earth pin on top. It is used in India; the United Kingdom uses Type G, Brazil Types C and N, and Japan Types A and B.',
    },
    'plug-in',
    ['United Kingdom', 'India', 'Brazil', 'Japan'],
  ),
  card(
    {
      id: 'plug-japan',
      title: 'Japanese plug',
      category: 'objects',
      difficulty: 2,
      prompt: 'Tap the plug used in Japan.',
      answer: 'plug-a',
      explain: 'Japan uses Type A, two flat parallel blades, the same shape as in North America. The others are the United Kingdom\'s Type G, Switzerland\'s Type J and India\'s Type D.',
      jev: {
        context: 'Four electrical plugs on a white background in a two by two grid.',
        instructions: 'Which plug in `card` is the kind used in Japan?',
      },
    },
    [T('plug-g', 'Type G (United Kingdom)', 'plug-uk'), T('plug-j', 'Type J (Switzerland)', 'plug-ch'), T('plug-d', 'Type D (India)', 'plug-in'), T('plug-a', 'Type A (Japan, North America)', 'plug-us')],
    'plug',
  ),
];

export default cards;
