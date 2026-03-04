import type { AsciiParticle } from './types.js';

/**
 * Spatial hash grid for O(1) average neighbor lookups.
 * Used by flocking (Phase I2) and personal space (Phase I3).
 */
export class SpatialHash {
  private cellSize: number;
  private grid = new Map<string, AsciiParticle[]>();

  constructor(cellSize: number) {
    this.cellSize = Math.max(cellSize, 0.5);
  }

  private key(cx: number, cy: number): string {
    return `${cx},${cy}`;
  }

  insert(p: AsciiParticle): void {
    const cx = Math.floor(p.currentX / this.cellSize);
    const cy = Math.floor(p.currentY / this.cellSize);
    const k = this.key(cx, cy);
    const bucket = this.grid.get(k);
    if (bucket) {
      bucket.push(p);
    } else {
      this.grid.set(k, [p]);
    }
  }

  /** Query all particles within radius of (x, y). */
  query(x: number, y: number, radius: number): AsciiParticle[] {
    const result: AsciiParticle[] = [];
    const r2 = radius * radius;
    const minCx = Math.floor((x - radius) / this.cellSize);
    const maxCx = Math.floor((x + radius) / this.cellSize);
    const minCy = Math.floor((y - radius) / this.cellSize);
    const maxCy = Math.floor((y + radius) / this.cellSize);

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const bucket = this.grid.get(this.key(cx, cy));
        if (!bucket) continue;
        for (const p of bucket) {
          const dx = p.currentX - x;
          const dy = p.currentY - y;
          if (dx * dx + dy * dy <= r2) {
            result.push(p);
          }
        }
      }
    }

    return result;
  }
}
