import type { AsciiParticle, ExtendedDiffusionConfig, PhysicsApplicator } from '../core/types.js';

export function triggerExplosion(
  particles: AsciiParticle[],
  center: { x: number; y: number },
  force: number,
  radius: number,
): void {
  for (const p of particles) {
    const dx = p.currentX - center.x;
    const dy = p.currentY - center.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < radius && dist > 0.01) {
      const strength = force * (1 - dist / radius);
      p.vx += (dx / dist) * strength;
      p.vy += (dy / dist) * strength;
    }
  }
}

export const explosionPhysics: PhysicsApplicator = {
  apply(
    particles: AsciiParticle[],
    _mousePos: { x: number; y: number } | null,
    config: ExtendedDiffusionConfig,
    dt: number,
  ): void {
    const dtScale = dt / 33;

    for (const p of particles) {
      // Spring return (reassembly)
      p.vx += config.springK * (p.homeX - p.currentX) * dtScale;
      p.vy += config.springK * (p.homeY - p.currentY) * dtScale;

      // Damping
      p.vx *= config.damping;
      p.vy *= config.damping;

      // Integration
      p.currentX += p.vx * dtScale;
      p.currentY += p.vy * dtScale;
    }
  },
};
