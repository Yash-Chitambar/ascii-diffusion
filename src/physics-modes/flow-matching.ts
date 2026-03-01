import type { AsciiParticle, ExtendedDiffusionConfig, PhysicsApplicator } from '../core/types.js';

/**
 * Flow matching physics mode.
 *
 * Instead of spring forces (which oscillate), this uses a time-dependent
 * velocity field that smoothly interpolates each particle from its current
 * position to home. The path follows:
 *
 *   x(t) = (1 - t) * x_scattered + t * x_home
 *
 * Each frame we advance t and lerp the position, blending with any
 * momentum from mouse repulsion. The result is smooth deceleration
 * with no overshoot.
 */
export const flowMatchingPhysics: PhysicsApplicator = {
  apply(
    particles: AsciiParticle[],
    mousePos: { x: number; y: number } | null,
    config: ExtendedDiffusionConfig,
    dt: number,
  ): void {
    const dtScale = dt / 33;
    const flowSpeed = config.flowSpeed ?? 0.04;
    const resetOnScatter = config.resetOnScatter ?? true;

    for (const p of particles) {
      // 1. Mouse repulsion (adds momentum)
      if (mousePos) {
        const dx = p.currentX - mousePos.x;
        const dy = p.currentY - mousePos.y;
        const distSq = dx * dx + dy * dy;

        if (distSq < config.scatterRadius * config.scatterRadius && distSq > 0.01) {
          const dist = Math.sqrt(distSq);
          const force = config.scatterForce / distSq;
          p.vx += (dx / dist) * force * dtScale;
          p.vy += (dy / dist) * force * dtScale;

          if (resetOnScatter) {
            p.t = 0;
          }
        }
      }

      // 2. Damping on momentum (mouse scatter momentum decays)
      p.vx *= config.damping;
      p.vy *= config.damping;

      // 3. Integrate momentum from mouse interaction
      p.currentX += p.vx * dtScale;
      p.currentY += p.vy * dtScale;

      // 4. Flow matching: smooth lerp toward home
      if (p.t < 1) {
        // Advance flow time
        const prevT = p.t;
        p.t = Math.min(p.t + flowSpeed * dtScale, 1);

        // Exponential ease-out: move a fraction of remaining distance.
        // As t advances, we close more of the gap each frame.
        // alpha = 1 - (1 - t)/(1 - prevT) is the fraction of remaining
        // distance to cover this step.
        const remaining = 1 - prevT;
        const alpha = remaining > 0.001 ? 1 - (1 - p.t) / remaining : 1;

        const homeDx = p.homeX - p.currentX;
        const homeDy = p.homeY - p.currentY;

        p.currentX += homeDx * alpha;
        p.currentY += homeDy * alpha;

        // Check if close enough to snap
        const newDx = p.homeX - p.currentX;
        const newDy = p.homeY - p.currentY;
        if (newDx * newDx + newDy * newDy < 0.01) {
          p.currentX = p.homeX;
          p.currentY = p.homeY;
          p.vx = 0;
          p.vy = 0;
          p.t = 1;
        }
      }
    }
  },
};
