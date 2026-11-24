// @Author: Jonathan Serna
// @Date:   2026-11-23 20:57:00
// @Last Modified by:   Jonathan Serna
// @Last Modified time: 2026-11-23 22:42:00

/**
 * Deterministic yet richly randomized 2D destructible terrain heightmap and
 * minimum-distance spawn placement engine.
 */

export const ARENA_WIDTH = 2600;
export const ARENA_4P_WIDTH = 4200;
export const ARENA_HEIGHT = 1050;
export const MIN_SPAWN_DISTANCE_2P = 1150;
export const MIN_SPAWN_DISTANCE_4P = 1050;

const MIN_SURFACE_Y = 240;
const EDGE_SPAWN_MARGIN_PX = 180;

/**
 * Return battlefield dimensions scaled to the number of players in the match.
 */
export function getArenaDimensions(playerCount: number): {
  width: number;
  height: number;
} {
  return {
    width: playerCount >= 4 ? ARENA_4P_WIDTH : ARENA_WIDTH,
    height: ARENA_HEIGHT,
  };
}

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
 * Generate a randomized multi-hill and Gaussian-peak 2D terrain heightmap
 * where each index x stores the Y coordinate of the ground surface.
 */
export function generateTerrainHeightMap(
  width: number = ARENA_WIDTH,
  height: number = ARENA_HEIGHT,
  seed: number = 1337
): number[] {
  const rng = createSeededRng(seed);
  const baseLine = height * (0.54 + rng() * 0.14);
  const maxSurfaceY = height - 110;

  // Four harmonic waves with randomized frequencies, phases, and amplitudes.
  const freqA = 2.4 + rng() * 2.2;
  const freqB = 5.2 + rng() * 3.4;
  const freqC = 9.5 + rng() * 5.0;
  const freqD = 16.0 + rng() * 6.0;
  const phaseA = rng() * Math.PI * 2;
  const phaseB = rng() * Math.PI * 2;
  const phaseC = rng() * Math.PI * 2;
  const phaseD = rng() * Math.PI * 2;
  const ampA = 55 + rng() * 65;
  const ampB = 30 + rng() * 42;
  const ampC = 14 + rng() * 22;
  const ampD = 6 + rng() * 10;

  // Two to three localized Gaussian peaks or canyons for distinct map silhouettes.
  const featureCount = 2 + Math.floor(rng() * 2);
  const features = Array.from({ length: featureCount }, () => ({
    center: width * (0.14 + rng() * 0.72),
    sigma: 120 + rng() * 140,
    deltaY: (rng() > 0.5 ? -1 : 1) * (85 + rng() * 85),
  }));

  const heightMap = new Array<number>(width);
  for (let x = 0; x < width; x++) {
    const ratio = x / width;
    let y =
      baseLine +
      Math.sin(ratio * Math.PI * freqA + phaseA) * ampA +
      Math.cos(ratio * Math.PI * freqB + phaseB) * ampB +
      Math.sin(ratio * Math.PI * freqC + phaseC) * ampC +
      Math.cos(ratio * Math.PI * freqD + phaseD) * ampD;

    for (const feature of features) {
      const dist = (x - feature.center) / feature.sigma;
      y += feature.deltaY * Math.exp(-0.5 * dist * dist);
    }

    heightMap[x] = Math.max(MIN_SURFACE_Y, Math.min(maxSurfaceY, Math.round(y)));
  }

  return heightMap;
}

/**
 * Generate randomized horizontal spawn positions across [EDGE_MARGIN, width - EDGE_MARGIN]
 * while strictly guaranteeing at least minDistance pixels between every pair.
 */
export function generateSpawnPositions(
  width: number,
  playerCount: number,
  seed: number,
  minDistance?: number
): number[] {
  if (playerCount <= 0) {
    return [];
  }

  const rng = createSeededRng((seed ^ 0x9e3779b9) >>> 0);
  const requiredDistance =
    minDistance ??
    (playerCount >= 4 ? MIN_SPAWN_DISTANCE_4P : MIN_SPAWN_DISTANCE_2P);
  const minX = EDGE_SPAWN_MARGIN_PX;
  const maxX = Math.max(minX + 100, width - EDGE_SPAWN_MARGIN_PX);
  const usableSpan = maxX - minX;

  // Try randomized rejection sampling first so spawns feel genuinely unpredictable.
  for (let attempt = 0; attempt < 400; attempt++) {
    const picked: number[] = [];
    for (let i = 0; i < playerCount; i++) {
      const candidate = Math.round(minX + rng() * usableSpan);
      if (picked.every((x) => Math.abs(x - candidate) >= requiredDistance)) {
        picked.push(candidate);
      }
    }
    if (picked.length === playerCount) {
      return picked;
    }
  }

  // Fallback: evenly spaced slots with bounded random jitter preserving minDistance.
  const effectiveMin = Math.min(
    requiredDistance,
    Math.floor(usableSpan / Math.max(1, playerCount - 1))
  );
  const extraSlack = Math.max(0, usableSpan - effectiveMin * (playerCount - 1));
  const jitterPerSlot = Math.floor(extraSlack / Math.max(1, playerCount));

  const fallback: number[] = [];
  for (let i = 0; i < playerCount; i++) {
    const base = minX + i * effectiveMin + Math.floor(i * jitterPerSlot);
    const jitter = jitterPerSlot > 0 ? Math.floor(rng() * jitterPerSlot) : 0;
    fallback.push(Math.max(minX, Math.min(maxX, base + jitter)));
  }

  // Shuffle order so teams are not locked to left-to-right indices.
  for (let i = fallback.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [fallback[i], fallback[j]] = [fallback[j], fallback[i]];
  }
  return fallback;
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
