# ASCII Diffusion — CLAUDE.md

Developer context for Claude Code sessions working on this repo.

---

## What This Is

An NPM package + Framer component that renders ASCII art as a particle physics simulation. Every visible character is a particle with a **home position** (where it belongs) and a **current position** (where physics has displaced it). Particles scatter on mouse interaction and return home via a **flow matching** velocity field — the core contribution of this package over naive spring physics.

Full architecture plan: `PLAN.md`

---

## Branch

All work goes on: `claude/flow-matching-ascii-particles-wNv34`

---

## Key Technical Concept: Flow Matching

The differentiating feature of this package is how particles return to their home positions. Plain spring physics (Hooke's law) is reactive and can overshoot. **Flow matching** defines a smooth interpolated velocity field that guides particles from any scattered position directly to their target — no oscillation, predictable paths.

### How it works

1. **Particle-to-target assignment** (inspired by obamify's JFA approach): when particles are scattered, use spatial assignment to decide which particle "owns" which home slot. Rather than locking each particle to its birth home, we can reassign dynamically for smoother collective motion.

2. **Velocity field construction**: given current positions `x` and target positions `x_1`, the flow matching vector field at time `t` is:

   ```
   v(x, t) = (x_1 - x) / (1 - t)
   ```

   This is the **conditional flow** from the Flow Matching paper (Lipman et al., 2022). At `t=0` particles start scattered; at `t=1` they're exactly at home. The velocity shrinks as `t→1`, giving a smooth deceleration rather than spring overshoot.

3. **Integration**: step `t` forward each frame using the current delta time, clamped to `[0, 1]`. Position updates:

   ```
   dx/dt = v(x, t) = (home - current) / (1 - t + epsilon)
   ```

4. **Interaction**: mouse repulsion temporarily pushes particles off their flow path. When the mouse leaves, `t` resets to restart the return journey from the new scattered position.

### Why not just a spring?

| Spring | Flow Matching |
|--------|---------------|
| Oscillates around home | Arrives and stops |
| Force depends only on displacement | Force depends on displacement AND time |
| Damping is a hack to stop oscillation | No oscillation by design |
| No global coordination | Can assign particles optimally |

---

## Codebase Layout

```
demo/
└── index.html                  # Self-contained browser demo (image upload → ASCII)

src/
├── core/
│   ├── types.ts                # Interfaces: AsciiParticle, AsciiScene, configs
│   ├── physics.ts              # PhysicsApplicator interface + dispatcher
│   ├── renderer.ts             # Particles → char grid → string
│   └── animation-loop.ts      # RAF hook + standalone AnimationLoop class
│
├── physics-modes/
│   ├── flow-matching.ts        # PRIMARY: flow matching return-to-home
│   ├── diffusion.ts            # Fallback: classic spring-mass repulsion
│   ├── gravity.ts              # Attraction toward cursor
│   ├── vortex.ts               # Orbital swirl around cursor
│   ├── explosion.ts            # Click-to-explode + reassemble
│   └── wave.ts                 # Sinusoidal wave from cursor
│
├── scene/
│   ├── scene-builder.ts        # Fluent API: .addText().addImage().build()
│   ├── text-to-particles.ts    # String → AsciiParticle[]
│   ├── grid-to-particles.ts    # 2D char grid → AsciiParticle[]
│   ├── image-to-particles.ts   # Image URL → canvas sample → AsciiParticle[]
│   └── transitions.ts          # morph | dissolve | instant between scenes
│
├── components/
│   ├── AsciiDiffusionRenderer.tsx  # Main React component
│   ├── AsciiDiffusionFramer.tsx    # Framer wrapper + property panel
│   └── AsciiTextEffect.tsx         # Simplified text-only component
│
├── hooks/
│   ├── useAnimationLoop.ts     # RAF + delta time + throttle
│   ├── useParticlePhysics.ts   # Physics state management
│   ├── useMouseTracking.ts     # Mouse/touch → grid coords
│   └── useSceneTransition.ts   # Scene switch animation
│
├── presets/
│   └── index.ts                # Named config presets (gentle, snappy, etc.)
│
├── index.ts                    # Package exports
└── index.framer.tsx            # Framer component registration
```

---

## Physics Loop Order (critical — do not reorder)

```
1. Mouse repulsion   (push particles away from cursor)
2. Flow matching     (pull particles toward home via velocity field)
3. Damping           (v *= damping, reduces momentum)
4. Integration       (pos += v * dtScale)
```

Spring return in the old engine becomes flow matching in step 2. The order matters for numerical stability.

---

## Key Implementation Rules

- **Delta time normalization**: `dtScale = dt / 33` (normalizes to ~30fps baseline)
- **Delta clamping**: `Math.min(delta, 50)` — prevents physics explosion after tab switch
- **Brightest-wins rendering**: when two particles land on the same grid cell, the higher `brightness` one renders
- **Direct DOM mutation**: `preRef.current.textContent = text` — bypass React re-render for 60fps
- **Char measurement**: hidden `<span>M</span>` to get monospace character pixel dimensions
- **Font settings**: `font-feature-settings: "liga" 0, "calt" 0` — disable ligatures
- **RAF cleanup**: always `cancelAnimationFrame` on unmount
- **Flow matching epsilon**: use `epsilon = 0.01` in denominator `(1 - t + epsilon)` to avoid division by zero at `t=1`

---

## Flow Matching Particle Schema

```typescript
interface AsciiParticle {
  id: number;
  homeX: number;       // Target column (final destination)
  homeY: number;       // Target row
  currentX: number;    // Actual position now
  currentY: number;
  vx: number;          // Velocity
  vy: number;
  t: number;           // Flow matching time in [0, 1]; 1 = arrived home
  char: string;
  brightness: number;  // 0.0–1.0
  color?: string;
}
```

The `t` field is new vs. plain spring physics. It tracks each particle's progress along its flow trajectory.

---

## Development Setup

```bash
npm install          # Install deps
npm run build        # tsc compile
npm run dev          # Watch mode
```

Stack: TypeScript, React 18/19 peer dep, zero runtime dependencies.

### Demo

Open `demo/index.html` directly in a browser (no build step required). Upload an image to see flow matching in action. Click and drag to scatter particles.

---

## Reference

- `PLAN.md` — full architecture and implementation plan with code sketches
- Obamify (https://github.com/Spu7Nix/obamify) — JFA-based particle assignment reference
- Flow Matching paper (Lipman et al., 2022) — mathematical basis for the return trajectory
