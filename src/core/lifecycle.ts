import type { AsciiParticle, AsciiScene } from './types.js';

/**
 * Intro animation: scatter all particles across the full canvas,
 * then let flow matching bring them home.
 *
 * Inspired by brunoimbrizi's show() — particles start deeply scattered
 * in space and converge to the image plane over ~1.5 seconds.
 */
export function triggerShow(particles: AsciiParticle[], scene: AsciiScene): void {
  for (const p of particles) {
    // Full-canvas scatter (not radius-limited)
    p.currentX = Math.random() * scene.width;
    p.currentY = Math.random() * scene.height;
    p.vx = (Math.random() - 0.5) * 2;
    p.vy = (Math.random() - 0.5) * 2;

    if (p.z !== undefined) p.z = (Math.random() - 0.5) * 4;

    // Stagger: t ranges from −1.0 to −1.5 based on distance from canvas center
    const dx = p.homeX - scene.width / 2;
    const dy = p.homeY - scene.height / 2;
    const norm = Math.sqrt(dx * dx + dy * dy) / (scene.width * 0.5);
    p.t = -1.0 - norm * 0.5;
  }
}

/**
 * Outro animation: scatter particles outward from the center.
 *
 * Inspired by brunoimbrizi's hide() — particles explode outward
 * and the scene is removed after ~800ms.
 */
export function triggerHide(particles: AsciiParticle[], scene: AsciiScene): void {
  for (const p of particles) {
    const dx = p.currentX - scene.width / 2;
    const dy = p.currentY - scene.height / 2;
    const d = Math.max(Math.sqrt(dx * dx + dy * dy), 0.1);

    p.vx = (dx / d) * 8 + (Math.random() - 0.5) * 4;
    p.vy = (dy / d) * 8 - Math.random() * 4;
    p.t = 2; // Set t > 1 to disable flow matching return

    if (p.vz !== undefined) p.vz = (Math.random() - 0.5) * 3;
  }
}

/**
 * Check if all particles have arrived home (t >= 1).
 * Useful for onShowComplete callback.
 */
export function allParticlesHome(particles: AsciiParticle[]): boolean {
  for (const p of particles) {
    if (p.t < 1) return false;
  }
  return true;
}
