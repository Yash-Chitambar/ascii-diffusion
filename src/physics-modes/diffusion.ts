import type { AsciiParticle, ExtendedDiffusionConfig, PhysicsApplicator } from '../core/types.js';

export const diffusionPhysics: PhysicsApplicator = {
  apply(
    particles: AsciiParticle[],
    mousePos: { x: number; y: number } | null,
    config: ExtendedDiffusionConfig,
    dt: number,
  ): void {
    const dtScale = dt / 33;

    for (const p of particles) {
      // 1. Mouse repulsion
      if (mousePos) {
        const dx = p.currentX - mousePos.x;
        const dy = p.currentY - mousePos.y;
        const distSq = dx * dx + dy * dy;

        if (distSq < config.scatterRadius * config.scatterRadius && distSq > 0.01) {
          const dist = Math.sqrt(distSq);
          const force = config.scatterForce / distSq;
          p.vx += (dx / dist) * force * dtScale;
          p.vy += (dy / dist) * force * dtScale;
        }
      }

      // 2. Spring return: F = springK * (home - current)
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
