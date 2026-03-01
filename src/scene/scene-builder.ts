import type { AsciiParticle, AsciiScene, ExtendedDiffusionConfig } from '../core/types.js';
import { DEFAULT_DIFFUSION_CONFIG } from '../core/types.js';
import { textToParticles, textToBlockParticles } from './text-to-particles.js';
import { gridToParticles } from './grid-to-particles.js';
import type { TextToParticlesOptions, BlockTextOptions } from './text-to-particles.js';
import type { GridToParticlesOptions } from './grid-to-particles.js';

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
    return {
      particles: [...this.allParticles],
      width: this.width,
      height: this.height,
      config: { ...this.config },
    };
  }
}
