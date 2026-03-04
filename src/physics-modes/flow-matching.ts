import type { AsciiParticle, ExtendedDiffusionConfig, PhysicsApplicator } from '../core/types.js';
import { TrailMap } from '../core/trail-map.js';
import { SpatialHash } from '../core/spatial-hash.js';

/**
 * Apply standard flow matching return (advance t, lerp toward home, snap when close).
 * Shared between flow-matching and magnetic physics modes.
 */
export function applyFlowReturn(p: AsciiParticle, flowSpeed: number, dtScale: number): void {
  if (p.t >= 1) return;

  const prevT = p.t;
  p.t = Math.min(p.t + flowSpeed * dtScale, 1);

  const remaining = 1 - prevT;
  const alpha = remaining > 0.001 ? 1 - (1 - p.t) / remaining : 1;

  p.currentX += (p.homeX - p.currentX) * alpha;
  p.currentY += (p.homeY - p.currentY) * alpha;

  const dx = p.homeX - p.currentX;
  const dy = p.homeY - p.currentY;
  if (dx * dx + dy * dy < 0.01) {
    p.currentX = p.homeX;
    p.currentY = p.homeY;
    p.vx = 0;
    p.vy = 0;
    p.t = 1;
  }
}

/**
 * Flow matching physics mode — the primary physics engine.
 *
 * Instead of spring forces (which oscillate), this uses a time-dependent
 * velocity field that smoothly interpolates each particle from its current
 * position to home.
 *
 * Features (all opt-in via config):
 * - TrailMap-based mouse interaction with bloom/fade trails
 * - Per-particle angle for directional scatter (half-circle)
 * - Staggered return timing (particles start returning at different times)
 * - Per-particle flow speed variance
 * - Idle noise drift when at home
 * - Cubic homing acceleration curve (obamify-inspired)
 * - Boid velocity alignment / flocking
 * - Personal space repulsion
 * - Z-depth displacement
 */

// Shared trail map instance (persists across frames)
let trailMap: TrailMap | null = null;

// Cheap 2D noise: two offset sin waves (no dependency needed)
function cheapNoise2D(x: number, y: number, t: number): number {
  return Math.sin(x * 0.7 + t * 0.0013)
    * Math.cos(y * 0.5 + t * 0.0017) * 0.5
    + Math.sin(x * 1.3 + y * 0.9 + t * 0.001) * 0.25;
}

export const flowMatchingPhysics: PhysicsApplicator = {
  apply(
    particles: AsciiParticle[],
    mousePos: { x: number; y: number } | null,
    config: ExtendedDiffusionConfig,
    dt: number,
  ): void {
    const dtScale = dt / 33;
    const baseFlowSpeed = config.flowSpeed ?? 0.04;
    const resetOnScatter = config.resetOnScatter ?? true;
    const staggerReturn = config.staggerReturn ?? false;
    const staggerMaxDelay = config.staggerMaxDelay ?? 0.4;
    const angleWeight = config.angleScatterWeight ?? 0.4;
    const useTrailMap = config.trailMaxAge !== undefined && config.trailMaxAge > 0;
    const time = performance.now();

    // Initialize or update trail map
    if (useTrailMap) {
      if (!trailMap) trailMap = new TrailMap();
      if (mousePos) {
        trailMap.addPoint(
          mousePos.x,
          mousePos.y,
          config.trailMaxAge ?? 120,
          config.trailForceScale ?? 100,
        );
      }
      trailMap.update();
    }

    // Build spatial hash for flocking / personal space
    let spatialHash: SpatialHash | null = null;
    if (config.flockAlignment || config.personalSpace) {
      const maxRadius = Math.max(config.flockAlignment ? 2.0 : 0, config.personalSpace ?? 0);
      spatialHash = new SpatialHash(maxRadius);
      for (const p of particles) {
        spatialHash.insert(p);
      }
    }

    for (const p of particles) {
      const particleFlowSpeed = p.flowSpeed ?? baseFlowSpeed;
      let scattered = false;

      // 1. Mouse repulsion
      if (useTrailMap && trailMap) {
        // Trail-based interaction: sample influence from persistent trail
        const influence = trailMap.sample(p.currentX, p.currentY, config.scatterRadius);
        if (influence.strength > 0.01) {
          const radialDx = influence.dx;
          const radialDy = influence.dy;

          // Blend radial push with per-particle angle direction
          const angle = p.angle ?? 0;
          const angleDx = Math.cos(angle);
          const angleDy = Math.sin(angle);

          const pushX = radialDx * (1 - angleWeight) + angleDx * angleWeight;
          const pushY = radialDy * (1 - angleWeight) + angleDy * angleWeight;

          p.vx += pushX * influence.strength * config.scatterForce * dtScale;
          p.vy += pushY * influence.strength * config.scatterForce * dtScale;

          // Z-depth scatter
          if (config.zDepthEnabled) {
            const zStrength = config.zScatterStrength ?? 0.3;
            p.vz = (p.vz ?? 0) + influence.strength * zStrength * (Math.random() - 0.5) * dtScale;
          }

          scattered = true;
        }
      } else if (mousePos) {
        // Classic distance-based repulsion (fallback when trail map disabled)
        const dx = p.currentX - mousePos.x;
        const dy = p.currentY - mousePos.y;
        const distSq = dx * dx + dy * dy;

        if (distSq < config.scatterRadius * config.scatterRadius && distSq > 0.01) {
          const dist = Math.sqrt(distSq);
          const force = config.scatterForce / distSq;

          // Blend radial with per-particle angle
          const radialX = dx / dist;
          const radialY = dy / dist;
          const angle = p.angle ?? 0;
          const angleX = Math.cos(angle);
          const angleY = Math.sin(angle);

          p.vx += (radialX * (1 - angleWeight) + angleX * angleWeight) * force * dtScale;
          p.vy += (radialY * (1 - angleWeight) + angleY * angleWeight) * force * dtScale;

          // Z-depth scatter
          if (config.zDepthEnabled) {
            const zStrength = config.zScatterStrength ?? 0.3;
            p.vz = (p.vz ?? 0) + force * zStrength * (Math.random() - 0.5) * dtScale;
          }

          scattered = true;
        }
      }

      // Reset flow time on scatter
      if (scattered && resetOnScatter) {
        if (staggerReturn) {
          // Stagger: farther particles wait longer to start returning
          const dist = Math.sqrt(
            (p.currentX - p.homeX) ** 2 + (p.currentY - p.homeY) ** 2,
          );
          const maxDist = config.scatterRadius * 2;
          p.t = -(dist / maxDist) * staggerMaxDelay - Math.random() * staggerMaxDelay * 0.5;
        } else {
          p.t = 0;
        }
      }

      // 2. Boid velocity alignment (Phase I2)
      if (config.flockAlignment && spatialHash) {
        const neighbors = spatialHash.query(p.currentX, p.currentY, 2.0);
        if (neighbors.length > 1) {
          let avgVx = 0;
          let avgVy = 0;
          let count = 0;
          for (const n of neighbors) {
            if (n.id === p.id) continue;
            avgVx += n.vx;
            avgVy += n.vy;
            count++;
          }
          if (count > 0) {
            avgVx /= count;
            avgVy /= count;
            const a = config.flockAlignment;
            p.vx = p.vx * (1 - a) + avgVx * a;
            p.vy = p.vy * (1 - a) + avgVy * a;
          }
        }
      }

      // 3. Personal space repulsion (Phase I3)
      if (config.personalSpace && spatialHash) {
        const tooClose = spatialHash.query(p.currentX, p.currentY, config.personalSpace);
        for (const n of tooClose) {
          if (n.id === p.id) continue;
          const dx = p.currentX - n.currentX;
          const dy = p.currentY - n.currentY;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d > 0.001 && d < config.personalSpace) {
            const push = (config.personalSpace - d) / config.personalSpace * 0.1;
            p.vx += (dx / d) * push * dtScale;
            p.vy += (dy / d) * push * dtScale;
          }
        }
      }

      // 4. Damping on momentum
      p.vx *= config.damping;
      p.vy *= config.damping;

      // 5. Integrate momentum from mouse interaction
      p.currentX += p.vx * dtScale;
      p.currentY += p.vy * dtScale;

      // Z-depth integration
      if (config.zDepthEnabled) {
        const vz = p.vz ?? 0;
        const z = p.z ?? 0;
        const newVz = vz * config.damping;
        const zReturn = config.zReturnSpeed ?? 0.02;
        const newZ = Math.max(-2, Math.min(2, z + newVz * dtScale + (0 - z) * zReturn * dtScale));
        p.vz = newVz;
        p.z = newZ;
      }

      // 6. Flow matching: smooth lerp toward home
      if (p.t < 1) {
        // Advance flow time
        const prevT = p.t;
        p.t = Math.min(p.t + particleFlowSpeed * dtScale, 1);

        // Only apply homing when t >= 0 (staggered particles wait)
        if (p.t >= 0 && prevT < 1) {
          const effectiveT = Math.max(p.t, 0);
          const effectivePrevT = Math.max(prevT, 0);

          if (config.cubicHoming) {
            // Cubic acceleration curve (obamify-inspired Phase I1)
            const dstForce = config.dstForce ?? 0.13;
            const factor = Math.min(Math.pow(effectiveT * dstForce * 10, 3), 1.0);
            p.vx += (p.homeX - p.currentX) * factor * dtScale;
            p.vy += (p.homeY - p.currentY) * factor * dtScale;
          } else if (config.clusterPhases && p.clusterX !== undefined && p.clusterY !== undefined) {
            // 2-phase cluster flow (Phase E3)
            if (effectiveT < 0.5) {
              // Phase 1: toward cluster centroid
              const localT = effectiveT * 2;
              const localPrevT = effectivePrevT * 2;
              const remaining = 1 - localPrevT;
              const alpha = remaining > 0.001 ? 1 - (1 - localT) / remaining : 1;
              p.currentX += (p.clusterX - p.currentX) * alpha;
              p.currentY += (p.clusterY - p.currentY) * alpha;
            } else {
              // Phase 2: from centroid to exact home
              const localT = (effectiveT - 0.5) * 2;
              const localPrevT = Math.max((effectivePrevT - 0.5) * 2, 0);
              const remaining = 1 - localPrevT;
              const alpha = remaining > 0.001 ? 1 - (1 - localT) / remaining : 1;
              p.currentX += (p.homeX - p.currentX) * alpha;
              p.currentY += (p.homeY - p.currentY) * alpha;
            }
          } else {
            // Standard exponential ease-out flow matching
            const remaining = 1 - effectivePrevT;
            const alpha = remaining > 0.001 ? 1 - (1 - effectiveT) / remaining : 1;

            const homeDx = p.homeX - p.currentX;
            const homeDy = p.homeY - p.currentY;

            p.currentX += homeDx * alpha;
            p.currentY += homeDy * alpha;
          }

          // Snap when close
          const newDx = p.homeX - p.currentX;
          const newDy = p.homeY - p.currentY;
          if (newDx * newDx + newDy * newDy < 0.01) {
            p.currentX = p.homeX;
            p.currentY = p.homeY;
            p.vx = 0;
            p.vy = 0;
            p.t = 1;
          }
        }
      }

      // 7. Idle drift (Phase F1)
      if (p.t === 1 && config.idleAmplitude && config.idleAmplitude > 0) {
        const noise = cheapNoise2D(p.homeX, p.homeY, time);
        p.currentX = p.homeX + noise * config.idleAmplitude;
        p.currentY = p.homeY + noise * config.idleAmplitude * 0.5;
      }
    }
  },
};

/** Reset the shared trail map (useful for scene transitions). */
export function resetTrailMap(): void {
  if (trailMap) trailMap.clear();
}
