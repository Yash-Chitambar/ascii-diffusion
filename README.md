# ASCII Diffusion

Interactive ASCII art engine powered by **flow matching** particle physics. Characters scatter on mouse interaction and return home via a smooth velocity field — no spring overshoot, no oscillation.

## Install

```bash
npm install @yash-chitambar/ascii-diffusion
```

React 18/19 is an optional peer dependency (only needed for hooks and components).

## Quick Start

### Vanilla JS

```js
import {
  textToParticles,
  getPhysicsApplicator,
  renderToString,
} from '@yash-chitambar/ascii-diffusion';

const particles = textToParticles('Hello World', { scattered: true, scatterRadius: 20 });
const physics = getPhysicsApplicator('flow-matching');
const config = { scatterRadius: 8, scatterForce: 0.8, springK: 0.05, damping: 0.92, physicsMode: 'flow-matching', flowSpeed: 0.04, epsilon: 0.01, resetOnScatter: true };

function animate() {
  physics.apply(particles, null, config, 16);
  const frame = renderToString(particles, 80, 24);
  document.querySelector('pre').textContent = frame;
  requestAnimationFrame(animate);
}
animate();
```

### React

```tsx
import { AsciiTextEffect } from '@yash-chitambar/ascii-diffusion';

function App() {
  return <AsciiTextEffect text="Hello World" width={80} height={10} />;
}
```

Or use the lower-level `AsciiDiffusionRenderer` for full control over scenes, physics modes, and transitions.

## Features

### Physics Modes

| Mode | Behavior |
|------|----------|
| `flow-matching` | Smooth velocity field return (default) |
| `magnetic` | Cursor attracts particles, flow matching return |
| `diffusion` | Spring-based scatter and return |
| `gravity` | Particles attracted toward cursor |
| `vortex` | Orbital swirl around cursor |
| `explosion` | Click-to-explode + reassemble |
| `wave` | Sinusoidal wave from cursor |

### Visual Effects

- **Character morphing** — particles show scatter chars (`.`, `·`, `,`) while in flight, morphing back to their true character as they arrive home
- **Z-depth simulation** — particles displace in a virtual Z axis; receded particles fade, close particles densify
- **Velocity direction chars** — fast particles show directional glyphs (`−`, `\`, `|`, `/`)
- **Idle animation** — subtle noise drift and character flickering when particles are at rest
- **Staggered return** — particles start returning at different times based on distance
- **Per-particle flow speed variance** — each particle moves at a slightly different speed for organic feel
- **Cluster-aware flow** — 2-phase return: particles group at cluster centroids first, then disperse to exact homes
- **Trail-based mouse interaction** — velocity-baked trail with bloom-in/fade-out lifecycle
- **Boid flocking** — velocity alignment and personal space repulsion between particles

### Scene Sources

```js
import { textToParticles, textToBlockParticles, gridToParticles, imageToAsciiScene, SceneBuilder } from '@yash-chitambar/ascii-diffusion';

// Single-line text
const p1 = textToParticles('Hello');

// Block letter text (5x5 pixel font)
const p2 = textToBlockParticles('HI');

// Custom ASCII grid
const p3 = gridToParticles(['##  ##', '######', '##  ##']);

// Image (browser only)
const scene = imageToAsciiScene(imgElement, 80, 40);

// Compose multiple sources
const scene = new SceneBuilder(80, 24)
  .addText('Title', { offsetX: 5, offsetY: 1 })
  .addGrid(customArt, { offsetX: 0, offsetY: 5 })
  .setConfig({ flowSpeedVariance: 0.5, clusterPhases: true })
  .build();
```

### Scene Transitions

```js
import { transitionScenes, dissolveTransition } from '@yash-chitambar/ascii-diffusion';

// Instant swap
const next = transitionScenes(sceneA, sceneB, 'instant');

// Morph: reuse particle positions, assign new targets
const morphed = transitionScenes(sceneA, sceneB, 'morph');

// Dissolve: cross-fade at a given progress (0–1)
const mid = dissolveTransition(sceneA, sceneB, 0.5);
```

### Lifecycle Animations

```js
import { triggerShow, triggerHide, allParticlesHome } from '@yash-chitambar/ascii-diffusion';

// Intro: scatter particles across canvas, let flow matching bring them home
triggerShow(scene.particles, scene);

// Outro: explode particles outward
triggerHide(scene.particles, scene);

// Check if animation complete
if (allParticlesHome(scene.particles)) { /* done */ }
```

### Presets

```js
import { PRESETS } from '@yash-chitambar/ascii-diffusion';

// Available: gentle, responsive, aggressive, jelly, snappy, flow, cinema, shimmer, depth, magnetic, flock
const config = { ...DEFAULT_DIFFUSION_CONFIG, ...PRESETS.cinema };
```

| Preset | Description |
|--------|-------------|
| `gentle` | Soft scatter, slow return |
| `responsive` | Balanced defaults |
| `aggressive` | Wide scatter, fast return |
| `snappy` | Tight radius, stiff spring |
| `flow` | Flow matching with reset-on-scatter |
| `cinema` | Staggered return, char morph, speed variance |
| `shimmer` | Idle drift and character flickering |
| `depth` | Z-depth displacement with char densification |
| `magnetic` | Cursor attracts particles |
| `flock` | Boid alignment + personal space + cubic homing |

### React Hooks

```tsx
import { useAnimationLoop, useParticlePhysics, useMouseTracking, useSceneTransition } from '@yash-chitambar/ascii-diffusion';
```

- `useAnimationLoop(callback, options)` — RAF loop with delta time
- `useMouseTracking(charW, charH)` — mouse/touch position in grid coordinates (ref-based, no re-renders)
- `useParticlePhysics({ scene, mousePosRef })` — physics state management
- `useSceneTransition({ scenes, interval })` — automatic scene cycling with transitions

### React Components

- `<AsciiDiffusionRenderer>` — full-featured renderer with scene, physics, mouse tracking, color modes
- `<AsciiTextEffect>` — simplified text-only component
- `<AsciiDiffusionFramer>` — Framer wrapper with flat property panel

## How Flow Matching Works

Traditional spring physics (`F = -kx`) oscillates around the target. Flow matching defines a time-dependent velocity field:

```
v(x, t) = (home - x) / (1 - t + epsilon)
```

At `t=0` particles are scattered; at `t=1` they arrive exactly at home. The velocity naturally decreases as particles approach, giving smooth deceleration without damping hacks.

Mouse interaction resets `t` to restart the return journey from the new position.

## Demo

Open `demo/index.html` in any browser. Upload an image to see flow matching in action. Click and drag to scatter particles. No build step required.

## Development

```bash
npm install
npm run build    # TypeScript compile
npm run dev      # Watch mode
npm test         # Run 132 engine tests
```

## License

MIT
