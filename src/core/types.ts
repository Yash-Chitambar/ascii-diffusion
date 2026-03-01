// ── Particle ──

export interface AsciiParticle {
  id: number;
  homeX: number;
  homeY: number;
  currentX: number;
  currentY: number;
  vx: number;
  vy: number;
  /** Flow matching time in [0, 1]; 1 = arrived home */
  t: number;
  char: string;
  brightness: number;
  color?: string;
}

// ── Scene ──

export interface AsciiScene {
  particles: AsciiParticle[];
  width: number;
  height: number;
  config: ExtendedDiffusionConfig;
}

// ── Physics ──

export type PhysicsMode =
  | 'flow-matching'
  | 'diffusion'
  | 'gravity'
  | 'vortex'
  | 'explosion'
  | 'wave';

export interface DiffusionConfig {
  scatterRadius: number;
  scatterForce: number;
  springK: number;
  damping: number;
}

export interface ExtendedDiffusionConfig extends DiffusionConfig {
  physicsMode: PhysicsMode;
  // Flow matching
  flowSpeed?: number;
  epsilon?: number;
  resetOnScatter?: boolean;
  // Vortex
  vortexStrength?: number;
  vortexRadius?: number;
  // Explosion
  explosionForce?: number;
  reassembleDelay?: number;
  // Wave
  waveAmplitude?: number;
  waveFrequency?: number;
  waveDecay?: number;
}

export const DEFAULT_DIFFUSION_CONFIG: ExtendedDiffusionConfig = {
  physicsMode: 'flow-matching',
  scatterRadius: 8,
  scatterForce: 0.8,
  springK: 0.05,
  damping: 0.92,
  flowSpeed: 0.04,
  epsilon: 0.01,
  resetOnScatter: true,
};

// ── Rendering ──

export type ColorMode = 'mono' | 'per-particle' | 'brightness-mapped';
export type TransitionMode = 'morph' | 'dissolve' | 'instant';

export interface RenderConfig {
  colorMode: ColorMode;
  monoColor: string;
  backgroundColor: string;
  fontSize: string;
  fontFamily: string;
  lineHeight: number;
  letterSpacing: string;
  disableLigatures: boolean;
}

export const DEFAULT_RENDER_CONFIG: RenderConfig = {
  colorMode: 'mono',
  monoColor: '#00d4ff',
  backgroundColor: '#000000',
  fontSize: 'clamp(6px, 1.2vw, 14px)',
  fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
  lineHeight: 1.0,
  letterSpacing: '0em',
  disableLigatures: true,
};

// ── Physics applicator interface ──

export interface PhysicsApplicator {
  apply(
    particles: AsciiParticle[],
    mousePos: { x: number; y: number } | null,
    config: ExtendedDiffusionConfig,
    dt: number,
  ): void;
}

export interface ColorCell {
  char: string;
  color: string | null;
}
