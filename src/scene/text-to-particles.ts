import type { AsciiParticle } from '../core/types.js';
import { charToBrightness } from './grid-to-particles.js';

export interface TextToParticlesOptions {
  offsetX?: number;
  offsetY?: number;
  color?: string;
  brightness?: number;
  scattered?: boolean;
  scatterRadius?: number;
}

let nextId = 0;

export function resetIdCounter(): void {
  nextId = 0;
}

/**
 * Convert a plain text string into an array of ASCII particles.
 * Each non-space character becomes a particle at its grid position.
 */
export function textToParticles(
  text: string,
  options: TextToParticlesOptions = {},
): AsciiParticle[] {
  const {
    offsetX = 0,
    offsetY = 0,
    color,
    brightness,
    scattered = false,
    scatterRadius = 20,
  } = options;

  const lines = text.split('\n');
  const particles: AsciiParticle[] = [];

  for (let y = 0; y < lines.length; y++) {
    const line = lines[y];
    for (let x = 0; x < line.length; x++) {
      const char = line[x];
      if (char === ' ') continue;

      const homeX = x + offsetX;
      const homeY = y + offsetY;

      const particle: AsciiParticle = {
        id: nextId++,
        homeX,
        homeY,
        currentX: scattered ? homeX + (Math.random() - 0.5) * scatterRadius : homeX,
        currentY: scattered ? homeY + (Math.random() - 0.5) * scatterRadius : homeY,
        vx: 0,
        vy: 0,
        t: scattered ? 0 : 1,
        char,
        brightness: brightness ?? charToBrightness(char),
        color,
      };

      particles.push(particle);
    }
  }

  return particles;
}

// ── Block text (simple built-in 5x5 font) ──

const BLOCK_FONT: Record<string, string[]> = {
  A: ['  #  ', ' # # ', '#####', '#   #', '#   #'],
  B: ['#### ', '#   #', '#### ', '#   #', '#### '],
  C: [' ####', '#    ', '#    ', '#    ', ' ####'],
  D: ['#### ', '#   #', '#   #', '#   #', '#### '],
  E: ['#####', '#    ', '###  ', '#    ', '#####'],
  F: ['#####', '#    ', '###  ', '#    ', '#    '],
  G: [' ####', '#    ', '# ###', '#   #', ' ####'],
  H: ['#   #', '#   #', '#####', '#   #', '#   #'],
  I: ['#####', '  #  ', '  #  ', '  #  ', '#####'],
  J: ['#####', '   # ', '   # ', '#  # ', ' ##  '],
  K: ['#   #', '#  # ', '###  ', '#  # ', '#   #'],
  L: ['#    ', '#    ', '#    ', '#    ', '#####'],
  M: ['#   #', '## ##', '# # #', '#   #', '#   #'],
  N: ['#   #', '##  #', '# # #', '#  ##', '#   #'],
  O: [' ### ', '#   #', '#   #', '#   #', ' ### '],
  P: ['#### ', '#   #', '#### ', '#    ', '#    '],
  Q: [' ### ', '#   #', '# # #', '#  ##', ' ####'],
  R: ['#### ', '#   #', '#### ', '#  # ', '#   #'],
  S: [' ####', '#    ', ' ### ', '    #', '#### '],
  T: ['#####', '  #  ', '  #  ', '  #  ', '  #  '],
  U: ['#   #', '#   #', '#   #', '#   #', ' ### '],
  V: ['#   #', '#   #', '#   #', ' # # ', '  #  '],
  W: ['#   #', '#   #', '# # #', '## ##', '#   #'],
  X: ['#   #', ' # # ', '  #  ', ' # # ', '#   #'],
  Y: ['#   #', ' # # ', '  #  ', '  #  ', '  #  '],
  Z: ['#####', '   # ', '  #  ', ' #   ', '#####'],
  ' ': ['     ', '     ', '     ', '     ', '     '],
  '0': [' ### ', '#   #', '#   #', '#   #', ' ### '],
  '1': ['  #  ', ' ##  ', '  #  ', '  #  ', '#####'],
  '2': [' ### ', '#   #', '  ## ', ' #   ', '#####'],
  '3': ['#### ', '    #', ' ### ', '    #', '#### '],
  '4': ['#   #', '#   #', '#####', '    #', '    #'],
  '5': ['#####', '#    ', '#### ', '    #', '#### '],
  '6': [' ####', '#    ', '#### ', '#   #', ' ### '],
  '7': ['#####', '   # ', '  #  ', ' #   ', '#    '],
  '8': [' ### ', '#   #', ' ### ', '#   #', ' ### '],
  '9': [' ### ', '#   #', ' ####', '    #', '#### '],
  '!': ['  #  ', '  #  ', '  #  ', '     ', '  #  '],
  '.': ['     ', '     ', '     ', '     ', '  #  '],
  ',': ['     ', '     ', '     ', '  #  ', ' #   '],
  '?': [' ### ', '#   #', '  ## ', '     ', '  #  '],
};

export interface BlockTextOptions {
  offsetX?: number;
  offsetY?: number;
  color?: string;
  scattered?: boolean;
  scatterRadius?: number;
  spacing?: number;
}

/**
 * Convert text to large block letter particles using a built-in 5x5 font.
 */
export function textToBlockParticles(
  text: string,
  options: BlockTextOptions = {},
): AsciiParticle[] {
  const {
    offsetX = 0,
    offsetY = 0,
    color,
    scattered = false,
    scatterRadius = 30,
    spacing = 1,
  } = options;

  const particles: AsciiParticle[] = [];
  const charWidth = 5 + spacing;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i].toUpperCase();
    const glyph = BLOCK_FONT[ch];
    if (!glyph) continue;

    const baseX = offsetX + i * charWidth;

    for (let y = 0; y < glyph.length; y++) {
      for (let x = 0; x < glyph[y].length; x++) {
        if (glyph[y][x] === ' ') continue;

        const homeX = baseX + x;
        const homeY = offsetY + y;

        particles.push({
          id: nextId++,
          homeX,
          homeY,
          currentX: scattered ? homeX + (Math.random() - 0.5) * scatterRadius : homeX,
          currentY: scattered ? homeY + (Math.random() - 0.5) * scatterRadius : homeY,
          vx: 0,
          vy: 0,
          t: scattered ? 0 : 1,
          char: '#',
          brightness: 1.0,
          color,
        });
      }
    }
  }

  return particles;
}
