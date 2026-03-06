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
export { renderToString, renderToColorGrid, colorGridToHtml, escapeHtml } from './core/renderer.js';
export { AnimationLoop } from './core/animation-loop.js';
export type { AnimationCallback } from './core/animation-loop.js';
export { TrailMap } from './core/trail-map.js';
export { SpatialHash } from './core/spatial-hash.js';
export { triggerShow, triggerHide, allParticlesHome } from './core/lifecycle.js';

// ── Physics modes ──
export { flowMatchingPhysics, resetTrailMap, applyFlowReturn } from './physics-modes/flow-matching.js';
export { diffusionPhysics } from './physics-modes/diffusion.js';
export { gravityPhysics } from './physics-modes/gravity.js';
export { vortexPhysics } from './physics-modes/vortex.js';
export { explosionPhysics, triggerExplosion } from './physics-modes/explosion.js';
export { wavePhysics } from './physics-modes/wave.js';
export { magneticPhysics } from './physics-modes/magnetic.js';

// ── Scene ──
export { textToParticles, textToBlockParticles } from './scene/text-to-particles.js';
export { gridToParticles, charToBrightness, brightnessToCh, BRIGHTNESS_RAMP } from './scene/grid-to-particles.js';
export { imageToAsciiScene } from './scene/image-to-particles.js';
export type { ImageToParticlesOptions } from './scene/image-to-particles.js';
export { SceneBuilder } from './scene/scene-builder.js';
export { transitionScenes, dissolveTransition } from './scene/transitions.js';
export { reassignParticlesToHomes, geneticReassign, assignClusterCentroids } from './scene/assignment.js';
export type { HomeSlot } from './scene/assignment.js';

// ── Hooks ──
export { useAnimationLoop } from './hooks/useAnimationLoop.js';
export type { UseAnimationLoopOptions } from './hooks/useAnimationLoop.js';
export { useMouseTracking } from './hooks/useMouseTracking.js';
export type { GridMousePos, UseMouseTrackingOptions } from './hooks/useMouseTracking.js';
export { useParticlePhysics } from './hooks/useParticlePhysics.js';
export type { UseParticlePhysicsOptions, ParticlePhysicsState } from './hooks/useParticlePhysics.js';
export { useSceneTransition } from './hooks/useSceneTransition.js';
export type { UseSceneTransitionOptions } from './hooks/useSceneTransition.js';

// ── Components ──
export { AsciiDiffusionRenderer } from './components/AsciiDiffusionRenderer.js';
export type { AsciiDiffusionRendererProps, AsciiDiffusionRendererRef } from './components/AsciiDiffusionRenderer.js';
export { AsciiTextEffect } from './components/AsciiTextEffect.js';
export type { AsciiTextEffectProps } from './components/AsciiTextEffect.js';
export { AsciiDiffusionFramer } from './components/AsciiDiffusionFramer.js';
export type { AsciiDiffusionFramerProps } from './components/AsciiDiffusionFramer.js';

// ── Presets ──
export { PRESETS } from './presets/index.js';
export type { PresetName } from './presets/index.js';
