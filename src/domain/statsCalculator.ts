// @Author: Jonathan Serna
// @Date:   2026-11-23 20:57:00
// @Last Modified by:   Jonathan Serna
// @Last Modified time: 2026-11-23 20:57:00

/**
 * Pure creature statistics calculator from the four equipped body parts.
 */

import type {
  CreatureStats,
  Loadout,
  Part,
  PartRarity,
  SpecialTrait,
  TraitEffectType,
} from "./types";

export const BASE_STATS = {
  hp: 100,
  attack: 20,
  defense: 5,
  mobility: 100,
} as const;

export const HP_DELTA_SCALE = 5;
export const MOV_DELTA_SCALE = 5;

const MIN_HP = 50;
const MIN_ATTACK = 5;
const MIN_DEFENSE = 0;
const MIN_MOBILITY = 40;

const RARITY_RANK: Record<PartRarity, number> = {
  normal: 1,
  rare: 2,
  unique: 3,
};

/**
 * Return all four parts from a creature loadout in anatomical order.
 */
export function getLoadoutParts(loadout: Loadout): Part[] {
  return [loadout.head, loadout.torso, loadout.arms, loadout.legs];
}

/**
 * Compute effective creature stats and active passive traits from a loadout.
 */
export function computeCreatureStats(loadout: Loadout): CreatureStats {
  const parts = getLoadoutParts(loadout);
  let hpDelta = 0;
  let atkDelta = 0;
  let defDelta = 0;
  let movDelta = 0;
  const activeTraits: SpecialTrait[] = [];

  for (const part of parts) {
    hpDelta += part.modifiers.hpDelta;
    atkDelta += part.modifiers.atkDelta;
    defDelta += part.modifiers.defDelta;
    movDelta += part.modifiers.movDelta;

    if (part.trait !== null) {
      activeTraits.push(part.trait);
    }
  }

  return {
    maxHp: Math.max(MIN_HP, BASE_STATS.hp + hpDelta * HP_DELTA_SCALE),
    attack: Math.max(MIN_ATTACK, BASE_STATS.attack + atkDelta),
    defense: Math.max(MIN_DEFENSE, BASE_STATS.defense + defDelta),
    mobility: Math.max(MIN_MOBILITY, BASE_STATS.mobility + movDelta * MOV_DELTA_SCALE),
    activeTraits,
  };
}

/**
 * Sum the total numeric bonus for a given special trait effect type.
 */
export function getTraitBonus(
  traits: SpecialTrait[],
  effectType: TraitEffectType
): number {
  let total = 0;

  for (const trait of traits) {
    if (trait.effectType === effectType) {
      total += trait.effectValue;
    }
  }

  return total;
}

/**
 * Return the highest rarity among the equipped parts for visual accents.
 */
export function getHighestLoadoutRarity(loadout: Loadout): PartRarity {
  const parts = getLoadoutParts(loadout);
  let highest: PartRarity = "normal";

  for (const part of parts) {
    if (RARITY_RANK[part.rarity] > RARITY_RANK[highest]) {
      highest = part.rarity;
    }
  }

  return highest;
}
