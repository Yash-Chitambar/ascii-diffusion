import type { AsciiParticle, ExtendedDiffusionConfig, PhysicsApplicator } from '../core/types.js';
import { applyFlowReturn } from './flow-matching.js';

/**
 * Magnetic physics mode.
 *
 * The cursor acts as a magnet: particles are pulled TOWARD it while in range.
 * When the cursor leaves, particles use flow matching (not spring) to return home.
 */
export const magneticPhysics: PhysicsApplicator = {
  apply(
    particles: AsciiParticle[],
    mousePos: { x: number; y: number } | null,
    config: ExtendedDiffusionConfig,
    dt: number,
  ): void {
    const dtScale = dt / 33;
    const flowSpeed = config.flowSpeed ?? 0.04;

    for (const p of particles) {
      // 1. Mouse attraction (TOWARD mouse, unlike diffusion which pushes away)
      if (mousePos) {
        const dx = mousePos.x - p.currentX;
        const dy = mousePos.y - p.currentY;
        const distSq = dx * dx + dy * dy;

        if (distSq < config.scatterRadius * config.scatterRadius && distSq > 0.01) {
          const dist = Math.sqrt(distSq);
          const force = config.scatterForce / (distSq + 0.5);
          p.vx += (dx / dist) * force * dtScale;
          p.vy += (dy / dist) * force * dtScale;
          p.t = 0;
        }
      }

      // 2. Damping
      p.vx *= config.damping;
      p.vy *= config.damping;

      // 3. Integrate momentum
      p.currentX += p.vx * dtScale;
      p.currentY += p.vy * dtScale;

      // 4. Flow matching return (shared helper)
      applyFlowReturn(p, flowSpeed, dtScale);
    }
  },
};
