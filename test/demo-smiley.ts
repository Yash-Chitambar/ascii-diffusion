/**
 * Visual demo: random scattered particles converge into a smiley face.
 *
 * Run: npx tsx test/demo-smiley.ts
 */

import { SceneBuilder, getPhysicsApplicator, renderToString } from '../src/index.js';
import { resetIdCounter } from '../src/scene/text-to-particles.js';
import { resetGridIdCounter } from '../src/scene/grid-to-particles.js';

// ── Smiley face ASCII art ──

const smiley = [
  '    ########    ',
  '  ##        ##  ',
  ' #            # ',
  '#   ##    ##   #',
  '#   ##    ##   #',
  '#              #',
  '#  #        #  #',
  '#   #      #   #',
  ' #   ######   # ',
  '  ##        ##  ',
  '    ########    ',
];

// ── Build scene with scattered start ──

resetIdCounter();
resetGridIdCounter();

const W = 40;
const H = 15;

const scene = new SceneBuilder(W, H)
  .addGrid(smiley, { offsetX: 12, offsetY: 2, scattered: true, scatterRadius: 30 })
  .setConfig({
    physicsMode: 'flow-matching',
    scatterRadius: 8,
    scatterForce: 0.8,
    damping: 0.92,
    flowSpeed: 0.03,
    epsilon: 0.01,
  })
  .build();

const applicator = getPhysicsApplicator('flow-matching');

// ── Animate in terminal ──

const TOTAL_FRAMES = 120;
const FRAME_MS = 33; // ~30fps

let frame = 0;

function tick() {
  // Clear screen + move cursor to top
  process.stdout.write('\x1b[2J\x1b[H');

  // Run physics
  applicator.apply(scene.particles, null, scene.config, FRAME_MS);

  // Render
  const output = renderToString(scene.particles, W, H);

  // Draw with border
  const border = '+' + '-'.repeat(W) + '+';
  console.log(`\x1b[36m${border}\x1b[0m`);
  for (const line of output.split('\n')) {
    console.log(`\x1b[36m|\x1b[33m${line}\x1b[36m|\x1b[0m`);
  }
  console.log(`\x1b[36m${border}\x1b[0m`);

  // Stats
  const avgT = scene.particles.reduce((s, p) => s + p.t, 0) / scene.particles.length;
  const settled = scene.particles.filter((p) => p.t === 1).length;
  console.log(`\nFrame ${frame + 1}/${TOTAL_FRAMES}  |  avg t: ${avgT.toFixed(3)}  |  settled: ${settled}/${scene.particles.length}`);
  console.log('\x1b[2mFlow matching: particles converge without oscillation\x1b[0m');

  frame++;
  if (frame < TOTAL_FRAMES) {
    setTimeout(tick, FRAME_MS);
  } else {
    console.log('\n\x1b[32mDone! All particles arrived home.\x1b[0m');
  }
}

tick();
