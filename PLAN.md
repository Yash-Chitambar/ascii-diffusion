# ASCII Diffusion — Interactive Particle Physics ASCII Renderer

## Overview

ASCII Diffusion is a standalone, framework-agnostic interactive ASCII art engine powered by particle physics. It renders text, images, and custom shapes as ASCII characters that respond to mouse/touch interaction with spring-mass physics — particles scatter away from the cursor and smoothly return to their home positions.

This is a publishable NPM package and Framer component extracted from the `@yash-chitambar/ascii-diffusion` engine built for the personal website. The personal website's implementation is tightly coupled to its monorepo structure; this standalone version decouples the engine, adds new physics modes, scene composition tools, and a full Framer property panel.

---

## Core Concept

Every visible ASCII character is a **particle** with:
- A **home position** (where it belongs in the final image)
- A **current position** (where it actually is, displaced by physics)
- A **velocity** (momentum from interactions)
- A **character** and **brightness** (what to render)

The engine runs a physics simulation each frame:
1. **Mouse repulsion** — particles near the cursor get pushed away
2. **Spring return** — Hooke's law pulls particles back to their home position
3. **Velocity damping** — friction prevents infinite oscillation
4. **Position integration** — update positions from velocities

The result: ASCII art that feels alive — it reacts to your cursor and settles back into place.

---

## Architecture

```
ascii-diffusion/
├── src/
│   ├── index.ts                         # Package exports
│   ├── index.framer.tsx                 # Framer component registration
│   │
│   ├── core/
│   │   ├── types.ts                     # AsciiParticle, AsciiScene, DiffusionConfig, etc.
│   │   ├── physics.ts                   # Physics engine (spring-mass, repulsion, damping)
│   │   ├── renderer.ts                  # Particle grid → string rendering
│   │   └── animation-loop.ts            # requestAnimationFrame wrapper with throttling
│   │
│   ├── physics-modes/
│   │   ├── diffusion.ts                 # Default: mouse repulsion + spring return (from personal website)
│   │   ├── gravity.ts                   # Particles attract toward cursor instead of repelling
│   │   ├── vortex.ts                    # Particles orbit cursor in a swirling pattern
│   │   ├── explosion.ts                 # Click to explode particles outward, then reassemble
│   │   └── wave.ts                      # Sinusoidal wave propagates from cursor position
│   │
│   ├── scene/
│   │   ├── scene-builder.ts             # Fluent API for composing ASCII scenes
│   │   ├── text-to-particles.ts         # Plain text string → particle array
│   │   ├── grid-to-particles.ts         # 2D char grid → particle array
│   │   ├── image-to-particles.ts        # Image URL → canvas sample → particle array
│   │   └── transitions.ts              # Scene transition strategies (morph, dissolve, swap)
│   │
│   ├── components/
│   │   ├── AsciiDiffusionRenderer.tsx   # Main React component (standalone)
│   │   ├── AsciiDiffusionFramer.tsx     # Framer-specific wrapper with property controls
│   │   └── AsciiTextEffect.tsx          # Simplified component: just text with diffusion
│   │
│   ├── hooks/
│   │   ├── useAnimationLoop.ts          # RAF hook with delta time + throttle
│   │   ├── useParticlePhysics.ts        # Physics state management hook
│   │   ├── useMouseTracking.ts          # Mouse/touch position tracking in grid coords
│   │   └── useSceneTransition.ts        # Animated scene switching hook
│   │
│   └── presets/
│       └── index.ts                     # Pre-built config presets (gentle, aggressive, etc.)
│
├── package.json
├── tsconfig.json
├── framer.json
└── README.md
```

---

## Implementation Plan

### Phase 1: Core Engine (Port & Refactor)

Port the existing engine from the personal website monorepo, refactoring for standalone use with zero external dependencies (beyond React as a peer dep).

#### 1.1 — Type System (`core/types.ts`)

**Port from:** `personal_website/packages/ascii-diffusion/src/types.ts`

```typescript
// Carried over directly from personal website
export interface AsciiParticle {
  id: number;
  homeX: number;           // Target grid column
  homeY: number;           // Target grid row
  currentX: number;        // Actual position (displaced by physics)
  currentY: number;
  vx: number;              // Velocity X
  vy: number;              // Velocity Y
  char: string;            // ASCII character to render
  brightness: number;      // 0.0–1.0
  color?: string;          // Optional CSS color
}

export interface AsciiScene {
  particles: AsciiParticle[];
  width: number;           // Grid columns
  height: number;          // Grid rows
  config: DiffusionConfig;
}

export interface DiffusionConfig {
  scatterRadius: number;   // Mouse effect radius in cells
  scatterForce: number;    // Repulsion strength
  springK: number;         // Spring constant (return force)
  damping: number;         // Velocity decay (0–1)
}

export const DEFAULT_DIFFUSION_CONFIG: DiffusionConfig = {
  scatterRadius: 8,
  scatterForce: 0.8,
  springK: 0.05,
  damping: 0.92,
};
```

**New additions:**
```typescript
// Physics mode selection
export type PhysicsMode = 'diffusion' | 'gravity' | 'vortex' | 'explosion' | 'wave';

// Extended config for new physics modes
export interface ExtendedDiffusionConfig extends DiffusionConfig {
  physicsMode: PhysicsMode;
  // Vortex-specific
  vortexStrength?: number;     // Orbital speed multiplier
  vortexRadius?: number;       // Effect radius
  // Explosion-specific
  explosionForce?: number;     // Initial outward velocity
  reassembleDelay?: number;    // ms before particles return
  // Wave-specific
  waveAmplitude?: number;      // Displacement amount
  waveFrequency?: number;      // Oscillation speed
  waveDecay?: number;          // Distance falloff
}

// Transition configuration
export type TransitionMode = 'morph' | 'dissolve' | 'instant';

// Color mode for rendered output
export type ColorMode = 'mono' | 'per-particle' | 'brightness-mapped';

export interface RenderConfig {
  colorMode: ColorMode;
  monoColor: string;           // Used in 'mono' mode
  backgroundColor: string;
  fontSize: string;            // CSS value, e.g., 'clamp(6px, 1.2vw, 14px)'
  fontFamily: string;
  lineHeight: number;
  letterSpacing: string;
  disableLigatures: boolean;   // default true
}
```

#### 1.2 — Physics Engine (`core/physics.ts`)

**Port from:** `personal_website/packages/ascii-diffusion/src/physics.ts`

Existing code to carry over exactly:
- `applyDiffusionPhysics(particles, mousePos, config, dt)` — the core simulation loop:
  1. Mouse repulsion: `force = scatterForce / distSq` within `scatterRadius`
  2. Spring return: `F = springK * (home - current)`
  3. Damping: `v *= damping`
  4. Integration: `pos += v * dtScale`
- `renderParticlesToGrid(particles, width, height)` — particles → string grid with brightness-based cell priority
- Delta time normalization: `dtScale = dt / 33` (normalized to ~30fps)

**Refactor:** Extract the physics application into a pluggable interface:
```typescript
export interface PhysicsApplicator {
  apply(
    particles: AsciiParticle[],
    mousePos: { x: number; y: number } | null,
    config: ExtendedDiffusionConfig,
    dt: number
  ): void;
}
```

The default `applyDiffusionPhysics` becomes the `diffusion` implementor. New modes plug in as additional implementors (Phase 2).

#### 1.3 — Renderer (`core/renderer.ts`)

**Port from:** `physics.ts` `renderParticlesToGrid` + `AsciiDiffusionRenderer.tsx` DOM rendering

Split rendering into two concerns:

1. **Grid builder:** particles → 2D character grid (same algorithm as personal website: round positions, brightest-wins per cell)
2. **String serializer:** grid → output string with optional per-character color spans

```typescript
// Monochrome mode: simple string output (same as personal website)
function renderToString(particles: AsciiParticle[], width: number, height: number): string;

// Color mode: returns array of { char, color } per cell for DOM rendering
function renderToColorGrid(particles: AsciiParticle[], width: number, height: number): ColorCell[][];

interface ColorCell {
  char: string;
  color: string | null;  // null = use default color
}
```

#### 1.4 — Animation Loop (`core/animation-loop.ts`)

**Port from:** `personal_website/packages/ascii-diffusion/src/useAnimationLoop.ts`

Carry over directly:
- `useAnimationLoop(callback: (time, delta) => void)` — custom RAF hook
- 30fps throttle: skip frames where `delta < 33ms`
- Delta clamping: `Math.min(delta, 50)` to prevent physics explosion after tab switch
- Proper cleanup via `cancelAnimationFrame` on unmount

**New addition:** Make it work as both a React hook and a standalone class:
```typescript
// React hook (existing)
export function useAnimationLoop(callback: AnimationCallback): void;

// Standalone class (for non-React usage)
export class AnimationLoop {
  constructor(callback: AnimationCallback, targetFps?: number);
  start(): void;
  stop(): void;
  setTargetFps(fps: number): void;
}
```

---

### Phase 2: Physics Modes

Each mode implements the `PhysicsApplicator` interface and replaces the mouse interaction behavior while keeping spring return and damping.

#### 2.1 — Diffusion Mode (`physics-modes/diffusion.ts`)

**Direct port of existing behavior.** This is the default.
- Mouse repulsion: particles push away from cursor
- Spring return: particles pull back to home
- Damping: velocity decays each frame

#### 2.2 — Gravity Mode (`physics-modes/gravity.ts`)

Inverted repulsion — particles are attracted to the cursor:
```typescript
// Instead of: force pushes AWAY from mouse
// Gravity: force pulls TOWARD mouse
const dx = mousePos.x - p.currentX;  // Note: reversed direction
const dy = mousePos.y - p.currentY;
const force = gravityStrength / (distSq + softening);
p.vx += (dx / dist) * force * dtScale;
p.vy += (dy / dist) * force * dtScale;
```
- Particles cluster around the cursor, forming a dense blob
- Spring return still active — release cursor and they snap back
- Softening parameter prevents singularity at cursor position

#### 2.3 — Vortex Mode (`physics-modes/vortex.ts`)

Particles orbit the cursor in a swirling pattern:
```typescript
// Perpendicular force creates orbital motion
const angle = Math.atan2(dy, dx);
const tangentX = Math.cos(angle + Math.PI / 2);
const tangentY = Math.sin(angle + Math.PI / 2);
const orbitalForce = vortexStrength / dist;
p.vx += tangentX * orbitalForce * dtScale;
p.vy += tangentY * orbitalForce * dtScale;
```
- Combines tangential (orbital) force with slight radial attraction
- Creates a whirlpool effect around the cursor
- **Inspired by:** The spiral motion in the personal website's blackhole act (`HeroSequence.tsx:169-171`)

#### 2.4 — Explosion Mode (`physics-modes/explosion.ts`)

Click triggers an outward explosion, then particles reassemble:
```typescript
// On click: apply explosive outward force to all particles within radius
function triggerExplosion(particles, center, force, radius): void {
  for (const p of particles) {
    const dx = p.currentX - center.x;
    const dy = p.currentY - center.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < radius) {
      const strength = force * (1 - dist / radius);
      p.vx += (dx / dist) * strength;
      p.vy += (dy / dist) * strength;
    }
  }
}
```
- On click: explosive outward force
- After `reassembleDelay` ms: spring forces pull particles home
- **Inspired by:** The personal website's blackhole→reveal transition where particles collapse to center then explode outward into the name text

#### 2.5 — Wave Mode (`physics-modes/wave.ts`)

Sinusoidal displacement wave propagates from cursor:
```typescript
// Displacement based on distance from mouse and time
const dist = Math.sqrt(dx * dx + dy * dy);
const phase = dist * waveFrequency - time * 0.005;
const displacement = waveAmplitude * Math.sin(phase) * Math.exp(-dist * waveDecay);
p.currentY = p.homeY + displacement;
```
- Cursor position is the wave origin
- Concentric ripples spread outward
- Exponential distance decay prevents infinite propagation
- Only displaces vertically (or radially) — characters shift up/down in wave pattern

---

### Phase 3: Scene Composition

Tools for creating and composing ASCII scenes from various sources.

#### 3.1 — Text-to-Particles (`scene/text-to-particles.ts`)

**Port from:** `personal_website/packages/ascii-converter/src/grid-utils.ts` (`textToParticles`)

Carry over:
- Line splitting, per-character iteration
- Offset positioning (`offsetX`, `offsetY`)
- Skip spaces
- Configurable brightness and color

**New additions:**
- **Block text rendering:** Large ASCII block letters (like the personal website's `name-text.ts` data)
  ```typescript
  function textToBlockParticles(
    text: string,
    options?: {
      font?: 'standard' | 'small' | 'banner';
      offsetX?: number;
      offsetY?: number;
      color?: string;
    }
  ): AsciiParticle[];
  ```
  Includes 2–3 built-in block fonts (simple character-grid letter definitions, similar to `name-text.ts` in the personal website)

#### 3.2 — Grid-to-Particles (`scene/grid-to-particles.ts`)

**Port from:** `personal_website/packages/ascii-converter/src/grid-utils.ts` (`gridToParticles`)

Carry over exactly:
- 2D string array → particle array
- `charToBrightness()` for brightness from character
- Optional scattered start positions
- Skip spaces

#### 3.3 — Image-to-Particles (`scene/image-to-particles.ts`) ✅

**Implemented.** Synchronous API taking an already-loaded `HTMLImageElement`:
- `imageToAsciiScene(img, gridWidth, gridHeight, options): AsciiScene`
- Canvas-based pixel sampling at grid resolution
- BT.601 perceived brightness: `(0.299*R + 0.587*G + 0.114*B) / 255 * alpha`
- Imports `brightnessToCh` from `grid-to-particles.ts` (shared brightness ramp)
- Options: `scattered`, `scatterRadius`, `brightnessThreshold`, `config` override

#### 3.4 — Scene Builder (`scene/scene-builder.ts`)

Fluent API for composing complex multi-layer scenes:

```typescript
const scene = new SceneBuilder(120, 45)
  .addText("HELLO WORLD", { x: 10, y: 5, color: '#00d4ff' })
  .addImage("/photo.jpg", { scattered: true })
  .addGrid(customAsciiArt, { x: 0, y: 20 })
  .setConfig({ scatterRadius: 10, springK: 0.08 })
  .build();
```

**Methods:**
- `addText(text, options)` — adds text particles at position
- `addBlockText(text, options)` — adds block letter particles
- `addImage(src, options)` — adds image-sampled particles (async)
- `addGrid(grid, options)` — adds pre-made ASCII art
- `addParticles(particles)` — adds raw particle array
- `setConfig(config)` — sets physics config
- `build(): AsciiScene` — finalizes and returns the scene
- `buildAsync(): Promise<AsciiScene>` — for scenes with async sources (images)

#### 3.5 — Scene Transitions (`scene/transitions.ts`)

Animated transitions between two scenes:

```typescript
type TransitionMode = 'morph' | 'dissolve' | 'instant';

function transitionScenes(
  from: AsciiScene,
  to: AsciiScene,
  mode: TransitionMode
): AsciiScene;
```

**Morph (default):** Reuse particles from old scene, update home positions to new scene. Particles smoothly migrate via spring physics. Excess particles collapse to center; missing particles spawn from center.
- **Ported from:** `AsciiDiffusionRenderer.tsx:71-104` — the existing scene transition logic that reuses old particle positions and velocities

**Dissolve:** Old particles fade out (brightness → 0) while new particles fade in (brightness 0 → target). Cross-fade controlled by a 0.0–1.0 progress value.

**Instant:** Swap particles immediately, no animation.

---

### Phase 4: React Components

#### 4.1 — Main Renderer (`components/AsciiDiffusionRenderer.tsx`)

**Port from:** `personal_website/packages/ascii-diffusion/src/AsciiDiffusionRenderer.tsx`

This is the core rendering component. Carry over:
- `<pre>` element as rendering surface
- Character dimension measurement (hidden span technique)
- Mouse/touch event tracking (convert screen coords to grid coords)
- Scene transition handling (reuse particles, update homes)
- Animation loop integration (RAF callback → physics → render → DOM update)
- Direct DOM mutation: `preRef.current.textContent = text`
- `onFrame` callback for external per-frame effects
- `onTransitionComplete` callback for scene change detection
- Accessible: `role="img"`, `aria-label`
- Font styling: JetBrains Mono, ligature disabled, responsive `clamp()` font size

**New additions:**
- **Physics mode prop:** Select between diffusion/gravity/vortex/explosion/wave
- **Color rendering mode:** Support per-particle colors via `<span>` elements (optional, off by default for performance)
- **Click handler:** For explosion mode (trigger on click)
- **Cursor style:** Dynamic cursor based on physics mode (crosshair, grab, pointer)

```typescript
export interface AsciiDiffusionRendererProps {
  scene: AsciiScene;
  physicsMode?: PhysicsMode;        // default 'diffusion'
  onFrame?: (particles: AsciiParticle[], time: number, delta: number) => void;
  onTransitionComplete?: () => void;
  onClick?: (gridX: number, gridY: number) => void;
  config?: Partial<ExtendedDiffusionConfig>;
  renderConfig?: Partial<RenderConfig>;
  enableTouch?: boolean;            // default true
  enableColor?: boolean;            // default false (mono is faster)
  className?: string;
}
```

#### 4.2 — Simplified Text Effect (`components/AsciiTextEffect.tsx`)

A convenience component for the most common use case: interactive ASCII text.

```typescript
interface AsciiTextEffectProps {
  /** The text to display */
  text: string;
  /** Use block letters (large ASCII art) or plain monospace */
  blockText?: boolean;
  /** Physics interaction mode */
  physicsMode?: PhysicsMode;
  /** Color for the text characters */
  color?: string;
  /** Start with particles scattered, then assemble */
  animateIn?: boolean;
  /** Physics tuning */
  scatterRadius?: number;
  springK?: number;
  damping?: number;
  className?: string;
}
```

This component:
1. Converts text to particles (plain or block letters)
2. Wraps `AsciiDiffusionRenderer` with sensible defaults
3. Optionally starts scattered and animates to assembled position
4. Handles all sizing/measurement internally

**Usage:**
```tsx
<AsciiTextEffect
  text="HELLO WORLD"
  blockText
  physicsMode="diffusion"
  color="#00d4ff"
  animateIn
/>
```

#### 4.3 — Framer Wrapper (`components/AsciiDiffusionFramer.tsx`)

Framer-specific component with property panel controls:

```typescript
interface AsciiDiffusionFramerProps {
  // Content
  contentType: 'text' | 'blockText' | 'image' | 'custom';
  text: string;
  imageSrc: string;

  // Physics
  physicsMode: PhysicsMode;
  scatterRadius: number;
  scatterForce: number;
  springK: number;
  damping: number;

  // Appearance
  colorMode: ColorMode;
  monoColor: string;
  backgroundColor: string;
  fontSize: number;
  animateIn: boolean;

  // Transitions
  transitionMode: TransitionMode;
}
```

Registered with Framer property controls in `index.framer.tsx`.

---

### Phase 5: Hooks Library

Reusable hooks extracted for advanced usage.

#### 5.1 — `useAnimationLoop` (ported from personal website)

Exact port. No changes needed.

#### 5.2 — `useParticlePhysics`

Manages particle state + physics application:
```typescript
function useParticlePhysics(
  scene: AsciiScene,
  physicsMode?: PhysicsMode,
  configOverride?: Partial<ExtendedDiffusionConfig>
): {
  particlesRef: MutableRefObject<AsciiParticle[]>;
  applyPhysics: (mousePos: { x: number; y: number } | null, dt: number) => void;
  triggerExplosion: (x: number, y: number) => void;
};
```

#### 5.3 — `useMouseTracking`

Extracted from `AsciiDiffusionRenderer.tsx:108-149`:
```typescript
function useMouseTracking(
  elementRef: RefObject<HTMLElement>,
  charSize: { width: number; height: number },
  enableTouch?: boolean
): MutableRefObject<{ x: number; y: number } | null>;
```

#### 5.4 — `useSceneTransition`

Manages animated scene switching:
```typescript
function useSceneTransition(
  scene: AsciiScene,
  mode?: TransitionMode
): {
  currentParticles: MutableRefObject<AsciiParticle[]>;
  isTransitioning: boolean;
};
```

---

### Phase 6: Configuration Presets

Pre-built config combinations for common aesthetics:

```typescript
export const PRESETS = {
  gentle: {
    scatterRadius: 5,
    scatterForce: 0.3,
    springK: 0.03,
    damping: 0.95,
  },
  responsive: {
    // Default — same as personal website
    scatterRadius: 8,
    scatterForce: 0.8,
    springK: 0.05,
    damping: 0.92,
  },
  aggressive: {
    scatterRadius: 12,
    scatterForce: 2.0,
    springK: 0.08,
    damping: 0.85,
  },
  jelly: {
    // Low spring, high damping — particles wobble slowly
    scatterRadius: 10,
    scatterForce: 1.0,
    springK: 0.02,
    damping: 0.97,
  },
  snappy: {
    // High spring, low damping — particles snap back fast
    scatterRadius: 6,
    scatterForce: 0.5,
    springK: 0.15,
    damping: 0.80,
  },
  magnetic: {
    // For gravity mode — strong pull with slow release
    scatterRadius: 15,
    scatterForce: 1.5,
    springK: 0.04,
    damping: 0.90,
    physicsMode: 'gravity' as const,
  },
} as const;
```

---

## Dependencies

```json
{
  "peerDependencies": {
    "react": "^18.0.0 || ^19.0.0",
    "react-dom": "^18.0.0 || ^19.0.0"
  },
  "devDependencies": {
    "@types/react": "^19",
    "typescript": "^5"
  }
}
```

Zero runtime dependencies. React is the only peer dependency. The Framer wrapper adds `framer` and `framer-motion` as peer deps only for the Framer-specific entry point.

---

## File-by-File Implementation Order

| # | File | Description | Est. Lines |
|---|------|-------------|------------|
| 1 | `core/types.ts` | All interfaces, defaults, type definitions | ~100 |
| 2 | `core/physics.ts` | Port physics engine + pluggable interface | ~70 |
| 3 | `core/renderer.ts` | Grid builder + string/color serializer | ~100 |
| 4 | `core/animation-loop.ts` | RAF hook + standalone class | ~70 |
| 5 | `physics-modes/diffusion.ts` | Default diffusion mode (ported) | ~55 |
| 6 | `physics-modes/gravity.ts` | Gravity attraction mode | ~45 |
| 7 | `physics-modes/vortex.ts` | Vortex orbital mode | ~55 |
| 8 | `physics-modes/explosion.ts` | Click-to-explode mode | ~60 |
| 9 | `physics-modes/wave.ts` | Sinusoidal wave mode | ~50 |
| 10 | `scene/text-to-particles.ts` | Text + block text → particles | ~120 |
| 11 | `scene/grid-to-particles.ts` | Grid → particles (ported) | ~45 |
| 12 | `scene/image-to-particles.ts` | Image → particles (ported) | ~100 |
| 13 | `scene/scene-builder.ts` | Fluent scene composition API | ~100 |
| 14 | `scene/transitions.ts` | Morph/dissolve/instant transitions | ~80 |
| 15 | `hooks/useAnimationLoop.ts` | RAF hook (ported) | ~40 |
| 16 | `hooks/useParticlePhysics.ts` | Physics state management | ~60 |
| 17 | `hooks/useMouseTracking.ts` | Mouse/touch tracking | ~55 |
| 18 | `hooks/useSceneTransition.ts` | Scene transition management | ~50 |
| 19 | `presets/index.ts` | Config presets | ~50 |
| 20 | `components/AsciiDiffusionRenderer.tsx` | Main renderer (ported + extended) | ~220 |
| 21 | `components/AsciiTextEffect.tsx` | Simplified text component | ~80 |
| 22 | `components/AsciiDiffusionFramer.tsx` | Framer wrapper | ~100 |
| 23 | `index.ts` | Package exports | ~30 |
| 24 | `index.framer.tsx` | Framer registration + property controls | ~120 |

**Total estimated:** ~1,855 lines

---

## Key Patterns from Personal Website to Preserve

1. **Physics loop order:** repulsion → spring → damping → integration (this order matters for stability)
2. **Delta time normalization:** `dtScale = dt / 33` normalizes forces to ~30fps baseline
3. **Delta clamping:** `Math.min(delta, 50)` prevents physics explosion after tab switch
4. **Brightest-wins rendering:** When two particles occupy the same cell, the brighter one renders
5. **Scene transitions:** Reuse old particle positions/velocities for smooth morphing (lines 71-104 of `AsciiDiffusionRenderer.tsx`)
6. **Direct DOM mutation:** `preRef.current.textContent = text` bypasses React re-render for performance
7. **Character measurement:** Hidden `<span>M</span>` technique for monospace char dimensions
8. **Font settings:** `font-feature-settings: "liga" 0, "calt" 0` and monospace font stack
9. **Responsive font:** `clamp(6px, 1.2vw, 14px)` scales with viewport
10. **RAF cleanup:** Always `cancelAnimationFrame` on unmount to prevent memory leaks

---

## Relationship to ASCII Converter

These two packages are complementary but independent:

- **ascii-converter** (ASCIIfy): Focuses on **media → ASCII rendering** — images, videos, 3D models converted to ASCII art with palettes, fit modes, and CRT effects. It's a visual display component.

- **ascii-diffusion** (this package): Focuses on **interactive ASCII physics** — any ASCII content (text, images, custom art) made interactive with particle physics. It's an interaction engine.

They can be combined: use ascii-converter to generate the ASCII grid from an image, then feed those particles into ascii-diffusion for interactive mouse physics. But each stands alone as a useful tool.
