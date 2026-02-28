# ASCII Diffusion — TODO

Implementation checklist. Work top-to-bottom; each item depends on those above it.

---

## Phase 1: Project Scaffold

- [ ] Initialize `package.json` (name, version, exports, peer deps)
- [ ] Add `tsconfig.json` (strict, ESM, `src/` → `dist/`)
- [ ] Create `src/` directory tree matching architecture in `CLAUDE.md`

---

## Phase 2: Core Types & Interfaces

**File:** `src/core/types.ts`

- [ ] Define `AsciiParticle` interface (include `t: number` for flow matching)
- [ ] Define `AsciiScene` interface
- [ ] Define `DiffusionConfig` and `ExtendedDiffusionConfig`
- [ ] Define `PhysicsMode` union type (include `'flow-matching'` as default)
- [ ] Define `RenderConfig` and `ColorMode`
- [ ] Define `TransitionMode`
- [ ] Export `DEFAULT_DIFFUSION_CONFIG` constant

---

## Phase 3: Physics Engine Core

**File:** `src/core/physics.ts`

- [ ] Define `PhysicsApplicator` interface
- [ ] Implement `getPhysicsApplicator(mode: PhysicsMode): PhysicsApplicator` dispatcher
- [ ] Write `renderParticlesToGrid(particles, width, height): string[][]` (brightest-wins)

**File:** `src/core/renderer.ts`

- [ ] `renderToString(particles, width, height): string` — monochrome output
- [ ] `renderToColorGrid(particles, width, height): ColorCell[][]` — per-character colors

**File:** `src/core/animation-loop.ts`

- [ ] `useAnimationLoop(callback): void` — React RAF hook with 30fps throttle + delta clamp
- [ ] `AnimationLoop` class — standalone (non-React) equivalent

---

## Phase 4: Flow Matching (Primary Physics Mode)

**File:** `src/physics-modes/flow-matching.ts`

This is the core contribution. Implement carefully.

- [ ] Define `FlowMatchingConfig` (extends base config):
  - `flowSpeed: number` — how fast `t` advances per frame (default `0.04`)
  - `epsilon: number` — denominator guard at `t=1` (default `0.01`)
  - `resetOnScatter: boolean` — reset `t → 0` when mouse pushes particle (default `true`)

- [ ] Implement `applyFlowMatching(particles, mousePos, config, dt)`:
  1. **Mouse repulsion** — same as diffusion mode; if `resetOnScatter`, set `p.t = 0` for disturbed particles
  2. **Advance flow time** — `p.t = Math.min(p.t + flowSpeed * dtScale, 1)`
  3. **Flow velocity** — `v = (home - current) / (1 - p.t + epsilon)`; scale by `dtScale`
  4. **Add flow velocity to particle velocity** (don't set directly — blend with existing momentum)
  5. **Damping** — `p.vx *= damping; p.vy *= damping`
  6. **Integration** — `p.currentX += p.vx * dtScale`

- [ ] Verify no oscillation: at `t=1`, velocity field magnitude → 0, particle stops exactly at home
- [ ] Handle edge case: if particle is already at home (`dist < 0.1`), clamp `t = 1`, zero velocity

---

## Phase 5: Additional Physics Modes

- [ ] **`src/physics-modes/diffusion.ts`** — classic spring-mass: `F = springK * (home - current)`, damping, integration
- [ ] **`src/physics-modes/gravity.ts`** — attraction toward cursor: reversed repulsion direction
- [ ] **`src/physics-modes/vortex.ts`** — perpendicular tangential force around cursor
- [ ] **`src/physics-modes/explosion.ts`** — `triggerExplosion(center, force, radius)` + spring reassembly after delay
- [ ] **`src/physics-modes/wave.ts`** — sinusoidal displacement: `sin(dist * freq - time * 0.005) * exp(-dist * decay)`

---

## Phase 6: Scene Composition

- [ ] **`src/scene/text-to-particles.ts`**
  - `textToParticles(text, options)` — plain monospace text → particles
  - `textToBlockParticles(text, options)` — large ASCII block letters

- [ ] **`src/scene/grid-to-particles.ts`**
  - `gridToParticles(grid, options)` — 2D string array → particles
  - `charToBrightness(char)` — map ASCII char to 0.0–1.0 brightness

- [ ] **`src/scene/image-to-particles.ts`**
  - `imageToAsciiScene(src, gridWidth, gridHeight, options): Promise<AsciiScene>`
  - `imageDataToParticles(imageData, w, h, scattered)` — canvas pixel → particle
  - `rgbToBrightness(r, g, b)` — luminosity formula

- [ ] **`src/scene/scene-builder.ts`**
  - `SceneBuilder` class with fluent API: `.addText()`, `.addImage()`, `.addGrid()`, `.build()`, `.buildAsync()`

- [ ] **`src/scene/transitions.ts`**
  - `transitionScenes(from, to, mode)` — morph (reuse particles), dissolve (brightness cross-fade), instant (swap)

---

## Phase 7: React Hooks

- [ ] **`src/hooks/useAnimationLoop.ts`** — thin re-export of core animation loop as hook
- [ ] **`src/hooks/useParticlePhysics.ts`** — manage particle state + physics dispatch
- [ ] **`src/hooks/useMouseTracking.ts`** — convert screen coords → grid coords, touch support
- [ ] **`src/hooks/useSceneTransition.ts`** — animated scene switching with `isTransitioning` state

---

## Phase 8: React Components

- [ ] **`src/components/AsciiDiffusionRenderer.tsx`**
  - `<pre>` render surface
  - Char dimension measurement (`<span>M</span>` hidden technique)
  - Mouse + touch event handling
  - RAF → physics → `preRef.current.textContent` (direct DOM, no React re-render)
  - `onFrame`, `onTransitionComplete`, `onClick` callbacks
  - Flow matching as default `physicsMode`

- [ ] **`src/components/AsciiTextEffect.tsx`** — convenience wrapper: text → particles → renderer

- [ ] **`src/components/AsciiDiffusionFramer.tsx`** — Framer property panel + controls

---

## Phase 9: Presets & Exports

- [ ] **`src/presets/index.ts`** — named presets: `gentle`, `responsive`, `aggressive`, `jelly`, `snappy`, `magnetic`; add `flow` preset tuned for flow matching defaults

- [ ] **`src/index.ts`** — public package exports (components, hooks, types, presets, scene builders)

- [ ] **`src/index.framer.tsx`** — Framer component registration with property controls

---

## Phase 10: Demo & Docs

- [ ] Add `demo/` directory with a minimal HTML/React demo showing flow matching in action
- [ ] Update `PLAN.md` → `README.md` (trim to user-facing docs)

---

## Implementation Start Order

1. `core/types.ts` — everything depends on this
2. `physics-modes/flow-matching.ts` — core feature, validate in isolation first
3. `core/physics.ts` + `core/renderer.ts` — wire flow matching into the engine
4. `core/animation-loop.ts`
5. `scene/text-to-particles.ts` — need particles to test the renderer
6. `components/AsciiDiffusionRenderer.tsx` — first visual output
7. Everything else
