import type { AsciiParticle, AsciiScene, ExtendedDiffusionConfig } from '../core/types.js';
import { DEFAULT_DIFFUSION_CONFIG } from '../core/types.js';
import { brightnessToCh } from './grid-to-particles.js';
import { assignClusterCentroids } from './assignment.js';

export interface ImageToParticlesOptions {
  /** Start particles at random positions (default: true) */
  scattered?: boolean;
  /** How far scattered particles spread from their home (default: 40) */
  scatterRadius?: number;
  /** Minimum brightness to emit a particle (0–1, default: 0.05) */
  brightnessThreshold?: number;
  /** Physics config override */
  config?: Partial<ExtendedDiffusionConfig>;
}

/**
 * Convert an already-loaded HTMLImageElement to an AsciiScene.
 *
 * Draws the image onto a hidden canvas at the target grid resolution,
 * reads pixel data, maps brightness → ASCII char, and returns particles
 * with optional random scatter.
 */
export function imageToAsciiScene(
  img: HTMLImageElement,
  gridWidth: number,
  gridHeight: number,
  options: ImageToParticlesOptions = {},
): AsciiScene {
  const {
    scattered = true,
    scatterRadius = 40,
    brightnessThreshold = 0.05,
    config: configOverrides,
  } = options;

  // Draw image to an offscreen canvas at grid resolution
  const canvas = document.createElement('canvas');
  canvas.width = gridWidth;
  canvas.height = gridHeight;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, gridWidth, gridHeight);

  const imageData = ctx.getImageData(0, 0, gridWidth, gridHeight);
  const pixels = imageData.data;

  const particles: AsciiParticle[] = [];
  let id = 0;

  for (let y = 0; y < gridHeight; y++) {
    for (let x = 0; x < gridWidth; x++) {
      const i = (y * gridWidth + x) * 4;
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      const a = pixels[i + 3] / 255;

      // Perceived brightness (ITU-R BT.601) scaled by alpha
      const brightness = ((0.299 * r + 0.587 * g + 0.114 * b) / 255) * a;

      if (brightness < brightnessThreshold) continue;

      const char = brightnessToCh(brightness);
      if (char === ' ') continue;

      particles.push({
        id: id++,
        homeX: x,
        homeY: y,
        currentX: scattered ? x + (Math.random() - 0.5) * scatterRadius : x,
        currentY: scattered ? y + (Math.random() - 0.5) * scatterRadius : y,
        vx: 0,
        vy: 0,
        t: scattered ? 0 : 1,
        char,
        brightness,
        color: `rgb(${r},${g},${b})`,
        angle: Math.random() * Math.PI,
      });
    }
  }

  const mergedConfig: ExtendedDiffusionConfig = {
    ...DEFAULT_DIFFUSION_CONFIG,
    ...configOverrides,
  };

  // E2: Apply per-particle flow speed variance at build time
  const baseFlowSpeed = mergedConfig.flowSpeed ?? 0.04;
  const variance = mergedConfig.flowSpeedVariance ?? 0;
  if (variance > 0) {
    for (const p of particles) {
      p.flowSpeed = baseFlowSpeed * (1 - variance * 0.5 + Math.random() * variance);
    }
  }

  // E3: Compute cluster centroids via simple spatial grid clustering
  if (mergedConfig.clusterPhases) {
    assignClusterCentroids(particles, gridWidth, gridHeight);
  }

  return { particles, width: gridWidth, height: gridHeight, config: mergedConfig };
}

