import type { AsciiParticle, ColorCell, ExtendedDiffusionConfig } from './types.js';

// Scatter chars: used when particles are far from home (Phase C1)
const SCATTER_CHARS = ['.', '·', ',', '`', "'", ':', ';'];

// Direction chars: used when particles are moving fast (Phase C2)
const DIRECTION_CHARS = ['−', '\\', '|', '/'];

// Densify map: heavier char versions for "closer" Z-depth (Phase B2)
const DENSIFY: Record<string, string> = {
  '.': ':', ',': ';', '-': '=', '+': '#', 'o': 'O', 'i': 'I',
  ':': '#', "'": '"', '`': "'",
};

// Import shared brightness ramp
import { BRIGHTNESS_RAMP } from '../scene/grid-to-particles.js';
function adjacentChar(ch: string): string {
  const idx = BRIGHTNESS_RAMP.indexOf(ch);
  if (idx < 0) return ch;
  const offset = Math.random() < 0.5 ? -1 : 1;
  const newIdx = Math.max(0, Math.min(BRIGHTNESS_RAMP.length - 1, idx + offset));
  return BRIGHTNESS_RAMP[newIdx];
}

/**
 * Get the effective character to render for a particle,
 * considering Z-depth, displacement morphing, and velocity direction.
 */
function getEffectiveChar(p: AsciiParticle, config?: ExtendedDiffusionConfig): string {
  // Phase C2: Velocity direction chars
  if (config?.velocityCharsEnabled) {
    const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
    if (speed > 1.5) {
      const vAngle = Math.atan2(p.vy, p.vx);
      const sector = Math.round(vAngle / (Math.PI / 4)) % 4;
      return DIRECTION_CHARS[Math.abs(sector)];
    }
  }

  // Phase B2: Z-depth character density
  if (config?.zDepthEnabled) {
    const z = p.z ?? 0;
    if (z > 1.5) return ' ';        // Far receded — invisible
    if (z > 0.8) return '.';        // Slightly receded — sparse
    if (z < -0.8) {                  // Closer — heavier version
      return DENSIFY[p.char] ?? p.char;
    }
  }

  // Phase C1: Distance-based char substitution during flight
  if (config?.charMorphEnabled !== false) {
    const threshold = config?.charMorphThreshold ?? 3.0;
    const homeDist = Math.sqrt(
      (p.currentX - p.homeX) ** 2 + (p.currentY - p.homeY) ** 2,
    );
    if (homeDist > threshold) {
      return SCATTER_CHARS[Math.floor(p.id * 7 + homeDist) % SCATTER_CHARS.length];
    }
  }

  // Phase F2: Idle character flicker
  if (config?.idleFlicker && p.t === 1 && Math.random() < 0.002) {
    return adjacentChar(p.char);
  }

  return p.char;
}

/**
 * Render particles to a monochrome string.
 * Brightest-wins: when two particles land on the same cell, the brighter one renders.
 */
export function renderToString(
  particles: AsciiParticle[],
  width: number,
  height: number,
  config?: ExtendedDiffusionConfig,
): string {
  // Initialize grid with spaces and brightness tracking
  const grid: string[][] = [];
  const brightnessGrid: number[][] = [];

  for (let y = 0; y < height; y++) {
    grid[y] = new Array(width).fill(' ');
    brightnessGrid[y] = new Array(width).fill(-1);
  }

  for (const p of particles) {
    const x = Math.round(p.currentX);
    const y = Math.round(p.currentY);

    if (x >= 0 && x < width && y >= 0 && y < height) {
      if (p.brightness > brightnessGrid[y][x]) {
        grid[y][x] = getEffectiveChar(p, config);
        brightnessGrid[y][x] = p.brightness;
      }
    }
  }

  // Join into string
  const lines: string[] = [];
  for (let y = 0; y < height; y++) {
    lines.push(grid[y].join(''));
  }
  return lines.join('\n');
}

/**
 * Render particles to a 2D color cell grid.
 * Brightest-wins per cell.
 */
export function renderToColorGrid(
  particles: AsciiParticle[],
  width: number,
  height: number,
  config?: ExtendedDiffusionConfig,
): ColorCell[][] {
  const grid: ColorCell[][] = [];
  const brightnessGrid: number[][] = [];

  for (let y = 0; y < height; y++) {
    grid[y] = [];
    brightnessGrid[y] = new Array(width).fill(-1);
    for (let x = 0; x < width; x++) {
      grid[y][x] = { char: ' ', color: null };
    }
  }

  for (const p of particles) {
    const x = Math.round(p.currentX);
    const y = Math.round(p.currentY);

    if (x >= 0 && x < width && y >= 0 && y < height) {
      if (p.brightness > brightnessGrid[y][x]) {
        grid[y][x] = { char: getEffectiveChar(p, config), color: p.color ?? null };
        brightnessGrid[y][x] = p.brightness;
      }
    }
  }

  return grid;
}

/**
 * Escape HTML special characters.
 */
export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Convert a ColorCell grid to an HTML string with colored spans.
 * Uses run-length encoding: consecutive cells of the same color share a span.
 */
export function colorGridToHtml(grid: ColorCell[][], fallbackColor: string): string {
  const lines: string[] = [];
  for (const row of grid) {
    let line = '';
    let runColor = '';
    let runChars = '';

    for (const cell of row) {
      const color = cell.color ?? fallbackColor;
      if (color === runColor) {
        runChars += escapeHtml(cell.char);
      } else {
        if (runChars) {
          line += `<span style="color:${runColor}">${runChars}</span>`;
        }
        runColor = color;
        runChars = escapeHtml(cell.char);
      }
    }
    if (runChars) {
      line += `<span style="color:${runColor}">${runChars}</span>`;
    }
    lines.push(line);
  }
  return lines.join('\n');
}
