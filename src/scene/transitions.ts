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
  const toHomes = to.particles.map((p) => ({
    x: p.homeX,
    y: p.homeY,
    char: p.char,
    brightness: p.brightness,
    color: p.color,
    angle: p.angle,
  }));
  const result: AsciiParticle[] = [];

  // Greedy nearest assignment: each old particle claims the new home closest
  // to its CURRENT position (not home position — it may be scattered)
  const reuseCount = Math.min(oldParticles.length, toHomes.length);
  const claimed = new Set<number>();

  for (let i = 0; i < reuseCount; i++) {
    const fp = oldParticles[i];
    let best = -1;
    let bestDist = Infinity;

    for (let h = 0; h < toHomes.length; h++) {
      if (claimed.has(h)) continue;
      const dx = fp.currentX - toHomes[h].x;
      const dy = fp.currentY - toHomes[h].y;
      const d = dx * dx + dy * dy;
      if (d < bestDist) {
        bestDist = d;
        best = h;
      }
    }

    if (best >= 0) {
      claimed.add(best);
      result.push({
        ...fp,
        homeX: toHomes[best].x,
        homeY: toHomes[best].y,
        char: toHomes[best].char,
        brightness: toHomes[best].brightness,
        color: toHomes[best].color,
        angle: toHomes[best].angle,
        t: 0, // Reset flow time for return journey
      });
    }
  }

  // New scene has more particles — spawn extras from center
  if (toHomes.length > oldParticles.length) {
    const centerX = to.width / 2;
    const centerY = to.height / 2;
    for (let h = 0; h < toHomes.length; h++) {
      if (claimed.has(h)) continue;
      const target = to.particles[h];
      result.push({
        ...target,
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
