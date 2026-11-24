// @Author: Jonathan Serna
// @Date:   2026-11-23 20:57:00
// @Last Modified by:   Jonathan Serna
// @Last Modified time: 2026-11-23 20:57:00

/**
 * Pure combat damage and victory resolution rules for Frank and Bang.
 */

import { getTraitBonus } from "./statsCalculator";
import type { DamageEvent, FighterState, SpecialTrait } from "./types";

export const BASE_GRENADE_BLAST_RADIUS = 44;
const DIRECT_HIT_THRESHOLD_RATIO = 0.4;
const MIN_DAMAGE = 1;

/**
 * Calculate effective damage after defense mitigation and splash falloff.
 *
 * Example: 20 ATK vs 5 DEF on a direct hit (ratio 1.0) deals exactly 15 damage.
 */
export function calculateDamage(
  attackerAtk: number,
  defenderDef: number,
  splashRatio: number = 1,
  splashResistPct: number = 0
): number {
  const clampedSplash = Math.max(0, Math.min(1, splashRatio));
  if (clampedSplash === 0) {
    return 0;
  }

  const baseHit = Math.max(MIN_DAMAGE, attackerAtk - defenderDef);
  const isSplash = clampedSplash < 1;
  const resistMultiplier = isSplash
    ? Math.max(0.25, 1 - splashResistPct / 100)
    : 1;

  return Math.max(MIN_DAMAGE, Math.round(baseHit * clampedSplash * resistMultiplier));
}

/**
 * Compute effective grenade blast radius including unique part traits.
 */
export function computeBlastRadius(traits: SpecialTrait[]): number {
  const bonusPct = getTraitBonus(traits, "blast_radius_pct");
  return Math.round(BASE_GRENADE_BLAST_RADIUS * (1 + bonusPct / 100));
}

/**
 * Apply explosion damage to all fighters within the blast radius and return
 * both updated fighter snapshots and individual damage events.
 */
export function applyExplosionDamage(
  fighters: FighterState[],
  impactX: number,
  impactY: number,
  blastRadius: number,
  attackerAtk: number
): { updatedFighters: FighterState[]; damages: DamageEvent[] } {
  const damages: DamageEvent[] = [];
  const updatedFighters = fighters.map((fighter) => {
    const distance = Math.hypot(fighter.x - impactX, fighter.y - 16 - impactY);
    if (distance > blastRadius || fighter.hp <= 0) {
      return fighter;
    }

    const directHit = distance <= blastRadius * DIRECT_HIT_THRESHOLD_RATIO;
    const splashRatio = directHit
      ? 1
      : Math.max(0.45, 1 - (distance / blastRadius) * 0.55);
    const splashResistPct = getTraitBonus(fighter.activeTraits, "splash_resist_pct");
    const damage = calculateDamage(
      attackerAtk,
      fighter.defense,
      splashRatio,
      splashResistPct
    );
    const remainingHp = Math.max(0, fighter.hp - damage);

    damages.push({
      targetPlayerId: fighter.playerId,
      damage,
      remainingHp,
      directHit,
    });

    return { ...fighter, hp: remainingHp };
  });

  return { updatedFighters, damages };
}

/**
 * Determine the winner player ID when at most one fighter remains standing.
 */
export function determineWinner(fighters: FighterState[]): string | null {
  const alive = fighters.filter((fighter) => fighter.hp > 0);
  if (alive.length === 1) {
    return alive[0].playerId;
  }
  if (alive.length === 0 && fighters.length > 0) {
    return fighters[0].playerId;
  }
  return null;
}
