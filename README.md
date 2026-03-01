# ASCII Diffusion

Interactive ASCII art engine powered by **flow matching** particle physics. Characters scatter on mouse interaction and return home via a smooth velocity field — no spring overshoot, no oscillation.

## Demo

Open `demo/index.html` in any browser. Upload an image, watch particles scatter then assemble into ASCII art. Click and drag to scatter particles.

No build step required — the demo is a single self-contained HTML file.

## How It Works

Every visible character is a **particle** with a home position and current position. The engine runs a physics loop each frame:

1. **Mouse repulsion** — click to push particles away from cursor
2. **Flow matching** — smooth velocity field guides particles home (`v = (home - x) / (1 - t)`)
3. **Damping** — velocity decays to prevent excess momentum
4. **Integration** — positions update from velocities

Flow matching (Lipman et al., 2022) replaces traditional spring physics. Instead of oscillating around the target, particles follow a time-dependent path that arrives smoothly and stops exactly at home.

## Package Structure

```
src/
├── core/           # Types, physics dispatcher, renderer, animation loop
├── physics-modes/  # Flow matching, diffusion, gravity, vortex, explosion, wave
├── scene/          # Text, grid, and image → particle converters + transitions
├── presets/        # Named config presets (gentle, snappy, aggressive, etc.)
└── index.ts        # Package exports

demo/
└── index.html      # Self-contained browser demo
```

## Development

```bash
npm install
npm run build
npm run dev
```

TypeScript, React 18/19 peer dep, zero runtime dependencies.

## Status

Core engine and all physics modes are implemented. Remaining work:
- React components (`AsciiDiffusionRenderer`, `AsciiTextEffect`, Framer wrapper)
- React hooks (`useAnimationLoop`, `useParticlePhysics`, `useMouseTracking`, `useSceneTransition`)
- Package publishing setup

See `TODO.md` for the full checklist.
