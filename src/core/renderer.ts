import type { AsciiParticle, ColorCell } from './types.js';

/**
 * Render particles to a monochrome string.
 * Brightest-wins: when two particles land on the same cell, the brighter one renders.
 */
export function renderToString(
  particles: AsciiParticle[],
  width: number,
  height: number,
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
        grid[y][x] = p.char;
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
        grid[y][x] = { char: p.char, color: p.color ?? null };
        brightnessGrid[y][x] = p.brightness;
      }
    }
  }

  return grid;
}
