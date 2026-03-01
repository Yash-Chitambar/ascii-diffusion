import type { AsciiParticle, ExtendedDiffusionConfig, PhysicsApplicator } from '../core/types.js';

export const gravityPhysics: PhysicsApplicator = {
  apply(
    particles: AsciiParticle[],
    mousePos: { x: number; y: number } | null,
    config: ExtendedDiffusionConfig,
    dt: number,
  ): void {
    const dtScale = dt / 33;

    for (const p of particles) {
      // 1. Mouse attraction (reversed repulsion)
      if (mousePos) {
        const dx = mousePos.x - p.currentX;
        const dy = mousePos.y - p.currentY;
        const distSq = dx * dx + dy * dy;
        const softening = 1;

        if (distSq < config.scatterRadius * config.scatterRadius) {
          const dist = Math.sqrt(distSq);
          const force = config.scatterForce / (distSq + softening);
          p.vx += (dx / dist) * force * dtScale;
          p.vy += (dy / dist) * force * dtScale;
        }
      }

      // 2. Spring return
      p.vx += config.springK * (p.homeX - p.currentX) * dtScale;
      p.vy += config.springK * (p.homeY - p.currentY) * dtScale;

      // 3. Damping
      p.vx *= config.damping;
      p.vy *= config.damping;

      // 4. Integration
      p.currentX += p.vx * dtScale;
      p.currentY += p.vy * dtScale;
    }
  },
};
