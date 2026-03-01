import type { AsciiParticle, ExtendedDiffusionConfig, PhysicsApplicator } from '../core/types.js';

let waveTime = 0;

export const wavePhysics: PhysicsApplicator = {
  apply(
    particles: AsciiParticle[],
    mousePos: { x: number; y: number } | null,
    config: ExtendedDiffusionConfig,
    dt: number,
  ): void {
    const dtScale = dt / 33;
    const waveAmplitude = config.waveAmplitude ?? 2.0;
    const waveFrequency = config.waveFrequency ?? 0.3;
    const waveDecay = config.waveDecay ?? 0.1;

    waveTime += dt;

    for (const p of particles) {
      if (mousePos) {
        const dx = p.homeX - mousePos.x;
        const dy = p.homeY - mousePos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Sinusoidal displacement based on distance from mouse
        const phase = dist * waveFrequency - waveTime * 0.005;
        const displacement = waveAmplitude * Math.sin(phase) * Math.exp(-dist * waveDecay);

        // Apply wave displacement to vertical position
        p.currentY = p.homeY + displacement;
        p.currentX = p.homeX;
      } else {
        // Spring return when no mouse
        p.vx += config.springK * (p.homeX - p.currentX) * dtScale;
        p.vy += config.springK * (p.homeY - p.currentY) * dtScale;

        p.vx *= config.damping;
        p.vy *= config.damping;

        p.currentX += p.vx * dtScale;
        p.currentY += p.vy * dtScale;
      }
    }
  },
};
