// @Author: Jonathan Serna
// @Date:   2026-11-23 20:57:00
// @Last Modified by:   Jonathan Serna
// @Last Modified time: 2026-11-23 20:57:00

/**
 * Deterministic 2D destructible terrain heightmap engine.
 */

export const ARENA_WIDTH = 960;
export const ARENA_HEIGHT = 480;
const MIN_SURFACE_Y = 170;
const MAX_SURFACE_Y = 445;

/**
 * Create a deterministic mulberry32 pseudo-random generator from an integer seed.
 */
export function createSeededRng(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generate a smooth rolling 2D terrain heightmap where each index x stores
 * the Y coordinate of the ground surface (larger Y means lower on screen).
 */
export function generateTerrainHeightMap(
  width: number = ARENA_WIDTH,
  height: number = ARENA_HEIGHT,
  seed: number = 1337
): number[] {
  const rng = createSeededRng(seed);
  const phaseA = rng() * Math.PI * 2;
  const phaseB = rng() * Math.PI * 2;
  const ampA = 28 + rng() * 24;
  const ampB = 14 + rng() * 14;
  const baseLine = height * 0.64;

  const heightMap = new Array<number>(width);
  for (let x = 0; x < width; x++) {
    const ratio = x / width;
    const waveA = Math.sin(ratio * Math.PI * 2.4 + phaseA) * ampA;
    const waveB = Math.cos(ratio * Math.PI * 5.2 + phaseB) * ampB;
    const rawY = Math.round(baseLine + waveA + waveB);
    heightMap[x] = Math.max(MIN_SURFACE_Y, Math.min(MAX_SURFACE_Y, rawY));
  }

  return heightMap;
}

/**
 * Return the ground surface Y coordinate at horizontal position x.
 */
export function getSurfaceY(heightMap: number[], x: number): number {
  if (heightMap.length === 0) {
    return ARENA_HEIGHT;
  }

  const clampedX = Math.max(0, Math.min(heightMap.length - 1, Math.round(x)));
  return heightMap[clampedX];
}

/**
 * Carve a circular blast crater into the heightmap and return a new array.
 */
export function carveTerrainCrater(
  heightMap: number[],
  terrainHeight: number,
  centerX: number,
  centerY: number,
  radius: number
): number[] {
  const updated = [...heightMap];
  const minX = Math.max(0, Math.floor(centerX - radius));
  const maxX = Math.min(heightMap.length - 1, Math.ceil(centerX + radius));
  const floorLimit = terrainHeight - 18;

  for (let x = minX; x <= maxX; x++) {
    const dx = x - centerX;
    const verticalDepth = Math.sqrt(Math.max(0, radius * radius - dx * dx));
    const craterBottom = Math.min(floorLimit, Math.round(centerY + verticalDepth));

    if (craterBottom > updated[x]) {
      updated[x] = craterBottom;
    }
  }

  return updated;
}
