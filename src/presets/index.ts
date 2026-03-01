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
  magnetic: {
    scatterRadius: 15,
    scatterForce: 1.5,
    springK: 0.04,
    damping: 0.90,
    physicsMode: 'gravity' as const,
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
} as const satisfies Record<string, PresetConfig>;

export type PresetName = keyof typeof PRESETS;
