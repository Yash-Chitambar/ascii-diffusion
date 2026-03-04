import type { AsciiParticle } from '../core/types.js';

// ASCII brightness ramp (dark → bright)
export const BRIGHTNESS_RAMP = ' .:-=+*#%@';

/**
 * Map an ASCII character to a brightness value between 0.0 and 1.0.
 */
export function charToBrightness(char: string): number {
  const idx = BRIGHTNESS_RAMP.indexOf(char);
  if (idx >= 0) {
    return idx / (BRIGHTNESS_RAMP.length - 1);
  }
  // Default: printable characters get mid-to-high brightness
  return 0.7;
}

/**
 * Map a brightness value (0.0–1.0) to an ASCII character.
 */
export function brightnessToCh(brightness: number): string {
  const idx = Math.round(brightness * (BRIGHTNESS_RAMP.length - 1));
  return BRIGHTNESS_RAMP[Math.max(0, Math.min(idx, BRIGHTNESS_RAMP.length - 1))];
}

export interface GridToParticlesOptions {
  offsetX?: number;
  offsetY?: number;
  scattered?: boolean;
  scatterRadius?: number;
  color?: string;
}

let nextId = 0;

export function resetGridIdCounter(start = 0): void {
  nextId = start;
}

/**
 * Convert a 2D string array (grid) into an array of ASCII particles.
 * Skips space characters.
 */
export function gridToParticles(
  grid: string[],
  options: GridToParticlesOptions = {},
): AsciiParticle[] {
  const {
    offsetX = 0,
    offsetY = 0,
    scattered = false,
    scatterRadius = 20,
    color,
  } = options;

  const particles: AsciiParticle[] = [];

  for (let y = 0; y < grid.length; y++) {
    const line = grid[y];
    for (let x = 0; x < line.length; x++) {
      const char = line[x];
      if (char === ' ') continue;

      const homeX = x + offsetX;
      const homeY = y + offsetY;

      particles.push({
        id: nextId++,
        homeX,
        homeY,
        currentX: scattered ? homeX + (Math.random() - 0.5) * scatterRadius : homeX,
        currentY: scattered ? homeY + (Math.random() - 0.5) * scatterRadius : homeY,
        vx: 0,
        vy: 0,
        t: scattered ? 0 : 1,
        char,
        brightness: charToBrightness(char),
        color,
        angle: Math.random() * Math.PI,
      });
    }
  }

  return particles;
}
