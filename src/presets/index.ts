import type { ExtendedDiffusionConfig } from '../core/types.js';

type PresetConfig = Partial<ExtendedDiffusionConfig>;

export const PRESETS = {
  gentle: {
    scatterRadius: 5,
    scatterForce: 0.3,
    springK: 0.03,
    damping: 0.95,
  },
  responsive: {
    scatterRadius: 8,
    scatterForce: 0.8,
    springK: 0.05,
    damping: 0.92,
  },
  aggressive: {
    scatterRadius: 12,
    scatterForce: 2.0,
    springK: 0.08,
    damping: 0.85,
  },
  jelly: {
    scatterRadius: 10,
    scatterForce: 1.0,
    springK: 0.02,
    damping: 0.97,
  },
  snappy: {
    scatterRadius: 6,
    scatterForce: 0.5,
    springK: 0.15,
    damping: 0.80,
  },
  flow: {
    scatterRadius: 8,
    scatterForce: 0.8,
    springK: 0.05,
    damping: 0.92,
    physicsMode: 'flow-matching' as const,
    flowSpeed: 0.04,
    epsilon: 0.01,
    resetOnScatter: true,
  },

  // ── New presets from PLAN-ANIMATION-V2 ──

  cinema: {
    physicsMode: 'flow-matching' as const,
    staggerReturn: true,
    staggerMaxDelay: 0.5,
    charMorphEnabled: true,
    flowSpeed: 0.035,
    flowSpeedVariance: 0.6,
    scatterRadius: 10,
    scatterForce: 1.2,
    springK: 0.05,
    damping: 0.90,
  },
  shimmer: {
    physicsMode: 'flow-matching' as const,
    staggerReturn: true,
    idleAmplitude: 0.2,
    idleFlicker: true,
    flowSpeed: 0.06,
    scatterRadius: 6,
    scatterForce: 0.5,
    springK: 0.05,
    damping: 0.94,
  },
  depth: {
    physicsMode: 'flow-matching' as const,
    zDepthEnabled: true,
    zScatterStrength: 0.6,
    charMorphEnabled: true,
    staggerReturn: true,
    scatterRadius: 12,
    scatterForce: 1.5,
    springK: 0.05,
    damping: 0.88,
  },
  magnetic: {
    physicsMode: 'magnetic' as const,
    scatterRadius: 14,
    scatterForce: 1.0,
    springK: 0.04,
    damping: 0.92,
    flowSpeed: 0.05,
  },
  flock: {
    physicsMode: 'flow-matching' as const,
    cubicHoming: true,
    dstForce: 0.13,
    flockAlignment: 0.6,
    personalSpace: 1.2,
    staggerReturn: true,
    scatterRadius: 10,
    scatterForce: 1.0,
    springK: 0.05,
    damping: 0.97,
  },
} as const satisfies Record<string, PresetConfig>;

export type PresetName = keyof typeof PRESETS;
