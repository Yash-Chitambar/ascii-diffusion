// ── Particle ──

export interface AsciiParticle {
  id: number;
  homeX: number;
  homeY: number;
  currentX: number;
  currentY: number;
  vx: number;
  vy: number;
  /** Flow matching time in [0, 1]; 1 = arrived home. Can be negative for staggered start. */
  t: number;
  char: string;
  brightness: number;
  color?: string;
  /** Intrinsic scatter angle [0, π] — half-circle for asymmetric sweep */
  angle?: number;
  /** Per-particle flow speed override */
  flowSpeed?: number;
  /** Z depth offset (0 = at home plane, positive = receded, negative = closer) */
  z?: number;
  /** Z velocity */
  vz?: number;
  /** Phase 1 target X for 2-phase cluster flow matching */
  clusterX?: number;
  /** Phase 1 target Y for 2-phase cluster flow matching */
  clusterY?: number;
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
  | 'wave'
  | 'magnetic';

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

  // Phase A — Mouse interaction quality
  trailMaxAge?: number;           // Trail point max lifetime in frames (default: 120)
  trailForceScale?: number;       // Scale factor for velocity-baked force (default: 100)
  angleScatterWeight?: number;    // Weight of angle-directed vs radial scatter (default: 0.4)

  // Phase B — Z-depth simulation
  zDepthEnabled?: boolean;        // Enable Z-axis simulation (default: false)
  zScatterStrength?: number;      // How much mouse pushes particles in Z (default: 0.3)
  zReturnSpeed?: number;          // How fast Z returns to 0 (default: 0.02)

  // Phase C — Character morphing during flight
  charMorphEnabled?: boolean;     // Enable char substitution during flight (default: true)
  charMorphThreshold?: number;    // Displacement before char substitutes (default: 3.0)
  velocityCharsEnabled?: boolean; // Show direction chars when fast (default: false)

  // Phase E — Flow matching improvements
  staggerReturn?: boolean;        // Stagger return timing (default: true)
  staggerMaxDelay?: number;       // Max negative t for stagger (default: 0.4)
  flowSpeedVariance?: number;     // Per-particle speed variance (default: 0.5)
  clusterPhases?: boolean;        // 2-phase cluster-aware flow (default: false)

  // Phase F — Idle animation
  idleAmplitude?: number;         // Idle drift amplitude in cells (default: 0.0)
  idleFlicker?: boolean;          // Idle char flickering (default: false)

  // Phase I — obamify physics (all opt-in)
  cubicHoming?: boolean;          // Use cubic acceleration curve (default: false)
  dstForce?: number;              // Cubic homing strength (default: 0.13)
  flockAlignment?: number;        // Boid velocity alignment 0–1 (default: 0 = off)
  personalSpace?: number;         // P2P repulsion radius in cells (default: 0 = off)
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
