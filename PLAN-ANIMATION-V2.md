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
  per frame, maintain a 2D decay map; mouse "paints" force into it. Map decays
  naturally each frame, creating trailing ripple effects.
- **Per-particle angle** — each particle has an intrinsic angle (from home
  position or random). Scatter force applied as `cos(angle)` / `sin(angle)`
  rather than purely radially, producing non-symmetric, organic trajectories.
- **Brightness ↔ character density** — source pixel luminance drives which
  character a particle uses. Lower brightness = lighter/sparser char. This
  gives naturally varying particle "weight."
- **Simplex noise for organic drift** — idle particles use noise sampled from
  `(particleIndex * 0.1, time * 0.1)` for gentle aperiodic drift.

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

### 3. Spu7Nix/obamify (Jump Flood Algorithm + WGSL)

obamify renders one face morphed onto another by reassigning source pixels to
target pixels optimally. The core problem is **particle-to-home assignment**:
which particle gets which home slot?

The JFA (Jump Flood Algorithm) is a GPU-parallel Voronoi computation used to
find the nearest unclaimed home for each particle. The key insight:

> **If particles always return to their birth home, paths cross and the motion
> looks mechanical. If particles dynamically claim the nearest available home,
> paths do not cross and the collective motion looks organic.**

For our CPU context we implement a greedy nearest-neighbor approximation:
on scatter, sort displaced particles by distance to their home cluster, assign
closest first. This is O(n log n) and already produces most of the visual
benefit of full JFA.

obamify also offers an **"Optimal"** mode (true optimal transport / Hungarian
algorithm) but notes it is "extremely slow for high resolutions." We skip this
and use greedy NN.

**Key techniques to adopt:**
- **On-scatter dynamic reassignment** — when `t` resets to 0, run a greedy
  nearest-home reassignment pass. Prevents particle paths from crossing during
  the return journey.
- **Scene-transition optimal matching** — on scene change, match old particle
  positions to new home positions using greedy nearest-neighbor. Minimizes
  total travel distance, producing smoother morphing.
- **Resolution-adaptive sampling** — for image sources, oversample bright
  regions and undersample dark regions so particles concentrate where the image
  has detail.

---

## Improvement Plan

Organized into phases by impact and implementation complexity.

---

### Phase A — Mouse Interaction Quality

**A1. Mouse velocity tracking**

Track `dx`, `dy` between frames. Scatter force scales with mouse speed:

```typescript
// In useMouseTracking or the physics applicator
const mouseSpeed = Math.sqrt(mouseVx * mouseVx + mouseVy * mouseVy);
const speedMultiplier = Math.min(1 + mouseSpeed / 8, 4.0);
effectiveScatterForce = config.scatterForce * speedMultiplier;
```

Fast swipe → dramatic wide scatter. Slow hover → subtle gentle push.
Particles feel proportionally responsive rather than uniformly reactive.

**Files:** `core/types.ts` (add `mouseVelocity` to context), physics modes.

---

**A2. Spatial influence map (touch texture, CPU version)**

Replace per-frame O(n·m) distance checks with an O(w·h + n) influence map:

```typescript
// influence-map.ts — new file
export class InfluenceMap {
  private grid: Float32Array;   // width * height values, 0.0–1.0
  readonly width: number;
  readonly height: number;

  paint(x: number, y: number, radius: number, strength: number): void {
    // Paint Gaussian blob at (x, y) into grid
    const r = Math.ceil(radius);
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const d = Math.sqrt(dx * dx + dy * dy) / radius;
        if (d < 1) {
          const ix = Math.round(x) + dx;
          const iy = Math.round(y) + dy;
          if (ix >= 0 && ix < this.width && iy >= 0 && iy < this.height) {
            this.grid[iy * this.width + ix] += strength * (1 - d * d);
          }
        }
      }
    }
  }

  decay(factor: number): void {
    // Each frame: map *= factor (e.g., 0.85)
    for (let i = 0; i < this.grid.length; i++) {
      this.grid[i] *= factor;
    }
  }

  sample(x: number, y: number): number {
    const ix = Math.round(x);
    const iy = Math.round(y);
    if (ix < 0 || ix >= this.width || iy < 0 || iy >= this.height) return 0;
    return this.grid[iy * this.width + ix];
  }
}
```

Physics applicator samples `influenceMap.sample(p.homeX, p.homeY)` instead of
computing distance to cursor directly. Map decays at ~0.85/frame, creating a
natural ripple trail:

```
Mouse moves → paint force into map
             ↓
Map decays each frame (ripple propagates and fades)
             ↓
Particles sample from map (no per-particle distance math)
```

**Benefits:** trailing ripple effect, O(1) per particle sampling, decoupled
mouse trail from cursor position.

**Files:** `core/influence-map.ts` (new), `physics-modes/flow-matching.ts`,
`components/AsciiDiffusionRenderer.tsx`.

---

**A3. Per-particle angle for directional scatter**

Add `angle` to `AsciiParticle`. Computed once at scene build time from the
particle's home position relative to scene center:

```typescript
// In scene-builder.ts / grid-to-particles.ts
p.angle = Math.atan2(p.homeY - sceneCenterY, p.homeX - sceneCenterX)
          + (Math.random() - 0.5) * 0.5; // ±15° random variation
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

Result: particles don't all fly directly away from the cursor. They veer along
their intrinsic angle, creating a more organic, asymmetric scatter pattern.

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

## New Config Fields Summary

Add to `ExtendedDiffusionConfig` in `core/types.ts`:

```typescript
// Phase A
mouseVelocityScale?: number;    // Scatter force multiplier from mouse speed (default: 1)
influenceMapDecay?: number;     // Per-frame decay of influence map (default: 0.85)
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
| `core/influence-map.ts` | Spatial decay map for mouse influence (touch texture) |
| `scene/assignment.ts` | Greedy nearest-home particle assignment (JFA-inspired) |
| `physics-modes/magnetic.ts` | New attract-with-flow-return mode |

## Modified Files

| File | Changes |
|------|---------|
| `core/types.ts` | New config fields, new particle fields |
| `core/renderer.ts` | Z-depth char mapping, char morph during flight, velocity chars |
| `physics-modes/flow-matching.ts` | Influence map, angle scatter, staggered t, idle drift |
| `physics-modes/diffusion.ts` | Mouse velocity scaling, influence map |
| `scene/grid-to-particles.ts` | Compute `angle`, `flowSpeed` at build time |
| `scene/text-to-particles.ts` | Same: `angle`, `flowSpeed` |
| `scene/image-to-particles.ts` | Same: `angle`, `flowSpeed`; cluster centroid computation |
| `scene/transitions.ts` | Greedy nearest-neighbor morph matching |
| `core/physics.ts` | Register `magnetic` mode |
| `presets/index.ts` | New presets using new config fields |

---

## Implementation Order

| # | Phase | Files | Priority |
|---|-------|-------|----------|
| 1 | A3 — Per-particle angle | types, scene builders | High — visible immediately |
| 2 | E1 — Staggered return timing | flow-matching | High — fixes mechanical look |
| 3 | E2 — Per-particle flow speed variance | types, flow-matching | High |
| 4 | C1 — Char morph during flight | renderer | High — "resolving" visual |
| 5 | A1 — Mouse velocity tracking | flow-matching, diffusion | Medium |
| 6 | A2 — Influence map | influence-map (new), applicators | Medium |
| 7 | D2 — Scene transition matching | assignment (new), transitions | Medium |
| 8 | D1 — On-scatter reassignment | assignment, flow-matching | Medium |
| 9 | F1 — Idle noise drift | flow-matching | Medium |
| 10 | B1/B2 — Z-depth simulation | types, flow-matching, renderer | Low (opt-in) |
| 11 | E3 — 2-phase cluster flow | types, scene builders, flow-matching | Low (opt-in) |
| 12 | G — Magnetic mode | magnetic (new), physics, presets | Low |
| 13 | C2 — Velocity direction chars | renderer | Low (opt-in) |
| 14 | F2 — Idle flicker | renderer | Low (opt-in) |

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
```

---

## What We Are NOT Doing

- **GPU/WebGL rendering** — The entire point of this package is ASCII text in a
  `<pre>` tag. WebGL would require a full rewrite and lose the ASCII aesthetic.
- **Full JFA on CPU** — Greedy nearest-neighbor gives 80% of the visual benefit
  at a fraction of the cost. True JFA is GPU-parallel and not practical here.
- **True 3D projection** — Z-depth is simulated via character density, not actual
  perspective projection. This is intentional; perspective-correct 3D would
  distort the ASCII grid layout.
- **Actual simplex noise library** — We use a cheap two-sin approximation for
  idle drift. It's indistinguishable at the amplitudes we use and adds zero
  dependencies.
