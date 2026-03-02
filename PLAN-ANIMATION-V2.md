# ASCII Diffusion — Animation Improvements Plan (V2)

**Branch:** `claude/plan-animation-improvements-SfhWb`

This plan outlines targeted animation quality improvements drawn from three
reference implementations. Each section maps a technique from the source
project to a concrete change in the ASCII Diffusion codebase.

---

## Reference Projects — Key Takeaways

### 1. brunoimbrizi/interactive-particles

The most technically instructive reference. Its vertex shader reveals several
techniques that directly translate to our ASCII context:

```glsl
// Z-depth: noise-driven depth displacement per particle
float rndz = (random(pindex) + snoise2(vec2(pindex * 0.1, uTime * 0.1)));
displaced.z += rndz * (random(pindex) * 2.0 * uDepth);

// Touch texture: mouse force sampled from off-screen texture (decaying map)
float t = texture2D(uTouch, puv).r;
displaced.z += t * 20.0 * rndz;
displaced.x += cos(angle) * t * 20.0 * rndz;
displaced.y += sin(angle) * t * 20.0 * rndz;

// Brightness-based size: darker pixels → smaller/dimmer particles
float grey = colA.r * 0.21 + colA.g * 0.71 + colA.b * 0.07;
float psize = (snoise2(...) + 2.0) * max(grey, 0.2) * uSize;
```

**Key techniques to adopt:**
- **Z-depth per particle** — a virtual Z axis gives simulated depth; in ASCII,
  Z maps to character density/brightness rather than 3D projection.
- **Off-screen influence map (touch texture)** — instead of O(n) distance checks
  per frame, maintain a trail-based map; mouse "paints" force into it, creating
  trailing ripple effects that outlast the cursor.
- **Per-particle angle** — each particle has an intrinsic angle. Scatter force
  applied as `cos(angle)` / `sin(angle)` rather than purely radially.
- **Brightness ↔ character density** — source pixel luminance drives which
  character a particle uses. Lower brightness = lighter/sparser char.
- **Simplex noise for organic drift** — idle particles use noise sampled from
  `(particleIndex * 0.1, time * 0.1)` for gentle aperiodic drift.

**What the actual JavaScript source adds (TouchTexture.js + Particles.js):**

TouchTexture.js does NOT use simple `map *= decay`. It keeps a **trail array**
of past mouse positions, each with an individually-baked force and age lifecycle:

```javascript
addTouch(point) {
  const last = this.trail[this.trail.length - 1];
  const dd = (last.x - point.x)**2 + (last.y - point.y)**2;
  // Force baked at add-time: fast swipe → force≈1, slow hover → ≈0
  const force = Math.min(dd * 10000, 1);
  this.trail.push({ x: point.x, y: point.y, age: 0, force });
}
// Per frame: bloom in over first 30% of maxAge (120 frames), fade over last 70%
// Points removed when age > maxAge — trail persists ~4 seconds naturally
```

Particles.js — per-particle angle is explicitly half-circle:
```javascript
angles[j] = Math.random() * Math.PI;  // [0, π], NOT [0, 2π]
```
Half-circle (not full 2π) means particles scatter into one "hemisphere," giving
the organic asymmetric sweep rather than a uniform radial burst.

The `show()` / `hide()` lifecycle (missing from the previous plan version):
- `show()`: `uDepth` 40→4 over 1.5s — particles start deeply scattered in Z-space
  and converge to the image plane. `uSize` 0.5→1.5 over 1s.
- `hide()`: `uDepth`→−20 over 0.8s, `uSize`→0 over 0.64s — scatter outward.

---

### 2. Codrops — Interactive Particles with Three.js

Conceptually aligned with brunoimbrizi (same project, tutorial article).
Reinforces two ideas worth extracting:

- **Touch ripple as a field** — the "touch texture" is a separate render target
  that decays over time. This decoupled approach means the ripple outlasts the
  cursor; it radiates outward even after the mouse stops moving.
- **Depth as a quality axis** — particles that are "in front" (negative Z in 3D,
  or "closer" in our 2D simulation) appear larger and brighter. Particles that
  recede appear smaller and dimmer. In ASCII this maps naturally: closer →
  denser char, receded → space or `.`.

---

### 3. Yash-Chitambar/obamify (Jump Flood Algorithm + Rust/WASM)

*Verified by reading morph_sim.rs, calculate/mod.rs, and the WGSL shaders.*

obamify morphs one image into another by reassigning source pixels to target
positions. The core problem is **particle-to-home assignment**: which particle
gets which home slot?

> **If particles always return to their birth home, paths cross and the motion
> looks mechanical. If particles dynamically claim the nearest available home,
> paths do not cross and the collective motion looks organic.**

**CellBody** — what a particle actually contains in obamify:
```rust
pub struct CellBody {
  srcx, srcy: f32,  // current position
  dstx, dsty: f32,  // destination / home
  velx, vely: f32,
  dst_force:  f32,  // per-particle homing strength (default 0.13)
  age:        u32,  // frames since last reset
}
```

**Per-frame physics** (morph_sim.rs) — three mechanics beyond basic attraction:
- **Cubic factor curve**: `factor = min((age_frames/60 * dst_force)³, 1000)`.
  Particles drift slowly at first, then rush home. No oscillation, dramatic
  late acceleration — completely different from spring physics.
- **Boid velocity alignment**: `ALIGNMENT_FACTOR = 0.8`. Each particle blends
  80% of its velocity toward the local neighbor average. Nearby particles form
  visible streaming groups during return.
- **Personal space**: `PERSONAL_SPACE = 0.95` cells. Light P2P repulsion
  prevents particles stacking on the same cell during transit.
- Damping: `vel *= 0.97`. Max velocity: 6.0 cells/frame.

**Assignment modes** (verified, not inferred):
- **"Optimal" (Kuhn-Munkres / Hungarian)**: runs **offline**, O(n³), minimizes
  `colorWeight × colorDiff² + spatialWeight × spatialDist²`. Result saved as
  `assignments.json` — loaded at runtime, not computed live.
- **Genetic algorithm** (practical runtime alternative): iterative hill-climbing.
  Pick random particle pairs within a shrinking search radius; swap if total
  cost decreases. Radius decays ×0.8 each generation. Near-optimal, ~O(n log n).
- **JFA** (runtime GPU): log₂(maxDim) passes, 8-direction sampling at each step.

**Key techniques to adopt:**
- **On-scatter dynamic reassignment** — greedy or genetic pass on scatter event
  prevents crossing paths during return.
- **Scene-transition matching** — match old positions to new homes to minimize
  total travel distance.
- **Cubic homing + boid flocking + personal space** — three new opt-in physics
  modes derived directly from morph_sim.rs (see Phase I).

---

## Improvement Plan

Organized into phases by impact and implementation complexity.

---

### Phase A — Mouse Interaction Quality

**A1. TrailMap — unified trail array with age-based bloom/fade decay**

*(Replaces and merges old A1 "Mouse velocity tracking" and A2 "Spatial influence
map". The actual TouchTexture.js collapses both into a single trail array.)*

Mouse velocity is NOT tracked separately — it's baked into each trail point at
add-time. The trail array manages its own lifecycle:

```typescript
// core/trail-map.ts — new file
interface TrailPoint {
  x: number; y: number;
  age: number; force: number; maxAge: number;
}

export class TrailMap {
  private trail: TrailPoint[] = [];
  private lastX = 0; private lastY = 0;

  addPoint(x: number, y: number, maxAge = 120): void {
    const dx = x - this.lastX; const dy = y - this.lastY;
    // Squared delta = proportional to velocity² — matches TouchTexture.js exactly
    const force = Math.min((dx*dx + dy*dy) * 100, 1.0);
    this.trail.push({ x, y, age: 0, force, maxAge });
    this.lastX = x; this.lastY = y;
  }

  update(): void {
    for (let i = this.trail.length - 1; i >= 0; i--) {
      this.trail[i].age++;
      if (this.trail[i].age > this.trail[i].maxAge) this.trail.splice(i, 1);
    }
  }

  // Sample influence strength at grid coords (x, y)
  sample(x: number, y: number, radius: number): number {
    let total = 0;
    for (const pt of this.trail) {
      const dx = x - pt.x; const dy = y - pt.y;
      const d2 = dx*dx + dy*dy;
      if (d2 > radius * radius) continue;
      const lifeFrac = pt.age / pt.maxAge;
      // Bloom in (first 30%), fade out (last 70%) — matches TouchTexture.js
      const intensity = lifeFrac < 0.3
        ? easeOutSine(lifeFrac / 0.3)
        : easeOutSine(1 - (lifeFrac - 0.3) / 0.7);
      total += intensity * pt.force * (1 - Math.sqrt(d2) / radius);
    }
    return Math.min(total, 1.0);
  }
}

function easeOutSine(t: number): number { return Math.sin(t * Math.PI / 2); }
```

Physics applicators: call `trailMap.update()` each frame, then sample per particle:
```typescript
const influence = trailMap.sample(p.currentX, p.currentY, config.scatterRadius);
```

**Benefits over simple decay grid:**
- Fast swipe leaves bright trail that persists ~4s and naturally fades
- Slow hover produces near-zero force (physically realistic)
- Trail outlasts cursor position — ripple effect continues after mouse stops
- Force baked at add-time means no velocity tracking needed separately

**Files:** `core/trail-map.ts` (new), `physics-modes/flow-matching.ts`,
`physics-modes/diffusion.ts`, `components/AsciiDiffusionRenderer.tsx`.

---

**A2. Per-particle angle for directional scatter**
*(was A3 — renumbered)*

Add `angle` to `AsciiParticle`. Computed once at scene build time from the
particle's home position relative to scene center:

```typescript
// In scene-builder.ts / grid-to-particles.ts
p.angle = Math.random() * Math.PI; // [0, π] half-circle — matches Particles.js
```

In the physics applicator, use angle to create directional scatter:

```typescript
// Instead of purely radial repulsion:
const influence = influenceMap.sample(p.currentX, p.currentY);
if (influence > 0.01) {
  // Combine radial push with angle-directed component
  const radialX = dx / dist;
  const radialY = dy / dist;
  const angleX = Math.cos(p.angle);
  const angleY = Math.sin(p.angle);
  // 60% radial, 40% angle-directed
  p.vx += (radialX * 0.6 + angleX * 0.4) * influence * config.scatterForce * dtScale;
  p.vy += (radialY * 0.6 + angleY * 0.4) * influence * config.scatterForce * dtScale;
}
```

Half-circle [0, π] rather than full 2π is intentional — from the actual
Particles.js source (`angles[j] = Math.random() * Math.PI`). Half-circle means
particles scatter into one hemisphere rather than uniformly outward, producing
the organic asymmetric sweep seen in the brunoimbrizi demo.

**Files:** `core/types.ts` (add `angle`), `scene/grid-to-particles.ts`,
`scene/text-to-particles.ts`, `scene/image-to-particles.ts`,
`physics-modes/flow-matching.ts`.

---

### Phase B — Z-Depth Simulation

**B1. Virtual Z axis on particles**

Add `z` and `vz` to `AsciiParticle`. Z is normalized: `0` = at home plane,
positive = "receded behind," negative = "in front."

```typescript
interface AsciiParticle {
  // ... existing fields
  z: number;    // depth offset, clamped to [-2, 2]
  vz: number;   // depth velocity
  angle: number; // intrinsic scatter angle
}
```

Mouse interaction also displaces in Z using the influence map:

```typescript
const influence = influenceMap.sample(p.currentX, p.currentY);
p.vz += influence * config.scatterForce * 0.5 * dtScale * (Math.random() - 0.5);
p.vz *= config.damping;
p.z += p.vz * dtScale;
p.z = Math.max(-2, Math.min(2, p.z));
// Return Z to 0 via flow matching
p.z += (0 - p.z) * 0.02 * dtScale;
```

---

**B2. Z maps to rendered character density**

In `renderer.ts`, map Z offset to character substitution:

```typescript
// getEffectiveChar(particle) — used in renderToString / renderToColorGrid
function getEffectiveChar(p: AsciiParticle): string {
  const z = p.z ?? 0;
  if (z > 1.5)  return ' ';          // Far receded — invisible
  if (z > 0.8)  return '.';          // Slightly receded — sparse
  if (z > 0.3)  return p.char;       // Shallow recede — normal but dimmer
  if (z < -0.8) return densifyChar(p.char); // Closer — heavier version
  return p.char;
}

// densifyChar: map a char to a visually heavier equivalent
const densify: Record<string, string> = {
  '.': ':', ',': ';', '-': '=', '+': '#', 'o': 'O', 'i': 'I'
};
```

This gives a **depth field effect** purely in ASCII. Particles that are
"pushed forward" toward the viewer become heavier/brighter; those pushed away
fade to dots or spaces.

**Files:** `core/types.ts`, `core/renderer.ts`, `physics-modes/flow-matching.ts`.

---

### Phase C — Character Morphing During Flight

**C1. Distance-based character substitution**

When a particle is displaced far from home, swap its char for a lighter one:

```typescript
// In renderer — compute effective char based on displacement
const homeDist = Math.sqrt(
  (p.currentX - p.homeX) ** 2 + (p.currentY - p.homeY) ** 2
);
const effectiveChar = homeDist > 3
  ? scatterChars[Math.floor(p.id * 7 + homeDist) % scatterChars.length]
  : p.char;

const scatterChars = ['.', '·', ',', '`', "'", ':', ';'];
```

As particles return home (`homeDist → 0`) the char naturally resolves back to
the correct home character. The visual reads as "assembling from noise."

**C2. Velocity-direction characters**

When `|velocity| > threshold`, display a directional char based on velocity
angle:

```typescript
const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
if (speed > 1.5) {
  const vAngle = Math.atan2(p.vy, p.vx);
  const sector = Math.round(vAngle / (Math.PI / 4)) % 4;
  return ['−', '\\', '|', '/'][Math.abs(sector)];
}
```

Fast-moving particles show their direction of travel. Creates motion trails
visually without needing actual ghost characters.

**Files:** `core/renderer.ts`.

---

### Phase D — Smarter Particle Assignment (JFA-Inspired)

**Note on obamify's assignment modes:** The "Optimal" mode in obamify is a full
Kuhn-Munkres (Hungarian) algorithm run **offline** — it's pre-computed and saved
as `assignments.json`. It is O(n³) and not feasible at runtime. The **genetic
algorithm** is the practical runtime alternative (iterative hill-climbing with
decaying search radius). Both outperform greedy NN for scene transitions.

Our D2 uses greedy NN as the simplest correct approach. An optional upgrade
path is the genetic algorithm from obamify (described below in D3).

**D1. On-scatter greedy reassignment**

When particles are scattered (their `t` resets to 0), run a quick nearest-home
reassignment to prevent paths from crossing:

```typescript
// scene/assignment.ts — new file
export function reassignParticlesToHomes(
  particles: AsciiParticle[],
  homes: Array<{ x: number; y: number; char: string; brightness: number }>,
): void {
  // Greedy nearest-neighbor: for each particle (sorted by current-to-nearest-home dist),
  // assign the closest unclaimed home.
  const claimed = new Set<number>();
  const sorted = particles
    .map((p, i) => ({ p, i, bestDist: Infinity, bestHome: -1 }))
    .sort((a, b) => {
      // Pre-compute nearest home distance for sorting
      let minDist = Infinity;
      for (let h = 0; h < homes.length; h++) {
        const dx = a.p.currentX - homes[h].x;
        const dy = a.p.currentY - homes[h].y;
        minDist = Math.min(minDist, dx * dx + dy * dy);
      }
      a.bestDist = minDist;
      return 0; // full sort happens next step
    });

  // Assign greedily: closest particle to any home gets first pick
  for (const entry of sorted) {
    let best = -1, bestDist = Infinity;
    for (let h = 0; h < homes.length; h++) {
      if (claimed.has(h)) continue;
      const dx = entry.p.currentX - homes[h].x;
      const dy = entry.p.currentY - homes[h].y;
      const d = dx * dx + dy * dy;
      if (d < bestDist) { bestDist = d; best = h; }
    }
    if (best >= 0) {
      claimed.add(best);
      entry.p.homeX = homes[best].x;
      entry.p.homeY = homes[best].y;
      entry.p.char  = homes[best].char;
      entry.p.brightness = homes[best].brightness;
    }
  }
}
```

This is O(n²) in the worst case but runs only once per scatter event, not per
frame. For typical particle counts (200–800) it completes in <1ms.

**D2. Scene-transition optimal matching**

In `scene/transitions.ts`, the morph transition currently reuses particles
in their original order. Replace with greedy nearest-home matching:

```typescript
// transitions.ts — morph transition
function morphTransition(from: AsciiScene, to: AsciiScene): AsciiParticle[] {
  const fromParticles = [...from.particles];
  const toHomes = to.particles.map(p => ({
    x: p.homeX, y: p.homeY, char: p.char, brightness: p.brightness
  }));

  // Greedy nearest assignment: each old particle claims the new home closest
  // to its CURRENT position (not home position — it may be scattered)
  const claimed = new Set<number>();
  const result: AsciiParticle[] = [];

  for (const fp of fromParticles) {
    let best = -1, bestDist = Infinity;
    for (let h = 0; h < toHomes.length; h++) {
      if (claimed.has(h)) continue;
      const dx = fp.currentX - toHomes[h].x;
      const dy = fp.currentY - toHomes[h].y;
      const d = dx * dx + dy * dy;
      if (d < bestDist) { bestDist = d; best = h; }
    }
    if (best >= 0) {
      claimed.add(best);
      result.push({
        ...fp,
        homeX: toHomes[best].x,
        homeY: toHomes[best].y,
        char: toHomes[best].char,
        brightness: toHomes[best].brightness,
        t: 0,
      });
    }
  }
  return result;
}
```

**Files:** `scene/assignment.ts` (new), `scene/transitions.ts`,
`physics-modes/flow-matching.ts` (trigger reassignment on scatter).

---

**D3. Genetic assignment for scene transitions** *(optional upgrade to D2)*

Adapted from obamify's `process_genetic()`. Better than greedy NN because it
starts with global search and refines locally:

```typescript
// scene/assignment.ts — optional genetic variant
export function geneticReassign(
  particles: AsciiParticle[],
  homes: HomeSlot[],
  iterations = 3,
): void {
  // Build index: particle i is currently assigned to home i
  const assignment = particles.map((_, i) => i);
  let searchRadius = Math.max(homes.length ** 0.5, 4);

  for (let iter = 0; iter < iterations; iter++) {
    let swaps = 0;
    for (let a = 0; a < particles.length; a++) {
      // Pick random candidate home within search radius
      const ha = assignment[a];
      const bIdx = randomNearby(a, particles, searchRadius);
      if (bIdx === a) continue;
      const hb = assignment[bIdx];

      const costBefore = dist2(particles[a], homes[ha]) + dist2(particles[bIdx], homes[hb]);
      const costAfter  = dist2(particles[a], homes[hb]) + dist2(particles[bIdx], homes[ha]);
      if (costAfter < costBefore) {
        assignment[a] = hb; assignment[bIdx] = ha; swaps++;
      }
    }
    searchRadius *= 0.8;
    if (searchRadius < 2 && swaps < 5) break;
  }
  // Apply final assignment
  for (let i = 0; i < particles.length; i++) {
    const h = homes[assignment[i]];
    particles[i].homeX = h.x; particles[i].homeY = h.y;
    particles[i].char  = h.char; particles[i].brightness = h.brightness;
  }
}
```

**Files:** `scene/assignment.ts`.

---

### Phase E — Flow Matching Improvements

**E1. Staggered return timing**

Instead of all particles starting their return journey simultaneously (creating
a synchronized arrival that looks mechanical), stagger `t` reset values:

```typescript
// When scattering a particle, instead of t = 0:
p.t = -(Math.random() * 0.4); // Range: [-0.4, 0], starts return at different times
```

In the flow matching applicator, only begin homing when `p.t >= 0`:

```typescript
// Advance t
p.t = Math.min(p.t + flowSpeed * dtScale, 1);
if (p.t >= 0) {
  // Apply flow matching lerp toward home
}
```

Particles scattered further from home get a slightly larger negative `t`:

```typescript
const dist = Math.sqrt((p.currentX - p.homeX)**2 + (p.currentY - p.homeY)**2);
p.t = -(dist / maxDist) * 0.5; // Farther particles wait longer
```

---

**E2. Per-particle flow speed variance**

```typescript
// Stored on particle at scene build time
p.flowSpeed = (config.flowSpeed ?? 0.04) * (0.75 + Math.random() * 0.5);
```

Each particle completes its return journey at a slightly different rate.
Prevents the synchronized "grid snapping" where all particles arrive home at
the same frame.

**Files:** `core/types.ts` (add `flowSpeed` and optionally `angle` to
`AsciiParticle`), `physics-modes/flow-matching.ts`, scene builders.

---

**E3. Cluster-aware flow matching (2-phase)**

Particles can optionally use a 2-phase trajectory:

- **Phase 1 (t: 0 → 0.5):** particle moves toward the centroid of its home cluster
  (average position of all home particles in the same "region")
- **Phase 2 (t: 0.5 → 1):** particle moves from centroid toward its exact home

This creates a "flock gathering then landing" visual. Implementation:
compute cluster centroids at scene build time, store `clusterX`/`clusterY` on
each particle.

```typescript
// In flow matching applicator:
if (p.t < 0.5) {
  // Phase 1: move toward cluster centroid
  const target = { x: p.clusterX, y: p.clusterY };
  applyFlowStep(p, target, p.t * 2, dtScale);
} else {
  // Phase 2: move from centroid to exact home
  applyFlowStep(p, { x: p.homeX, y: p.homeY }, (p.t - 0.5) * 2, dtScale);
}
```

**Files:** `core/types.ts` (add `clusterX`, `clusterY`), scene builders
(compute clusters on build), `physics-modes/flow-matching.ts`.

---

### Phase F — Idle Animation

**F1. Noise-based idle drift**

When a particle is at home (`t === 1`) and mouse is far away, apply subtle
periodic drift using a cheap sin-based noise approximation:

```typescript
// Cheap 2D noise: two offset sin waves
function cheapNoise2D(x: number, y: number, t: number): number {
  return Math.sin(x * 0.7 + t * 0.0013)
       * Math.cos(y * 0.5 + t * 0.0017) * 0.5
       + Math.sin(x * 1.3 + y * 0.9 + t * 0.001) * 0.25;
}

// In flow matching applicator, when p.t === 1:
if (p.t === 1 && config.idleAmplitude) {
  const noise = cheapNoise2D(p.homeX, p.homeY, time);
  p.currentX = p.homeX + noise * config.idleAmplitude;
  p.currentY = p.homeY + noise * config.idleAmplitude * 0.5;
}
```

Default `idleAmplitude: 0.15` — just enough to create a shimmer without
displacing characters off their home cells.

**F2. Idle character flicker**

Occasionally swap home char for an adjacent-brightness char (simulates CRT
noise / character refresh):

```typescript
// In renderer, when particle is essentially at home:
if (config.idleFlicker && Math.random() < 0.002) {
  // 0.2% chance per particle per frame to momentarily show adjacent char
  return adjacentChar(p.char); // small brightness step up or down
}
```

**Files:** `core/types.ts` (add `idleAmplitude`, `idleFlicker` to config),
`physics-modes/flow-matching.ts`, `core/renderer.ts`.

---

### Phase G — New Physics Mode: Magnetic

A new mode that combines attraction (gravity) with flow matching return. The
cursor acts as a magnet: particles are pulled toward it while in range, but
use flow matching (not spring) to return when the cursor leaves.

```typescript
// physics-modes/magnetic.ts
export const magneticPhysics: PhysicsApplicator = {
  apply(particles, mousePos, config, dt) {
    const dtScale = dt / 33;
    for (const p of particles) {
      if (mousePos) {
        const dx = mousePos.x - p.currentX; // Note: TOWARD mouse
        const dy = mousePos.y - p.currentY;
        const distSq = dx * dx + dy * dy;
        if (distSq < config.scatterRadius * config.scatterRadius && distSq > 0.01) {
          const dist = Math.sqrt(distSq);
          const force = config.scatterForce / (distSq + 0.5);
          p.vx += (dx / dist) * force * dtScale;
          p.vy += (dy / dist) * force * dtScale;
          p.t = 0; // Reset flow matching time
        }
      }
      // Flow matching return (same as flow-matching mode)
      p.vx *= config.damping;
      p.vy *= config.damping;
      p.currentX += p.vx * dtScale;
      p.currentY += p.vy * dtScale;
      // ... flow matching lerp
    }
  }
};
```

**Files:** `physics-modes/magnetic.ts` (new), `core/types.ts` (add `'magnetic'`
to `PhysicsMode`), `core/physics.ts` (register), `presets/index.ts`.

---

### Phase H — Intro / Outro Animation *(new)*

Directly from brunoimbrizi's `show()` / `hide()` lifecycle — the most cinematic
missing feature. The current `scattered: true` only scatters within a small
radius. The real `show()` scatters particles across the **full canvas** in
depth-space (Z=40) then converges to the image plane over 1.5 seconds.

**H1. triggerShow() — full-canvas scatter + convergence**

```typescript
// core/lifecycle.ts — new file
export function triggerShow(particles: AsciiParticle[], scene: AsciiScene): void {
  for (const p of particles) {
    // Full-canvas scatter (not radius-limited like scattered: true)
    p.currentX = Math.random() * scene.width;
    p.currentY = Math.random() * scene.height;
    p.vx = (Math.random() - 0.5) * 2;
    p.vy = (Math.random() - 0.5) * 2;
    if (p.z !== undefined) p.z = (Math.random() - 0.5) * 4;
    // Stagger: t ranges from −1.0 to −1.5 based on distance from canvas center
    const dx = p.homeX - scene.width  / 2;
    const dy = p.homeY - scene.height / 2;
    const norm = Math.sqrt(dx*dx + dy*dy) / (scene.width * 0.5);
    p.t = -1.0 - norm * 0.5;
  }
}
```

**H2. triggerHide() — scatter outward**

```typescript
export function triggerHide(particles: AsciiParticle[], scene: AsciiScene): void {
  for (const p of particles) {
    const dx = p.currentX - scene.width  / 2;
    const dy = p.currentY - scene.height / 2;
    const d  = Math.max(Math.sqrt(dx*dx + dy*dy), 0.1);
    p.vx = (dx / d) * 8 + (Math.random() - 0.5) * 4;
    p.vy = (dy / d) * 8 - Math.random() * 4;
    if (p.vz !== undefined) p.vz = (Math.random() - 0.5) * 3;
  }
  // Caller removes scene after ~800ms
}
```

**H3. Props / API additions to AsciiDiffusionRenderer**

```typescript
animateIn?: boolean;           // run triggerShow() on first mount (default false)
onShowComplete?: () => void;   // fires when all particles reach t=1 for first time
// Programmatic:
ref.current.show(): void
ref.current.hide(): Promise<void>  // resolves when particles leave canvas bounds
```

**Files:** `core/lifecycle.ts` (new), `components/AsciiDiffusionRenderer.tsx`.

---

### Phase I — obamify Physics *(new, all opt-in)*

Three mechanics from morph_sim.rs, each independently toggleable via config.

**I1. Cubic acceleration curve for homing** *(`cubicHoming: true`)*

obamify's factor curve: `factor = min((age_secs * dst_force)³, 1000)`.
Particles start nearly stationary, then accelerate dramatically toward home.
Completely different feel from spring (oscillates) or linear flow matching
(constant rate):

```typescript
// In flow-matching applicator when config.cubicHoming is true:
const elapsed = Math.max(p.t, 0);
const factor  = Math.min(Math.pow(elapsed * (config.dstForce ?? 0.13), 3), 1.0);
p.vx += (p.homeX - p.currentX) * factor * dtScale;
p.vy += (p.homeY - p.currentY) * factor * dtScale;
// Damping still applies after: p.vx *= config.damping
```

**I2. Velocity alignment / boid flocking** *(`flockAlignment: 0–1`)*

Each particle blends its velocity toward the average of nearby particles.
From obamify: `ALIGNMENT_FACTOR = 0.8`. Particles form visible streaming groups
during their return journey — cohesive "flocks" rather than independent paths:

```typescript
// Requires SpatialHash (core/spatial-hash.ts) for O(1) avg neighbor lookup
if (config.flockAlignment) {
  const neighbors = spatialHash.query(p.currentX, p.currentY, 2.0);
  if (neighbors.length > 0) {
    const avgVx = neighbors.reduce((s,n) => s+n.vx, 0) / neighbors.length;
    const avgVy = neighbors.reduce((s,n) => s+n.vy, 0) / neighbors.length;
    const a = config.flockAlignment;
    p.vx = p.vx * (1-a) + avgVx * a;
    p.vy = p.vy * (1-a) + avgVy * a;
  }
}
```

**I3. Personal space repulsion** *(`personalSpace: cells`)*

Light P2P repulsion within `personalSpace` cells. From obamify:
`PERSONAL_SPACE = 0.95`. Prevents particles stacking on the same grid cell
during transit — creates natural packing as they arrive home:

```typescript
if (config.personalSpace) {
  const tooClose = spatialHash.query(p.currentX, p.currentY, config.personalSpace);
  for (const n of tooClose) {
    if (n.id === p.id) continue;
    const dx = p.currentX - n.currentX; const dy = p.currentY - n.currentY;
    const d  = Math.sqrt(dx*dx + dy*dy);
    if (d > 0.001) {
      const push = (config.personalSpace - d) / config.personalSpace * 0.1;
      p.vx += (dx/d) * push * dtScale; p.vy += (dy/d) * push * dtScale;
    }
  }
}
```

**Files:** `core/spatial-hash.ts` (new), `physics-modes/flow-matching.ts`.

---

## New Config Fields Summary

Add to `ExtendedDiffusionConfig` in `core/types.ts`:

```typescript
// Phase A
trailMaxAge?: number;           // Trail point max lifetime in frames (default: 120)
trailForceScale?: number;       // Scale factor for velocity-baked force (default: 100)
angleScatterWeight?: number;    // Weight of angle-directed vs radial scatter (default: 0.4)

// Phase B
zDepthEnabled?: boolean;        // Enable Z-axis simulation (default: false)
zScatterStrength?: number;      // How much mouse pushes particles in Z (default: 0.3)
zReturnSpeed?: number;          // How fast Z returns to 0 (default: 0.02)

// Phase C
charMorphEnabled?: boolean;     // Enable char substitution during flight (default: true)
charMorphThreshold?: number;    // Displacement before char substitutes (default: 3.0)
velocityCharsEnabled?: boolean; // Show direction chars when fast (default: false)

// Phase E
staggerReturn?: boolean;        // Stagger return timing (default: true)
staggerMaxDelay?: number;       // Max negative t for stagger (default: 0.4)
flowSpeedVariance?: number;     // Per-particle speed variance (default: 0.5)
clusterPhases?: boolean;        // 2-phase cluster-aware flow (default: false)

// Phase F
idleAmplitude?: number;         // Idle drift amplitude in cells (default: 0.0)
idleFlicker?: boolean;          // Idle char flickering (default: false)

// Phase I (obamify physics — all opt-in)
cubicHoming?: boolean;          // Use cubic acceleration curve (default: false)
dstForce?: number;              // Cubic homing strength, matches obamify default: 0.13
flockAlignment?: number;        // Boid velocity alignment 0–1 (default: 0 = off)
personalSpace?: number;         // P2P repulsion radius in cells (default: 0 = off)
```

New fields on `AsciiParticle`:

```typescript
angle?: number;        // Intrinsic scatter angle (set at build time)
flowSpeed?: number;    // Per-particle flow speed override
z?: number;            // Z depth offset (0 = at home plane)
vz?: number;           // Z velocity
clusterX?: number;     // Phase 1 target for 2-phase flow matching
clusterY?: number;
```

---

## New Files

| File | Purpose |
|------|---------|
| `core/trail-map.ts` | Age-based trail array (replaces simple influence grid) |
| `core/spatial-hash.ts` | O(1) avg neighbor lookup for flocking + personal space |
| `core/lifecycle.ts` | triggerShow() / triggerHide() for intro/outro animation |
| `scene/assignment.ts` | Greedy + genetic nearest-home particle assignment (JFA-inspired) |
| `physics-modes/magnetic.ts` | New attract-with-flow-return mode |

## Modified Files

| File | Changes |
|------|---------|
| `core/types.ts` | New config fields, new particle fields (Phase I fields, angle, flowSpeed) |
| `core/renderer.ts` | Z-depth char mapping, char morph during flight, velocity chars |
| `physics-modes/flow-matching.ts` | TrailMap, angle scatter, staggered t, idle drift, cubic homing, flocking |
| `physics-modes/diffusion.ts` | TrailMap integration |
| `components/AsciiDiffusionRenderer.tsx` | TrailMap integration, animateIn prop, show/hide ref API |
| `scene/grid-to-particles.ts` | Compute `angle`, `flowSpeed` at build time |
| `scene/text-to-particles.ts` | Same: `angle`, `flowSpeed` |
| `scene/image-to-particles.ts` | Same: `angle`, `flowSpeed`; cluster centroid computation |
| `scene/transitions.ts` | Greedy / genetic nearest-neighbor morph matching |
| `core/physics.ts` | Register `magnetic` mode |
| `presets/index.ts` | New presets using new config fields (flock, cinema, etc.) |

---

## Implementation Order

| # | Phase | Priority |
|---|-------|----------|
| 1 | A2 — Per-particle angle (half-circle fix) | High |
| 2 | E1 — Staggered return timing | High |
| 3 | E2 — Per-particle flow speed variance | High |
| 4 | C1 — Char morph during flight | High |
| 5 | A1 — TrailMap (merges old A1+A2) | High |
| 6 | H — Intro/Outro show()/hide() | High |
| 7 | D1/D2 — Greedy assignment | Medium |
| 8 | F1 — Idle noise drift | Medium |
| 9 | I1 — Cubic homing curve | Medium |
| 10 | B1/B2 — Z-depth simulation | Low (opt-in) |
| 11 | I2 — Boid flocking | Low (opt-in) |
| 12 | I3 — Personal space | Low (opt-in) |
| 13 | D3 — Genetic assignment | Low (opt-in upgrade) |
| 14 | E3 — 2-phase cluster flow | Low (opt-in) |
| 15 | G — Magnetic mode | Low |
| 16 | C2 — Velocity direction chars | Low (opt-in) |
| 17 | F2 — Idle flicker | Low (opt-in) |

---

## Presets to Add

```typescript
// presets/index.ts additions

cinema: {
  // Dramatic, staggered return with char morphing
  staggerReturn: true,
  staggerMaxDelay: 0.5,
  charMorphEnabled: true,
  flowSpeed: 0.035,
  flowSpeedVariance: 0.6,
  scatterRadius: 10,
  scatterForce: 1.2,
  damping: 0.90,
},

shimmer: {
  // Subtle idle animation, almost static but alive
  staggerReturn: true,
  idleAmplitude: 0.2,
  idleFlicker: true,
  flowSpeed: 0.06,
  scatterRadius: 6,
  scatterForce: 0.5,
  damping: 0.94,
},

depth: {
  // Z-depth enabled, dramatic 3D feel
  zDepthEnabled: true,
  zScatterStrength: 0.6,
  charMorphEnabled: true,
  staggerReturn: true,
  scatterRadius: 12,
  scatterForce: 1.5,
  damping: 0.88,
},

magnetic: {
  physicsMode: 'magnetic' as const,
  scatterRadius: 14,
  scatterForce: 1.0,
  damping: 0.92,
  flowSpeed: 0.05,
},

flock: {
  // obamify-inspired: cubic homing + boid streaming
  cubicHoming: true, dstForce: 0.13,
  flockAlignment: 0.6, personalSpace: 1.2,
  staggerReturn: true,
  scatterRadius: 10, scatterForce: 1.0, damping: 0.97,
},
```

---

## What We Are NOT Doing

- **GPU/WebGL rendering** — The entire point of this package is ASCII text in a
  `<pre>` tag. WebGL would require a full rewrite and lose the ASCII aesthetic.
- **Full JFA on CPU** — Greedy NN (D2) or genetic algorithm (D3) gives 80% of
  the visual benefit at a fraction of the cost. True JFA is GPU-parallel and
  not practical here.
- **True 3D projection** — Z-depth is simulated via character density, not actual
  perspective projection. This is intentional; perspective-correct 3D would
  distort the ASCII grid layout.
- **Actual simplex noise library** — We use a cheap two-sin approximation for
  idle drift. It's indistinguishable at the amplitudes we use and adds zero
  dependencies.
