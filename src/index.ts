// ── Types ──
export type {
  AsciiParticle,
  AsciiScene,
  DiffusionConfig,
  ExtendedDiffusionConfig,
  PhysicsMode,
  PhysicsApplicator,
  RenderConfig,
  ColorMode,
  ColorCell,
  TransitionMode,
} from './core/types.js';

export { DEFAULT_DIFFUSION_CONFIG, DEFAULT_RENDER_CONFIG } from './core/types.js';

// ── Core ──
export { getPhysicsApplicator } from './core/physics.js';
export { renderToString, renderToColorGrid } from './core/renderer.js';
export { AnimationLoop } from './core/animation-loop.js';
export type { AnimationCallback } from './core/animation-loop.js';

// ── Physics modes ──
export { flowMatchingPhysics } from './physics-modes/flow-matching.js';
export { diffusionPhysics } from './physics-modes/diffusion.js';
export { gravityPhysics } from './physics-modes/gravity.js';
export { vortexPhysics } from './physics-modes/vortex.js';
export { explosionPhysics, triggerExplosion } from './physics-modes/explosion.js';
export { wavePhysics } from './physics-modes/wave.js';

// ── Scene ──
export { textToParticles, textToBlockParticles } from './scene/text-to-particles.js';
export { gridToParticles, charToBrightness, brightnessToCh } from './scene/grid-to-particles.js';
export { imageToAsciiScene } from './scene/image-to-particles.js';
export type { ImageToParticlesOptions } from './scene/image-to-particles.js';
export { SceneBuilder } from './scene/scene-builder.js';
export { transitionScenes, dissolveTransition } from './scene/transitions.js';

// ── Presets ──
export { PRESETS } from './presets/index.js';
export type { PresetName } from './presets/index.js';
