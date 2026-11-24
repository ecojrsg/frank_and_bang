// @Author: Jonathan Serna
// @Date:   2026-11-23 20:57:00
// @Last Modified by:   Jonathan Serna
// @Last Modified time: 2026-11-23 20:57:00

/**
 * Pure Gacha pack-opening engine modeled after collectible card games.
 */

import type { GachaPullResult, Part, PartRarity } from "./types";

export const PACK_SIZE = 3;
export const PACK_COST_COINS = 100;

export const RARITY_DROP_RATES: Record<PartRarity, number> = {
  normal: 0.7,
  rare: 0.24,
  unique: 0.06,
};

export const DUPLICATE_COIN_REWARDS: Record<PartRarity, number> = {
  normal: 15,
  rare: 35,
  unique: 75,
};

/**
 * Convert a uniform random number in [0, 1) into a part rarity tier.
 */
export function rollRarity(roll: number): PartRarity {
  const clamped = Math.max(0, Math.min(0.999999, roll));

  if (clamped < RARITY_DROP_RATES.unique) {
    return "unique";
  }
  if (clamped < RARITY_DROP_RATES.unique + RARITY_DROP_RATES.rare) {
    return "rare";
  }

  return "normal";
}

/**
 * Pick one active part matching the rolled rarity, falling back to the full
 * active pool if that rarity tier currently has no rows in parts_catalog.
 */
function pickPartByRarity(
  activeCatalog: Part[],
  rarity: PartRarity,
  rng: () => number
): Part {
  const matching = activeCatalog.filter((part) => part.rarity === rarity);
  const pool = matching.length > 0 ? matching : activeCatalog;
  const index = Math.floor(Math.max(0, Math.min(0.999999, rng())) * pool.length);
  return pool[index];
}

/**
 * Roll a pack of cards from the active catalog fetched from Supabase.
 *
 * @throws {Error} When the active catalog has no parts.
 */
export function rollPack(
  catalog: Part[],
  packSize: number = PACK_SIZE,
  rng: () => number = Math.random
): Part[] {
  const activeCatalog = catalog.filter((part) => part.isActive);
  if (activeCatalog.length === 0) {
    throw new Error("Cannot roll a Gacha pack from an empty active catalog.");
  }

  const pulled: Part[] = [];
  for (let index = 0; index < packSize; index++) {
    const rarity = rollRarity(rng());
    pulled.push(pickPartByRarity(activeCatalog, rarity, rng));
  }

  return pulled;
}

/**
 * Evaluate each pulled card against the player's current inventory,
 * marking new discoveries and calculating duplicate FrankenCoins.
 */
export function evaluatePackPulls(
  pulledParts: Part[],
  ownedPartIds: Set<string>
): { results: GachaPullResult[]; totalDuplicateCoins: number } {
  const seenInSession = new Set(ownedPartIds);
  const results: GachaPullResult[] = [];
  let totalDuplicateCoins = 0;

  for (const part of pulledParts) {
    const alreadyOwned = seenInSession.has(part.id);
    const duplicateCoins = alreadyOwned ? DUPLICATE_COIN_REWARDS[part.rarity] : 0;

    if (!alreadyOwned) {
      seenInSession.add(part.id);
    }

    totalDuplicateCoins += duplicateCoins;
    results.push({
      part,
      isNew: !alreadyOwned,
      duplicateCoins,
    });
  }

  return { results, totalDuplicateCoins };
}
