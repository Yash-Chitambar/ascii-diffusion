import type { PhysicsApplicator, PhysicsMode } from './types.js';
import { flowMatchingPhysics } from '../physics-modes/flow-matching.js';
import { diffusionPhysics } from '../physics-modes/diffusion.js';
import { gravityPhysics } from '../physics-modes/gravity.js';
import { vortexPhysics } from '../physics-modes/vortex.js';
import { explosionPhysics } from '../physics-modes/explosion.js';
import { wavePhysics } from '../physics-modes/wave.js';

const applicators: Record<PhysicsMode, PhysicsApplicator> = {
  'flow-matching': flowMatchingPhysics,
  diffusion: diffusionPhysics,
  gravity: gravityPhysics,
  vortex: vortexPhysics,
  explosion: explosionPhysics,
  wave: wavePhysics,
};

export function getPhysicsApplicator(mode: PhysicsMode): PhysicsApplicator {
  return applicators[mode];
}
