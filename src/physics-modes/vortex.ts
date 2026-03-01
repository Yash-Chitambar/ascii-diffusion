import type { AsciiParticle, ExtendedDiffusionConfig, PhysicsApplicator } from '../core/types.js';

export const vortexPhysics: PhysicsApplicator = {
  apply(
    particles: AsciiParticle[],
    mousePos: { x: number; y: number } | null,
    config: ExtendedDiffusionConfig,
    dt: number,
  ): void {
    const dtScale = dt / 33;
    const vortexStrength = config.vortexStrength ?? 0.5;
    const vortexRadius = config.vortexRadius ?? config.scatterRadius;

    for (const p of particles) {
      // 1. Vortex orbital force
      if (mousePos) {
        const dx = p.currentX - mousePos.x;
        const dy = p.currentY - mousePos.y;
        const distSq = dx * dx + dy * dy;

        if (distSq < vortexRadius * vortexRadius && distSq > 0.01) {
          const dist = Math.sqrt(distSq);

          // Tangential (perpendicular) force for orbital motion
          const angle = Math.atan2(dy, dx);
          const tangentX = Math.cos(angle + Math.PI / 2);
          const tangentY = Math.sin(angle + Math.PI / 2);
          const orbitalForce = vortexStrength / dist;

          p.vx += tangentX * orbitalForce * dtScale;
          p.vy += tangentY * orbitalForce * dtScale;

          // Slight radial attraction
          const radialForce = config.scatterForce * 0.1 / distSq;
          p.vx -= (dx / dist) * radialForce * dtScale;
          p.vy -= (dy / dist) * radialForce * dtScale;
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
