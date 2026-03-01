/**
 * ASCII Diffusion Engine Tests
 *
 * Run: npm test
 * (uses tsx to execute TypeScript directly)
 */

import {
  DEFAULT_DIFFUSION_CONFIG,
  getPhysicsApplicator,
  renderToString,
  renderToColorGrid,
  textToParticles,
  textToBlockParticles,
  gridToParticles,
  charToBrightness,
  SceneBuilder,
  transitionScenes,
  dissolveTransition,
  triggerExplosion,
  PRESETS,
} from '../src/index.js';
import type { AsciiParticle, ExtendedDiffusionConfig } from '../src/index.js';
import { resetIdCounter } from '../src/scene/text-to-particles.js';
import { resetGridIdCounter } from '../src/scene/grid-to-particles.js';

// ── Test runner ──

let passed = 0;
let failed = 0;
let currentGroup = '';

function group(name: string) {
  currentGroup = name;
  console.log(`\n--- ${name} ---`);
}

function assert(condition: boolean, message: string) {
  if (condition) {
    passed++;
    console.log(`  PASS: ${message}`);
  } else {
    failed++;
    console.error(`  FAIL: ${message}`);
  }
}

function assertApprox(actual: number, expected: number, tolerance: number, message: string) {
  assert(Math.abs(actual - expected) < tolerance, `${message} (got ${actual}, expected ~${expected})`);
}

// ── Helpers ──

function makeParticle(overrides: Partial<AsciiParticle> = {}): AsciiParticle {
  return {
    id: 0,
    homeX: 10,
    homeY: 10,
    currentX: 10,
    currentY: 10,
    vx: 0,
    vy: 0,
    t: 1,
    char: '#',
    brightness: 1.0,
    ...overrides,
  };
}

function defaultConfig(overrides: Partial<ExtendedDiffusionConfig> = {}): ExtendedDiffusionConfig {
  return { ...DEFAULT_DIFFUSION_CONFIG, ...overrides };
}

// ════════════════════════════════════════
//  TESTS
// ════════════════════════════════════════

// ── 1. Types & Defaults ──

group('Types & Defaults');

assert(DEFAULT_DIFFUSION_CONFIG.physicsMode === 'flow-matching', 'Default physics mode is flow-matching');
assert(DEFAULT_DIFFUSION_CONFIG.scatterRadius === 8, 'Default scatter radius is 8');
assert(DEFAULT_DIFFUSION_CONFIG.damping === 0.92, 'Default damping is 0.92');
assert(DEFAULT_DIFFUSION_CONFIG.epsilon === 0.01, 'Default epsilon is 0.01');
assert(DEFAULT_DIFFUSION_CONFIG.flowSpeed === 0.04, 'Default flow speed is 0.04');

// ── 2. Text to Particles ──

group('Text to Particles');

resetIdCounter();
const textParticles = textToParticles('Hi');
assert(textParticles.length === 2, 'Two chars "Hi" produces 2 particles');
assert(textParticles[0].char === 'H', 'First particle char is H');
assert(textParticles[1].char === 'i', 'Second particle char is i');
assert(textParticles[0].homeX === 0, 'First particle at x=0');
assert(textParticles[1].homeX === 1, 'Second particle at x=1');

resetIdCounter();
const multiline = textToParticles('AB\nCD');
assert(multiline.length === 4, 'Multiline "AB\\nCD" produces 4 particles');
assert(multiline[2].homeX === 0 && multiline[2].homeY === 1, 'Third particle at (0,1)');

resetIdCounter();
const withSpaces = textToParticles('A B');
assert(withSpaces.length === 2, 'Spaces are skipped');

resetIdCounter();
const offsetParticles = textToParticles('X', { offsetX: 5, offsetY: 3 });
assert(offsetParticles[0].homeX === 5 && offsetParticles[0].homeY === 3, 'Offset applied correctly');

resetIdCounter();
const scattered = textToParticles('X', { scattered: true, scatterRadius: 10 });
assert(scattered[0].t === 0, 'Scattered particles start with t=0');
const dx = scattered[0].currentX - scattered[0].homeX;
const dy = scattered[0].currentY - scattered[0].homeY;
assert(Math.abs(dx) <= 5 || Math.abs(dy) <= 5, 'Scattered particle displaced from home');

// ── 3. Block Text ──

group('Block Text');

resetIdCounter();
const blockA = textToBlockParticles('A');
assert(blockA.length > 0, 'Block text "A" produces particles');
// A glyph has: row0='  #  '(1), row1=' # # '(2), row2='#####'(5), row3='#   #'(2), row4='#   #'(2) = 12
assert(blockA.length === 12, `Block "A" has 12 particles (got ${blockA.length})`);
assert(blockA.every((p) => p.char === '#'), 'All block particles use # character');

// ── 4. Grid to Particles ──

group('Grid to Particles');

resetGridIdCounter();
const grid = ['##', '# '];
const gridParticles = gridToParticles(grid);
assert(gridParticles.length === 3, 'Grid "## / # " produces 3 particles (space skipped)');

// ── 5. charToBrightness ──

group('Char Brightness');

assert(charToBrightness(' ') === 0, 'Space has brightness 0');
assert(charToBrightness('@') === 1, '@ has brightness 1');
assert(charToBrightness('#') > charToBrightness('.'), '# is brighter than .');
assertApprox(charToBrightness('z'), 0.7, 0.01, 'Unknown chars get 0.7 brightness');

// ── 6. Renderer ──

group('Renderer');

const renderParticles: AsciiParticle[] = [
  makeParticle({ homeX: 0, homeY: 0, currentX: 0, currentY: 0, char: 'A', brightness: 1.0 }),
  makeParticle({ homeX: 2, homeY: 0, currentX: 2, currentY: 0, char: 'B', brightness: 0.5 }),
  makeParticle({ homeX: 1, homeY: 1, currentX: 1, currentY: 1, char: 'C', brightness: 0.8 }),
];

const rendered = renderToString(renderParticles, 4, 2);
const lines = rendered.split('\n');
assert(lines.length === 2, 'Rendered output has 2 lines');
assert(lines[0] === 'A B ', 'First line has A at 0, space, B at 2, space');
assert(lines[1] === ' C  ', 'Second line has C at position 1');

// Brightest-wins test
const overlapping: AsciiParticle[] = [
  makeParticle({ currentX: 0, currentY: 0, char: 'X', brightness: 0.3 }),
  makeParticle({ currentX: 0, currentY: 0, char: 'Y', brightness: 0.9 }),
];
const overlapRendered = renderToString(overlapping, 2, 1);
assert(overlapRendered.startsWith('Y'), 'Brightest particle wins (Y over X)');

// Color grid
const colorGrid = renderToColorGrid(renderParticles, 4, 2);
assert(colorGrid[0][0].char === 'A', 'Color grid has A at (0,0)');
assert(colorGrid[0][1].char === ' ', 'Color grid has space at (0,1)');

// ── 7. Physics Dispatcher ──

group('Physics Dispatcher');

const modes = ['flow-matching', 'diffusion', 'gravity', 'vortex', 'explosion', 'wave'] as const;
for (const mode of modes) {
  const applicator = getPhysicsApplicator(mode);
  assert(typeof applicator.apply === 'function', `${mode} applicator has apply method`);
}

// ── 8. Flow Matching Physics ──

group('Flow Matching Physics');

// Test: particle away from home converges
const flowApplicator = getPhysicsApplicator('flow-matching');
const flowParticle = makeParticle({ currentX: 20, currentY: 20, homeX: 10, homeY: 10, t: 0 });
const flowConfig = defaultConfig();

// Run 200 steps
for (let i = 0; i < 200; i++) {
  flowApplicator.apply([flowParticle], null, flowConfig, 33);
}

assertApprox(flowParticle.currentX, 10, 0.5, 'Flow matching converges X to home');
assertApprox(flowParticle.currentY, 10, 0.5, 'Flow matching converges Y to home');
assert(flowParticle.t === 1, 'Flow time reaches 1 after convergence');
assertApprox(flowParticle.vx, 0, 0.01, 'Velocity is ~0 after convergence');

// Test: no oscillation — particle should not overshoot
const flowP2 = makeParticle({ currentX: 30, currentY: 10, homeX: 10, homeY: 10, t: 0 });
let lastDist = Infinity;
let overshotCount = 0;
for (let i = 0; i < 100; i++) {
  flowApplicator.apply([flowP2], null, flowConfig, 33);
  const dist = Math.abs(flowP2.currentX - flowP2.homeX);
  if (dist > lastDist + 0.5) {
    overshotCount++;
  }
  lastDist = dist;
}
assert(overshotCount <= 2, `Flow matching has minimal overshoot (overshoot count: ${overshotCount})`);

// ── 9. Diffusion Physics ──

group('Diffusion Physics');

const diffApplicator = getPhysicsApplicator('diffusion');
const diffParticle = makeParticle({ currentX: 20, currentY: 20, homeX: 10, homeY: 10 });

for (let i = 0; i < 200; i++) {
  diffApplicator.apply([diffParticle], null, defaultConfig(), 33);
}

assertApprox(diffParticle.currentX, 10, 1.0, 'Diffusion converges X to home');
assertApprox(diffParticle.currentY, 10, 1.0, 'Diffusion converges Y to home');

// ── 10. Mouse Repulsion ──

group('Mouse Repulsion');

const repelParticle = makeParticle({ currentX: 10, currentY: 10 });
const mousePos = { x: 10, y: 10 };

// Diffusion mode repels
diffApplicator.apply([repelParticle], { x: 9, y: 10 }, defaultConfig(), 33);
assert(repelParticle.vx > 0, 'Particle pushed away from mouse (positive vx)');

// Flow matching resets t
const flowRepelP = makeParticle({ currentX: 10, currentY: 10, t: 0.8 });
flowApplicator.apply([flowRepelP], { x: 9, y: 10 }, defaultConfig({ resetOnScatter: true }), 33);
assert(flowRepelP.t < 0.8, 'Flow matching resets t on mouse scatter');

// ── 11. Gravity Mode ──

group('Gravity Mode');

const gravApplicator = getPhysicsApplicator('gravity');
const gravParticle = makeParticle({ currentX: 15, currentY: 10 });
gravApplicator.apply([gravParticle], { x: 10, y: 10 }, defaultConfig(), 33);
assert(gravParticle.vx < 0, 'Gravity attracts toward mouse (negative vx when particle is to the right)');

// ── 12. Explosion Mode ──

group('Explosion Mode');

const explodeParticles = [
  makeParticle({ currentX: 11, currentY: 10 }),
  makeParticle({ currentX: 12, currentY: 10 }),
  makeParticle({ currentX: 50, currentY: 50 }),
];
triggerExplosion(explodeParticles, { x: 10, y: 10 }, 5, 20);
assert(explodeParticles[0].vx !== 0 || explodeParticles[0].vy !== 0, 'Nearby particle gets explosive velocity');
assert(explodeParticles[2].vx === 0 && explodeParticles[2].vy === 0, 'Far particle is unaffected');

// ── 13. Scene Builder ──

group('Scene Builder');

resetIdCounter();
resetGridIdCounter(1000);

const scene = new SceneBuilder(80, 24)
  .addText('Hello', { offsetX: 5, offsetY: 2 })
  .setConfig({ scatterRadius: 10 })
  .build();

assert(scene.width === 80, 'Scene width is 80');
assert(scene.height === 24, 'Scene height is 24');
assert(scene.particles.length === 5, 'Scene has 5 particles (Hello)');
assert(scene.config.scatterRadius === 10, 'Scene config override applied');

// Multi-source scene
resetIdCounter();
resetGridIdCounter(2000);
const multiScene = new SceneBuilder(80, 24)
  .addText('AB', { offsetX: 0, offsetY: 0 })
  .addGrid(['XY'], { offsetX: 0, offsetY: 1 })
  .build();

assert(multiScene.particles.length === 4, 'Multi-source scene has 4 particles');

// ── 14. Transitions ──

group('Transitions');

resetIdCounter();
const scene1 = new SceneBuilder(20, 5)
  .addText('AB', { offsetX: 0, offsetY: 0 })
  .build();

resetIdCounter();
const scene2 = new SceneBuilder(20, 5)
  .addText('XYZ', { offsetX: 0, offsetY: 0 })
  .build();

// Instant transition
const instant = transitionScenes(scene1, scene2, 'instant');
assert(instant.particles.length === 3, 'Instant transition has target particle count');
assert(instant.particles[0].char === 'X', 'Instant transition uses target chars');

// Morph transition
const morphed = transitionScenes(scene1, scene2, 'morph');
assert(morphed.particles.length === 3, 'Morph transition includes all target particles');
assert(morphed.particles[0].t === 0, 'Morphed particles have t=0 for return journey');
// First two should reuse old positions
assert(morphed.particles[0].char === 'X', 'Morphed particle 0 has new char');

// Dissolve transition
const dissolved50 = dissolveTransition(scene1, scene2, 0.5);
assert(dissolved50.particles.length === scene1.particles.length + scene2.particles.length,
  'Dissolve at 50% has particles from both scenes');
const oldBrightness = dissolved50.particles[0].brightness;
assert(oldBrightness < 1.0, 'Old particles have reduced brightness in dissolve');

// ── 15. Presets ──

group('Presets');

assert(PRESETS.gentle.scatterRadius === 5, 'Gentle preset has scatter radius 5');
assert(PRESETS.snappy.springK === 0.15, 'Snappy preset has springK 0.15');
assert(PRESETS.magnetic.physicsMode === 'gravity', 'Magnetic preset uses gravity mode');
assert(PRESETS.flow.physicsMode === 'flow-matching', 'Flow preset uses flow-matching mode');

// ── 16. Full Integration: Build scene → run physics → render ──

group('Integration: Scene → Physics → Render');

resetIdCounter();
const intScene = new SceneBuilder(20, 5)
  .addText('Hi!', { offsetX: 1, offsetY: 1, scattered: true, scatterRadius: 15 })
  .build();

const intApplicator = getPhysicsApplicator('flow-matching');

// Particles start scattered
const initialRender = renderToString(intScene.particles, 20, 5);
assert(initialRender.includes(' '), 'Initially scattered, grid has spaces');

// Run physics for many frames
for (let i = 0; i < 300; i++) {
  intApplicator.apply(intScene.particles, null, intScene.config, 33);
}

const finalRender = renderToString(intScene.particles, 20, 5);
const finalLines = finalRender.split('\n');
// After convergence, "Hi!" should be at row 1, columns 1-3
assert(finalLines[1][1] === 'H', 'After convergence, H is at correct position');
assert(finalLines[1][2] === 'i', 'After convergence, i is at correct position');
assert(finalLines[1][3] === '!', 'After convergence, ! is at correct position');

// ── Summary ──

console.log(`\n${'='.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`${'='.repeat(40)}`);

if (failed > 0) {
  process.exit(1);
}
