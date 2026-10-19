/**
 * Nature cards: AI-generated photos of lookalike animals and plants (OpenAI gpt-image-2.5 Sunburst through Opper), the
 * player taps the one the prompt names. Same layout as objects2.ts. The pictures, downscaled, are in
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
      id: 'seabird-razorbill',
      title: 'Razorbill',
      category: 'animals',
      difficulty: 3,
      prompt: 'Tap the razorbill.',
      answer: 'razorbill',
      explain: 'The razorbill has a thick, blunt black bill crossed by a thin white line. The puffin\'s bill is big and striped orange, and the African penguin has a slim pointed bill and a black band across its chest.',
      jev: {
        context: 'Three black and white seabirds standing upright on a white background, side by side.',
        instructions: 'Which bird in `card` is the razorbill?',
      },
    },
    [T('african-penguin', 'African penguin'), T('razorbill', 'Razorbill'), T('puffin', 'Atlantic puffin')],
    'bird',
  ),
  card(
    {
      id: 'owl-barn-owl',
      title: 'Barn owl',
      category: 'animals',
      difficulty: 1,
      prompt: 'Tap the barn owl.',
      answer: 'barn-owl',
      explain: 'The barn owl has a white heart-shaped face and dark eyes. The snowy owl is white all over with yellow eyes, and the eagle-owl has orange eyes and ear tufts.',
      jev: {
        context: 'Three owls perched on stumps on a white background, side by side.',
        instructions: 'Which owl in `card` is the barn owl?',
      },
    },
    [T('snowy-owl', 'Snowy owl'), T('eagle-owl', 'Eurasian eagle-owl'), T('barn-owl', 'Barn owl')],
    'owl',
  ),
  card(
    {
      id: 'amphibian-toad',
      title: 'Toad',
      category: 'animals',
      difficulty: 2,
      prompt: 'Tap the toad.',
      answer: 'common-toad',
      explain: 'The toad has dry, warty skin, a squat body and short legs for crawling. The common frog has smooth, moist skin and long legs for leaping, and the red-eyed tree frog is a smooth green climber.',
      jev: {
        context: 'Three amphibians sitting on a white background, side by side.',
        instructions: 'Which animal in `card` is the toad?',
      },
    },
    [T('common-toad', 'Common toad'), T('tree-frog', 'Red-eyed tree frog'), T('common-frog', 'Common frog')],
    'animal',
  ),
  card(
    {
      id: 'marine-dolphin',
      title: 'Which one is a dolphin',
      category: 'animals',
      difficulty: 3,
      prompt: 'Tap the dolphin.',
      answer: 'orca',
      explain: 'The orca, or killer whale, is the largest member of the dolphin family. The beluga is a toothed whale from a different family, the great white shark is a fish, and the manatee is a sea cow.',
      jev: {
        context: 'Four large sea animals swimming on a white background in a two by two grid.',
        instructions: 'Which animal in `card` is a dolphin?',
      },
    },
    [T('great-white-shark', 'Great white shark'), T('beluga', 'Beluga whale'), T('manatee', 'Manatee'), T('orca', 'Orca (killer whale)')],
    'animal',
  ),
  card(
    {
      id: 'leaf-ginkgo',
      title: 'Ginkgo leaf',
      category: 'nature',
      difficulty: 1,
      prompt: 'Tap the ginkgo leaf.',
      answer: 'ginkgo-leaf',
      explain: 'The ginkgo leaf is a little fan with fine veins running straight out from the stalk and a notch in its top edge. The oak leaf has rounded lobes, the maple leaf has five pointed lobes, and the horse chestnut leaf is a hand of separate leaflets.',
      jev: {
        context: 'Four tree leaves lying flat on a white background in a two by two grid.',
        instructions: 'Which leaf in `card` is the ginkgo leaf?',
      },
    },
    [T('oak-leaf', 'Oak'), T('maple-leaf', 'Maple'), T('ginkgo-leaf', 'Ginkgo'), T('chestnut-leaf', 'Horse chestnut')],
    'leaf',
  ),
  card(
    {
      id: 'flower-iris',
      title: 'Iris',
      category: 'nature',
      difficulty: 2,
      prompt: 'Tap the iris.',
      answer: 'iris',
      explain: 'The iris has three petals standing up and three drooping "falls" with fuzzy yellow beards. The tulip is a smooth cup, the lily a flared trumpet with long stamens, and the daffodil has a trumpet in the middle of its petals.',
      jev: {
        context: 'Four single flowers on their stems on a white background in a two by two grid.',
        instructions: 'Which flower in `card` is the iris?',
      },
    },
    [T('tulip', 'Tulip'), T('lily', 'Easter lily'), T('daffodil', 'Daffodil'), T('iris', 'Bearded iris')],
    'flower',
  ),
  card(
    {
      id: 'mushroom-chanterelle',
      title: 'Chanterelle',
      category: 'nature',
      difficulty: 2,
      prompt: 'Tap the chanterelle.',
      answer: 'chanterelle',
      explain: 'The chanterelle is golden yellow and funnel-shaped, with blunt ridges that run down the stem instead of true gills. The fly agaric is red with white spots, the porcini has a brown bun cap on a fat stem, and the morel has a pitted honeycomb cap.',
      jev: {
        context: 'Four wild mushrooms on a white background in a two by two grid.',
        instructions: 'Which mushroom in `card` is the chanterelle?',
      },
    },
    [T('fly-agaric', 'Fly agaric'), T('chanterelle', 'Chanterelle'), T('morel', 'Morel'), T('porcini', 'Porcini')],
    'mushroom',
  ),
  card(
    {
      id: 'seashell-cowrie',
      title: 'Cowrie',
      category: 'nature',
      difficulty: 2,
      prompt: 'Tap the cowrie.',
      answer: 'cowrie',
      explain: 'The cowrie is a smooth, glossy, egg-shaped shell with no visible spiral. The scallop is a ribbed fan, the conch has spikes and a flared pink lip, and the nautilus is a striped coil.',
      jev: {
        context: 'Four seashells on a white background in a two by two grid.',
        instructions: 'Which shell in `card` is the cowrie?',
      },
    },
    [T('scallop', 'Scallop'), T('nautilus', 'Nautilus'), T('cowrie', 'Tiger cowrie'), T('conch', 'Queen conch')],
    'shell',
  ),
  card(
    {
      id: 'lizard-iguana',
      title: 'Iguana',
      category: 'animals',
      difficulty: 2,
      prompt: 'Tap the iguana.',
      answer: 'iguana',
      explain: 'The green iguana has a big hanging dewlap under its chin, a row of spines down its back and a very long tail. The chameleon has turret eyes and a curled tail, and the bearded dragon is a flat, sandy lizard with a spiky beard.',
      jev: {
        context: 'Three lizards on a white background, side by side.',
        instructions: 'Which lizard in `card` is the iguana?',
      },
    },
    [T('chameleon', 'Veiled chameleon'), T('iguana', 'Green iguana'), T('bearded-dragon', 'Bearded dragon')],
    'lizard',
  ),
  card(
    {
      id: 'beetle-rhinoceros',
      title: 'Rhinoceros beetle',
      category: 'animals',
      difficulty: 2,
      prompt: 'Tap the rhinoceros beetle.',
      answer: 'rhino-beetle',
      explain: 'The rhinoceros beetle has a long curved horn growing up from its head, like a rhino. The stag beetle\'s "antlers" are a pair of giant jaws, and the ladybird has no horn at all.',
      jev: {
        context: 'Three beetles seen from above on a white background, side by side.',
        instructions: 'Which beetle in `card` is the rhinoceros beetle?',
      },
    },
    [T('stag-beetle', 'Stag beetle'), T('ladybird', 'Seven-spot ladybird'), T('rhino-beetle', 'Rhinoceros beetle')],
    'beetle',
  ),
  card(
    {
      id: 'relative-okapi',
      title: 'Giraffe\'s cousin',
      category: 'animals',
      difficulty: 3,
      prompt: 'Tap the giraffe\'s closest relative.',
      answer: 'okapi',
      explain: 'The okapi has zebra-like stripes on its legs, but it is the only living relative of the giraffe. Zebras are horses, and tapirs are related to horses and rhinos.',
      jev: {
        context: 'Three hoofed animals standing on a white background, side by side.',
        instructions: 'Which animal in `card` is the closest living relative of the giraffe?',
      },
    },
    [T('zebra', 'Plains zebra'), T('okapi', 'Okapi'), T('tapir', 'Malayan tapir')],
    'animal',
  ),
  card(
    {
      id: 'wader-flamingo',
      title: 'Flamingo',
      category: 'animals',
      difficulty: 1,
      prompt: 'Tap the flamingo.',
      answer: 'flamingo',
      explain: 'The flamingo\'s thick bill bends sharply down in the middle. The roseate spoonbill is also pink but has a flat spoon-tipped bill, and the scarlet ibis has a thin curved bill.',
      jev: {
        context: 'Three pink or red wading birds on a white background, side by side.',
        instructions: 'Which bird in `card` is the flamingo?',
      },
    },
    [T('spoonbill', 'Roseate spoonbill'), T('scarlet-ibis', 'Scarlet ibis'), T('flamingo', 'American flamingo')],
    'bird',
  ),
  card(
    {
      id: 'bill-hornbill',
      title: 'Hornbill',
      category: 'animals',
      difficulty: 2,
      prompt: 'Tap the hornbill.',
      answer: 'hornbill',
      explain: 'The hornbill wears a big casque, a helmet-like horn on top of its bill. The toucan has a huge bill with nothing on top, and the macaw is a parrot with a short hooked beak.',
      jev: {
        context: 'Three big-billed birds perched on branches on a white background, side by side.',
        instructions: 'Which bird in `card` is the hornbill?',
      },
    },
    [T('hornbill', 'Great hornbill'), T('toucan', 'Toco toucan'), T('macaw', 'Scarlet macaw')],
    'bird',
  ),
  card(
    {
      id: 'carnivorous-sundew',
      title: 'Sundew',
      category: 'nature',
      difficulty: 3,
      prompt: 'Tap the sundew.',
      answer: 'sundew',
      explain: 'The sundew catches insects on red hairs tipped with sticky droplets. The Venus flytrap snaps shut with toothed jaws, and the pitcher plant drowns insects in hanging cups.',
      jev: {
        context: 'Three carnivorous plants on a white background, side by side.',
        instructions: 'Which plant in `card` is the sundew?',
      },
    },
    [T('flytrap', 'Venus flytrap'), T('sundew', 'Cape sundew'), T('pitcher-plant', 'Pitcher plant')],
    'plant',
  ),
];

export default cards;
