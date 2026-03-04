/**
 * Age-based trail array for mouse interaction.
 *
 * Inspired by brunoimbrizi's TouchTexture.js — each trail point has a
 * velocity-baked force and an age lifecycle with bloom-in/fade-out.
 * Fast swipes leave bright persistent trails; slow hovers produce near-zero force.
 */

interface TrailPoint {
  x: number;
  y: number;
  age: number;
  force: number;
  maxAge: number;
}

function easeOutSine(t: number): number {
  return Math.sin(t * Math.PI / 2);
}

export class TrailMap {
  private trail: TrailPoint[] = [];
  private lastX = 0;
  private lastY = 0;
  private initialized = false;

  /**
   * Add a new trail point at (x, y).
   * Force is baked from squared distance to last point (velocity proxy).
   */
  addPoint(x: number, y: number, maxAge = 120, forceScale = 100): void {
    if (!this.initialized) {
      this.lastX = x;
      this.lastY = y;
      this.initialized = true;
      return;
    }

    const dx = x - this.lastX;
    const dy = y - this.lastY;
    const force = Math.min((dx * dx + dy * dy) * forceScale, 1.0);

    this.trail.push({ x, y, age: 0, force, maxAge });
    this.lastX = x;
    this.lastY = y;
  }

  /** Advance age of all points, remove expired ones. Call once per frame. */
  update(): void {
    let write = 0;
    for (let i = 0; i < this.trail.length; i++) {
      this.trail[i].age++;
      if (this.trail[i].age <= this.trail[i].maxAge) {
        this.trail[write++] = this.trail[i];
      }
    }
    this.trail.length = write;
  }

  /**
   * Sample influence strength at grid coords (x, y).
   * Returns 0–1 influence value considering bloom/fade lifecycle.
   */
  sample(x: number, y: number, radius: number): { strength: number; dx: number; dy: number } {
    let total = 0;
    let totalDx = 0;
    let totalDy = 0;
    const r2 = radius * radius;

    for (const pt of this.trail) {
      const dx = x - pt.x;
      const dy = y - pt.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > r2) continue;

      const lifeFrac = pt.age / pt.maxAge;
      // Bloom in (first 30%), fade out (last 70%) — matches TouchTexture.js
      const intensity = lifeFrac < 0.3
        ? easeOutSine(lifeFrac / 0.3)
        : easeOutSine(1 - (lifeFrac - 0.3) / 0.7);

      const dist = Math.sqrt(d2);
      const falloff = 1 - dist / radius;
      const weight = intensity * pt.force * falloff;
      total += weight;

      // Direction: from trail point toward sample point (push away)
      if (dist > 0.01) {
        totalDx += (dx / dist) * weight;
        totalDy += (dy / dist) * weight;
      }
    }

    return {
      strength: Math.min(total, 1.0),
      dx: totalDx,
      dy: totalDy,
    };
  }

  /** Clear all trail points. */
  clear(): void {
    this.trail.length = 0;
    this.initialized = false;
  }

  get length(): number {
    return this.trail.length;
  }
}
