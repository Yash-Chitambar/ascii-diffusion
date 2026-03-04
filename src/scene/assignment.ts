import type { AsciiParticle } from '../core/types.js';

export interface HomeSlot {
  x: number;
  y: number;
  char: string;
  brightness: number;
}

/**
 * Greedy nearest-neighbor particle-to-home reassignment.
 *
 * When particles are scattered, run this to prevent crossing paths during return.
 * Each particle claims the closest unclaimed home. O(n²) but only runs
 * once per scatter event, not per frame.
 *
 * Inspired by obamify's assignment modes (D1 in the plan).
 */
export function reassignParticlesToHomes(
  particles: AsciiParticle[],
  homes: HomeSlot[],
): void {
  if (particles.length === 0 || homes.length === 0) return;

  const n = Math.min(particles.length, homes.length);
  const claimed = new Set<number>();

  // Sort particles by distance to nearest home (closest first = first pick)
  const indexed = particles.slice(0, n).map((p, i) => {
    let minDist = Infinity;
    for (let h = 0; h < homes.length; h++) {
      const dx = p.currentX - homes[h].x;
      const dy = p.currentY - homes[h].y;
      minDist = Math.min(minDist, dx * dx + dy * dy);
    }
    return { idx: i, minDist };
  });
  indexed.sort((a, b) => a.minDist - b.minDist);

  // Greedy assignment
  for (const entry of indexed) {
    const p = particles[entry.idx];
    let best = -1;
    let bestDist = Infinity;

    for (let h = 0; h < homes.length; h++) {
      if (claimed.has(h)) continue;
      const dx = p.currentX - homes[h].x;
      const dy = p.currentY - homes[h].y;
      const d = dx * dx + dy * dy;
      if (d < bestDist) {
        bestDist = d;
        best = h;
      }
    }

    if (best >= 0) {
      claimed.add(best);
      p.homeX = homes[best].x;
      p.homeY = homes[best].y;
      p.char = homes[best].char;
      p.brightness = homes[best].brightness;
    }
  }
}

function dist2(p: AsciiParticle, h: HomeSlot): number {
  const dx = p.currentX - h.x;
  const dy = p.currentY - h.y;
  return dx * dx + dy * dy;
}

/**
 * Genetic reassignment: iterative hill-climbing with decaying search radius.
 *
 * Adapted from obamify's process_genetic(). Better than greedy NN because
 * it starts with global search and refines locally.
 */
export function geneticReassign(
  particles: AsciiParticle[],
  homes: HomeSlot[],
  iterations = 3,
): void {
  const n = Math.min(particles.length, homes.length);
  if (n === 0) return;

  // Initial: greedy NN to start from a reasonable assignment
  reassignParticlesToHomes(particles, homes);

  // Build index: particle i is currently assigned to home i (after greedy)
  // We need to track which home each particle has
  const assignment: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    // Find which home this particle got (match by coordinates)
    for (let h = 0; h < homes.length; h++) {
      if (particles[i].homeX === homes[h].x && particles[i].homeY === homes[h].y) {
        assignment[i] = h;
        break;
      }
    }
  }

  let searchRadius = Math.max(Math.sqrt(n), 4);

  for (let iter = 0; iter < iterations; iter++) {
    let swaps = 0;
    for (let a = 0; a < n; a++) {
      // Pick a random other particle to try swapping with
      const bIdx = Math.floor(Math.random() * n);
      if (bIdx === a) continue;

      const ha = assignment[a];
      const hb = assignment[bIdx];

      // Check if swap would be within search radius
      const d = Math.sqrt(dist2(particles[a], homes[hb]));
      if (d > searchRadius) continue;

      const costBefore = dist2(particles[a], homes[ha]) + dist2(particles[bIdx], homes[hb]);
      const costAfter = dist2(particles[a], homes[hb]) + dist2(particles[bIdx], homes[ha]);

      if (costAfter < costBefore) {
        assignment[a] = hb;
        assignment[bIdx] = ha;
        swaps++;
      }
    }

    searchRadius *= 0.8;
    if (searchRadius < 2 && swaps < 5) break;
  }

  // Apply final assignment
  for (let i = 0; i < n; i++) {
    const h = homes[assignment[i]];
    particles[i].homeX = h.x;
    particles[i].homeY = h.y;
    particles[i].char = h.char;
    particles[i].brightness = h.brightness;
  }
}
