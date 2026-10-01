import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { OcctKernel } from 'occt-wasm';

const here = dirname(fileURLToPath(import.meta.url));
const output = resolve(here, '../../testdata/step');
await mkdir(output, { recursive: true });

const kernel = await OcctKernel.init();

const plate = kernel.makeBox(100, 50, 3);
const holes = [
  kernel.translate(kernel.makeCylinder(3, 3), 17, 13, 0),
  kernel.translate(kernel.makeCylinder(4, 3), 73, 18, 0),
  kernel.translate(kernel.makeCylinder(2.5, 3), 81, 39, 0),
];
const asymmetric = kernel.cutAll(plate, holes);
await writeFile(resolve(output, 'asymmetric-plate-100x50mm.step'), kernel.exportStep(asymmetric));

const regression = kernel.makeBox(900, 297, 2);
await writeFile(resolve(output, 'regression-plate-900x297mm.step'), kernel.exportStep(regression));

const translated = kernel.translate(kernel.rotate(kernel.makeBox(100, 50, 3), {
  point: { x: 0, y: 0, z: 0 },
  direction: { x: 0, y: 0, z: 1 },
}, Math.PI / 5), 250_000, -180_000, 45_000);
await writeFile(resolve(output, 'translated-rotated-plate.step'), kernel.exportStep(translated));

const curved = kernel.makeCylinder(25, 80);
await writeFile(resolve(output, 'curved-cylinder.step'), kernel.exportStep(curved));

const inchPlate = kernel.makeBox(100 / 25.4, 50 / 25.4, 3 / 25.4);
let inchStep = kernel.exportStep(inchPlate);
const unitPattern = /(#\d+) = \( LENGTH_UNIT\(\) NAMED_UNIT\(\*\) SI_UNIT\(\.MILLI\.,\.METRE\.\) \);/;
const unitMatch = inchStep.match(unitPattern);
if (!unitMatch) throw new Error('Could not locate the exported STEP length unit');
const maxEntity = Math.max(...[...inchStep.matchAll(/#(\d+)/g)].map((match) => Number(match[1])));
const measure = maxEntity + 1;
const millimetre = maxEntity + 2;
const dimensions = maxEntity + 3;
inchStep = inchStep.replace(
  unitPattern,
  `${unitMatch[1]} = ( CONVERSION_BASED_UNIT('inch',#${measure}) LENGTH_UNIT() NAMED_UNIT(#${dimensions}) );`,
);
const finalEnd = inchStep.lastIndexOf('ENDSEC;');
inchStep = `${inchStep.slice(0, finalEnd)}#${measure} = LENGTH_MEASURE_WITH_UNIT(LENGTH_MEASURE(25.4),#${millimetre});\n#${millimetre} = ( LENGTH_UNIT() NAMED_UNIT(*) SI_UNIT(.MILLI.,.METRE.) );\n#${dimensions} = DIMENSIONAL_EXPONENTS(1.,0.,0.,0.,0.,0.,0.);\n${inchStep.slice(finalEnd)}`;
await writeFile(resolve(output, 'plate-100x50mm-authored-inches.step'), inchStep);

kernel.releaseAll();
console.log(`Wrote STEP fixtures to ${output}`);
