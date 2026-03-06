import type { AsciiParticle, AsciiScene, ExtendedDiffusionConfig } from '../core/types.js';
import { DEFAULT_DIFFUSION_CONFIG } from '../core/types.js';
import { textToParticles, textToBlockParticles } from './text-to-particles.js';
import { gridToParticles } from './grid-to-particles.js';
import type { TextToParticlesOptions, BlockTextOptions } from './text-to-particles.js';
import type { GridToParticlesOptions } from './grid-to-particles.js';
import { assignClusterCentroids } from './assignment.js';

/**
 * Fluent API for composing ASCII scenes from multiple sources.
 */
export class SceneBuilder {
  private width: number;
  private height: number;
  private allParticles: AsciiParticle[] = [];
  private config: ExtendedDiffusionConfig = { ...DEFAULT_DIFFUSION_CONFIG };

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  addText(text: string, options?: TextToParticlesOptions): this {
    const particles = textToParticles(text, options);
    this.allParticles.push(...particles);
    return this;
  }

  addBlockText(text: string, options?: BlockTextOptions): this {
    const particles = textToBlockParticles(text, options);
    this.allParticles.push(...particles);
    return this;
  }

  addGrid(grid: string[], options?: GridToParticlesOptions): this {
    const particles = gridToParticles(grid, options);
    this.allParticles.push(...particles);
    return this;
  }

  addParticles(particles: AsciiParticle[]): this {
    this.allParticles.push(...particles);
    return this;
  }

  setConfig(config: Partial<ExtendedDiffusionConfig>): this {
    this.config = { ...this.config, ...config };
    return this;
  }

  build(): AsciiScene {
    const particles = [...this.allParticles];
    const config = { ...this.config };

    // Apply flow speed variance if configured
    const baseFlowSpeed = config.flowSpeed ?? 0.04;
    const variance = config.flowSpeedVariance ?? 0;
    if (variance > 0) {
      for (const p of particles) {
        p.flowSpeed = baseFlowSpeed * (1 - variance * 0.5 + Math.random() * variance);
      }
    }

    // Compute cluster centroids if cluster phases enabled
    if (config.clusterPhases) {
      assignClusterCentroids(particles, this.width, this.height);
    }

    return { particles, width: this.width, height: this.height, config };
  }
}
