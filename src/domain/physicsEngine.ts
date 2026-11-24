// @Author: Jonathan Serna
// @Date:   2026-11-23 20:57:00
// @Last Modified by:   Jonathan Serna
// @Last Modified time: 2026-11-23 22:42:00

/**
 * Parabolic grenade physics and collision helpers for 2D Worms-style combat.
 */

import { computeBlastRadius } from "./combatEngine";
import { getTraitBonus } from "./statsCalculator";
import { getSurfaceY } from "./terrainEngine";
import type { FighterState, GrenadeProjectile } from "./types";

export const GRAVITY_PX_PER_SEC2 = 520;
export const MIN_LAUNCH_SPEED = 280;
export const MAX_LAUNCH_SPEED = 1120;
const FIGHTER_HIT_RADIUS = 24;

/**
 * Create a newly launched grenade projectile from a fighter's aim and power.
 */
export function createGrenadeProjectile(
  shooter: FighterState,
  powerRatio: number
): GrenadeProjectile {
  const clampedPower = Math.max(0.15, Math.min(1, powerRatio));
  const speedBonusPct = getTraitBonus(shooter.activeTraits, "launch_speed_pct");
  const baseSpeed =
    MIN_LAUNCH_SPEED + (MAX_LAUNCH_SPEED - MIN_LAUNCH_SPEED) * clampedPower;
  const speed = baseSpeed * (1 + speedBonusPct / 100);

  const radians = (shooter.aimAngleDeg * Math.PI) / 180;
  const vx = Math.cos(radians) * speed * shooter.facing;
  const vy = -Math.sin(radians) * speed;

  return {
    x: shooter.x + shooter.facing * 18,
    y: shooter.y - 32,
    vx,
    vy,
    blastRadius: computeBlastRadius(shooter.activeTraits),
    ownerPlayerId: shooter.playerId,
    attackerAtk: shooter.attack,
  };
}

/**
 * Advance a grenade projectile by dt seconds under constant downward gravity.
 */
export function stepGrenadeProjectile(
  projectile: GrenadeProjectile,
  dtSeconds: number,
  gravity: number = GRAVITY_PX_PER_SEC2
): GrenadeProjectile {
  const nextVy = projectile.vy + gravity * dtSeconds;
  return {
    ...projectile,
    x: projectile.x + projectile.vx * dtSeconds,
    y: projectile.y + nextVy * dtSeconds,
    vy: nextVy,
  };
}

/**
 * Check whether a projectile hit the ground, a fighter, or exited the arena.
 */
export function checkGrenadeImpact(
  projectile: GrenadeProjectile,
  terrainWidth: number,
  terrainHeight: number,
  heightMap: number[],
  fighters: FighterState[]
): "none" | "impact" | "out_of_bounds" {
  if (
    projectile.x < -30 ||
    projectile.x > terrainWidth + 30 ||
    projectile.y > terrainHeight + 30
  ) {
    return "out_of_bounds";
  }

  const groundY = getSurfaceY(heightMap, projectile.x);
  if (projectile.y >= groundY) {
    return "impact";
  }

  for (const fighter of fighters) {
    if (fighter.hp <= 0 || fighter.playerId === projectile.ownerPlayerId) {
      continue;
    }
    const distance = Math.hypot(
      projectile.x - fighter.x,
      projectile.y - (fighter.y - 24)
    );
    if (distance <= FIGHTER_HIT_RADIUS) {
      return "impact";
    }
  }

  return "none";
}
