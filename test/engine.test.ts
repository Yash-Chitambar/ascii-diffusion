/**
 * ASCII Diffusion Engine Tests
 *
 * Run: npm test
 * (uses tsx to execute TypeScript directly)
 */

// Import directly from source modules to avoid pulling in React dependencies
import type { AsciiParticle, AsciiScene, ExtendedDiffusionConfig } from '../src/core/types.js';
import { DEFAULT_DIFFUSION_CONFIG } from '../src/core/types.js';
import { getPhysicsApplicator } from '../src/core/physics.js';
import { renderToString, renderToColorGrid, colorGridToHtml, escapeHtml } from '../src/core/renderer.js';
import { TrailMap } from '../src/core/trail-map.js';
import { SpatialHash } from '../src/core/spatial-hash.js';
import { triggerShow, triggerHide, allParticlesHome } from '../src/core/lifecycle.js';
import { applyFlowReturn } from '../src/physics-modes/flow-matching.js';
import { triggerExplosion } from '../src/physics-modes/explosion.js';
import { textToParticles, textToBlockParticles, resetIdCounter } from '../src/scene/text-to-particles.js';
import { gridToParticles, charToBrightness, resetGridIdCounter } from '../src/scene/grid-to-particles.js';
import { SceneBuilder } from '../src/scene/scene-builder.js';
import { transitionScenes, dissolveTransition } from '../src/scene/transitions.js';
import { reassignParticlesToHomes, geneticReassign, assignClusterCentroids } from '../src/scene/assignment.js';
import type { HomeSlot } from '../src/scene/assignment.js';
import { PRESETS } from '../src/presets/index.js';

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

// Brightest-wins test (set home = current to avoid char morph substitution)
const overlapping: AsciiParticle[] = [
  makeParticle({ homeX: 0, homeY: 0, currentX: 0, currentY: 0, char: 'X', brightness: 0.3 }),
  makeParticle({ homeX: 0, homeY: 0, currentX: 0, currentY: 0, char: 'Y', brightness: 0.9 }),
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
assert(PRESETS.magnetic.physicsMode === 'magnetic', 'Magnetic preset uses magnetic mode');
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

// ── 17. TrailMap ──

group('TrailMap');

const trail = new TrailMap();
trail.addPoint(5, 5); // First call initializes, no point stored
assert(trail.length === 0, 'First addPoint initializes only');
trail.addPoint(10, 10); // This stores a point
assert(trail.length === 1, 'Second addPoint stores a trail point');

// Need to advance age so bloom-in produces non-zero intensity
trail.update(); // age 1, now within bloom window
const s1 = trail.sample(10, 10, 5);
assert(s1.strength > 0, 'Sample at trail point has positive strength');

// Sample far away should return zero
const s2 = trail.sample(100, 100, 5);
assert(s2.strength === 0, 'Sample far from trail has zero strength');

// Update ages points; after maxAge frames they expire
const trail2 = new TrailMap();
trail2.addPoint(0, 0);
trail2.addPoint(1, 1, 3); // maxAge = 3
assert(trail2.length === 1, 'Trail has 1 point after init + addPoint');
trail2.update(); // age 1
trail2.update(); // age 2
trail2.update(); // age 3 = maxAge, still alive
assert(trail2.length === 1, 'Trail point alive at maxAge');
trail2.update(); // age 4 > maxAge, expired
assert(trail2.length === 0, 'Trail point expired after maxAge');

// Clear resets everything
const trail3 = new TrailMap();
trail3.addPoint(0, 0);
trail3.addPoint(5, 5);
trail3.addPoint(10, 10);
assert(trail3.length === 2, 'Trail has 2 points before clear');
trail3.clear();
assert(trail3.length === 0, 'Trail empty after clear');

// ── 18. SpatialHash ──

group('SpatialHash');

const hash = new SpatialHash(5);
const sp1 = makeParticle({ id: 1, currentX: 2, currentY: 2 });
const sp2 = makeParticle({ id: 2, currentX: 3, currentY: 3 });
const sp3 = makeParticle({ id: 3, currentX: 50, currentY: 50 });
hash.insert(sp1);
hash.insert(sp2);
hash.insert(sp3);

const nearby = hash.query(2, 2, 5);
assert(nearby.length === 2, 'SpatialHash finds 2 nearby particles');
assert(nearby.some(p => p.id === 1) && nearby.some(p => p.id === 2), 'Found correct nearby particles');

const farQuery = hash.query(2, 2, 1);
assert(farQuery.length === 1, 'Tight radius finds only closest particle');

const emptyQuery = hash.query(100, 100, 2);
assert(emptyQuery.length === 0, 'Query in empty area returns nothing');

// ── 19. Lifecycle ──

group('Lifecycle');

resetIdCounter();
const lifeScene: AsciiScene = new SceneBuilder(40, 20)
  .addText('Test', { offsetX: 10, offsetY: 10 })
  .build();
const lifeParticles = lifeScene.particles;

// All particles start at home (t=1)
assert(allParticlesHome(lifeParticles), 'Particles start at home');

// triggerShow scatters them
triggerShow(lifeParticles, lifeScene);
assert(!allParticlesHome(lifeParticles), 'Particles not home after triggerShow');
assert(lifeParticles.every(p => p.t < 0), 'triggerShow sets negative t for stagger');
assert(
  lifeParticles.some(p => Math.abs(p.currentX - p.homeX) > 1),
  'triggerShow scatters positions',
);

// triggerHide sets t > 1 and gives outward velocity
resetIdCounter();
const hideScene: AsciiScene = new SceneBuilder(40, 20)
  .addText('AB', { offsetX: 15, offsetY: 10 })
  .build();
triggerHide(hideScene.particles, hideScene);
assert(hideScene.particles.every(p => p.t === 2), 'triggerHide sets t=2');
assert(hideScene.particles.every(p => p.vx !== 0 || p.vy !== 0), 'triggerHide gives velocity');

// allParticlesHome with mixed t values
const mixedParticles = [makeParticle({ t: 1 }), makeParticle({ t: 0.5 })];
assert(!allParticlesHome(mixedParticles), 'Not all home when one has t < 1');

// ── 20. applyFlowReturn ──

group('applyFlowReturn');

const frP = makeParticle({ currentX: 20, currentY: 20, homeX: 10, homeY: 10, t: 0 });
// Run until converged
for (let i = 0; i < 100; i++) {
  applyFlowReturn(frP, 0.04, 1);
}
assertApprox(frP.currentX, 10, 0.5, 'applyFlowReturn converges X');
assertApprox(frP.currentY, 10, 0.5, 'applyFlowReturn converges Y');
assert(frP.t === 1, 'applyFlowReturn reaches t=1');

// Already home — should be no-op
const frHome = makeParticle({ t: 1 });
const beforeX = frHome.currentX;
applyFlowReturn(frHome, 0.04, 1);
assert(frHome.currentX === beforeX, 'applyFlowReturn is no-op when t=1');

// ── 21. Magnetic Physics ──

group('Magnetic Physics');

const magApplicator = getPhysicsApplicator('magnetic');
assert(typeof magApplicator.apply === 'function', 'Magnetic applicator exists');

// Magnetic pulls TOWARD mouse (unlike diffusion which pushes away)
const magP = makeParticle({ currentX: 15, currentY: 10, t: 1 });
const magConfig = defaultConfig({ physicsMode: 'magnetic', scatterRadius: 20, scatterForce: 2 });
magApplicator.apply([magP], { x: 10, y: 10 }, magConfig, 33);
assert(magP.vx < 0, 'Magnetic pulls toward mouse (negative vx when right of mouse)');
assert(magP.t < 1, 'Magnetic resets t on attraction (flow return advances it slightly from 0)');

// Without mouse, flow matching returns particle home
const magP2 = makeParticle({ currentX: 20, currentY: 20, homeX: 10, homeY: 10, t: 0 });
for (let i = 0; i < 200; i++) {
  magApplicator.apply([magP2], null, magConfig, 33);
}
assertApprox(magP2.currentX, 10, 0.5, 'Magnetic returns home via flow matching');

// ── 22. Assignment ──

group('Assignment');

const assignParticles: AsciiParticle[] = [
  makeParticle({ id: 0, currentX: 0, currentY: 0 }),
  makeParticle({ id: 1, currentX: 10, currentY: 10 }),
];
const homes: HomeSlot[] = [
  { x: 9, y: 9, char: 'A', brightness: 1 },
  { x: 1, y: 1, char: 'B', brightness: 0.5 },
];

reassignParticlesToHomes(assignParticles, homes);
// Particle at (0,0) should get home (1,1), particle at (10,10) should get (9,9)
assert(assignParticles[0].homeX === 1 && assignParticles[0].homeY === 1,
  'Greedy assigns nearest home to particle 0');
assert(assignParticles[1].homeX === 9 && assignParticles[1].homeY === 9,
  'Greedy assigns nearest home to particle 1');
assert(assignParticles[0].char === 'B', 'Assignment updates char');
assert(assignParticles[1].brightness === 1, 'Assignment updates brightness');

// geneticReassign should also work (at least not crash, and produce valid output)
const genParticles: AsciiParticle[] = [
  makeParticle({ id: 0, currentX: 0, currentY: 0 }),
  makeParticle({ id: 1, currentX: 5, currentY: 5 }),
  makeParticle({ id: 2, currentX: 10, currentY: 10 }),
];
const genHomes: HomeSlot[] = [
  { x: 10, y: 10, char: 'X', brightness: 1 },
  { x: 5, y: 5, char: 'Y', brightness: 0.8 },
  { x: 0, y: 0, char: 'Z', brightness: 0.6 },
];
geneticReassign(genParticles, genHomes, 3);
// Each particle should have a valid home from the homes list
const homeSet = new Set(genHomes.map(h => `${h.x},${h.y}`));
assert(genParticles.every(p => homeSet.has(`${p.homeX},${p.homeY}`)),
  'Genetic reassign assigns valid homes');

// Empty inputs should not crash
reassignParticlesToHomes([], []);
geneticReassign([], [], 3);
assert(true, 'Empty assignment does not crash');

// ── 23. assignClusterCentroids ──

group('Cluster Centroids');

const clusterParticles: AsciiParticle[] = [
  makeParticle({ id: 0, homeX: 1, homeY: 1 }),
  makeParticle({ id: 1, homeX: 2, homeY: 1 }),
  makeParticle({ id: 2, homeX: 1, homeY: 2 }),
];
assignClusterCentroids(clusterParticles, 20, 20);

// All 3 particles should be in the same cluster cell
assert(clusterParticles[0].clusterX !== undefined, 'clusterX assigned');
assert(clusterParticles[0].clusterY !== undefined, 'clusterY assigned');
// All in same cell → same centroid
const cx = clusterParticles[0].clusterX!;
const cy = clusterParticles[0].clusterY!;
assert(
  clusterParticles.every(p => p.clusterX === cx && p.clusterY === cy),
  'Nearby particles share same cluster centroid',
);
// Centroid should be average of homes: (1+2+1)/3 = 1.333, (1+1+2)/3 = 1.333
assertApprox(cx, 4 / 3, 0.01, 'Cluster centroid X is average of home X');
assertApprox(cy, 4 / 3, 0.01, 'Cluster centroid Y is average of home Y');

// Empty input
assignClusterCentroids([], 20, 20);
assert(true, 'Empty cluster centroids does not crash');

// ── 24. Renderer: escapeHtml & colorGridToHtml ──

group('Renderer Utilities');

assert(escapeHtml('<b>') === '&lt;b&gt;', 'escapeHtml escapes angle brackets');
assert(escapeHtml('a&b') === 'a&amp;b', 'escapeHtml escapes ampersand');
assert(escapeHtml('hello') === 'hello', 'escapeHtml leaves clean text alone');

// colorGridToHtml
const colorCells = [
  [
    { char: 'A', color: 'red' },
    { char: 'B', color: 'red' },
    { char: 'C', color: 'blue' },
  ],
];
const html = colorGridToHtml(colorCells, '#fff');
assert(html.includes('<span style="color:red">AB</span>'), 'RLE groups same-color chars');
assert(html.includes('<span style="color:blue">C</span>'), 'Different color gets new span');

// Fallback color
const nullColorCells = [[{ char: 'X', color: null }]];
const htmlFallback = colorGridToHtml(nullColorCells, '#00ff00');
assert(htmlFallback.includes('color:#00ff00'), 'Null color uses fallback');

// ── 25. Renderer: char morph ──

group('Renderer Char Morph');

// Particle far from home should get scatter char
const farParticle = makeParticle({
  currentX: 50, currentY: 50, homeX: 10, homeY: 10, char: '#', brightness: 1,
});
const morphConfig = defaultConfig({ charMorphEnabled: true, charMorphThreshold: 3.0 });
const morphRender = renderToString([farParticle], 60, 60, morphConfig);
// The rendered char should NOT be '#' since distance > threshold
const renderedChar = morphRender.split('\n')[50][50];
assert(renderedChar !== '#', 'Far particle gets scatter char substitution');
assert(renderedChar !== ' ', 'Far particle still renders (not invisible)');

// Particle at home should keep its own char
const homeParticle = makeParticle({
  currentX: 5, currentY: 5, homeX: 5, homeY: 5, char: '#', brightness: 1,
});
const homeRender = renderToString([homeParticle], 10, 10, morphConfig);
assert(homeRender.split('\n')[5][5] === '#', 'Home particle keeps its own char');

// ── 26. Renderer: Z-depth ──

group('Renderer Z-Depth');

const zConfig = defaultConfig({ zDepthEnabled: true });

// Highly receded particle (z > 1.5) renders as space
const recessedP = makeParticle({
  currentX: 5, currentY: 5, homeX: 5, homeY: 5, char: '#', brightness: 1, z: 2.0,
});
const recessedRender = renderToString([recessedP], 10, 10, zConfig);
assert(recessedRender.split('\n')[5][5] === ' ', 'Highly receded particle renders as space');

// Close particle (z < -0.8) gets densified char
const closeP = makeParticle({
  currentX: 5, currentY: 5, homeX: 5, homeY: 5, char: '.', brightness: 1, z: -1.0,
});
const closeRender = renderToString([closeP], 10, 10, zConfig);
assert(closeRender.split('\n')[5][5] === ':', 'Close particle . densifies to :');

// ── 27. SceneBuilder: flowSpeedVariance & clusterPhases ──

group('SceneBuilder Enhanced');

resetIdCounter();
const varianceScene = new SceneBuilder(40, 10)
  .addText('ABC', { offsetX: 5, offsetY: 5 })
  .setConfig({ flowSpeedVariance: 0.8 })
  .build();

// With variance > 0, each particle should have a flowSpeed set
assert(varianceScene.particles.every(p => p.flowSpeed !== undefined),
  'flowSpeedVariance sets per-particle flowSpeed');
// Values should differ (with 3 particles, extremely unlikely all identical)
const speeds = new Set(varianceScene.particles.map(p => p.flowSpeed));
assert(speeds.size > 1 || varianceScene.particles.length === 1,
  'flowSpeedVariance produces different speeds');

resetIdCounter();
const clusterScene = new SceneBuilder(40, 10)
  .addText('ABCDE', { offsetX: 5, offsetY: 5 })
  .setConfig({ clusterPhases: true })
  .build();

assert(clusterScene.particles.every(p => p.clusterX !== undefined && p.clusterY !== undefined),
  'clusterPhases assigns cluster centroids in SceneBuilder');

// ── 28. New Presets ──

group('New Presets');

assert(PRESETS.cinema.physicsMode === 'flow-matching', 'Cinema preset uses flow-matching');
assert(PRESETS.cinema.charMorphEnabled === true, 'Cinema preset enables char morph');
assert(PRESETS.cinema.flowSpeedVariance === 0.6, 'Cinema preset has flowSpeedVariance');

assert(PRESETS.shimmer.idleFlicker === true, 'Shimmer preset enables idle flicker');
assert(PRESETS.shimmer.idleAmplitude === 0.2, 'Shimmer preset has idle amplitude');

assert(PRESETS.depth.zDepthEnabled === true, 'Depth preset enables Z-depth');
assert(PRESETS.depth.zScatterStrength === 0.6, 'Depth preset has zScatterStrength');

assert(PRESETS.flock.cubicHoming === true, 'Flock preset uses cubic homing');
assert(PRESETS.flock.flockAlignment === 0.6, 'Flock preset has flock alignment');
assert(PRESETS.flock.personalSpace === 1.2, 'Flock preset has personal space');

// ── Summary ──

console.log(`\n${'='.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`${'='.repeat(40)}`);

if (failed > 0) {
  process.exit(1);
}
