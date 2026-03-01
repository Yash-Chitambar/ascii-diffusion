import type { AsciiParticle, AsciiScene, TransitionMode } from '../core/types.js';

/**
 * Transition between two scenes.
 *
 * - morph: reuse old particles, update home positions to new scene targets
 * - dissolve: (requires external progress tracking, returns blended scene)
 * - instant: swap particles immediately
 */
export function transitionScenes(
  from: AsciiScene,
  to: AsciiScene,
  mode: TransitionMode,
): AsciiScene {
  switch (mode) {
    case 'instant':
      return { ...to, particles: to.particles.map((p) => ({ ...p })) };

    case 'morph':
      return morphTransition(from, to);

    case 'dissolve':
      return dissolveTransition(from, to, 0);
  }
}

function morphTransition(from: AsciiScene, to: AsciiScene): AsciiScene {
  const oldParticles = from.particles;
  const newTargets = to.particles;
  const result: AsciiParticle[] = [];

  // Reuse existing particles, update their home positions
  const reuseCount = Math.min(oldParticles.length, newTargets.length);

  for (let i = 0; i < reuseCount; i++) {
    result.push({
      ...oldParticles[i],
      homeX: newTargets[i].homeX,
      homeY: newTargets[i].homeY,
      char: newTargets[i].char,
      brightness: newTargets[i].brightness,
      color: newTargets[i].color,
      t: 0, // Reset flow time for return journey
    });
  }

  // New scene has more particles — spawn extras from center
  if (newTargets.length > oldParticles.length) {
    const centerX = to.width / 2;
    const centerY = to.height / 2;
    for (let i = reuseCount; i < newTargets.length; i++) {
      result.push({
        ...newTargets[i],
        currentX: centerX + (Math.random() - 0.5) * 4,
        currentY: centerY + (Math.random() - 0.5) * 4,
        vx: 0,
        vy: 0,
        t: 0,
      });
    }
  }

  return {
    particles: result,
    width: to.width,
    height: to.height,
    config: to.config,
  };
}

/**
 * Dissolve transition: blend brightness between scenes based on progress [0, 1].
 */
export function dissolveTransition(
  from: AsciiScene,
  to: AsciiScene,
  progress: number,
): AsciiScene {
  const clampedProgress = Math.max(0, Math.min(1, progress));
  const result: AsciiParticle[] = [];

  // Fade out old particles
  for (const p of from.particles) {
    result.push({
      ...p,
      brightness: p.brightness * (1 - clampedProgress),
    });
  }

  // Fade in new particles
  for (const p of to.particles) {
    result.push({
      ...p,
      brightness: p.brightness * clampedProgress,
    });
  }

  return {
    particles: result,
    width: to.width,
    height: to.height,
    config: to.config,
  };
}
