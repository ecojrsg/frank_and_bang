// @Author: Jonathan Serna
// @Date:   2026-11-23 20:57:00
// @Last Modified by:   Jonathan Serna
// @Last Modified time: 2026-11-23 20:57:00

/**
 * Pure Host-Authoritative match state machine for Frank and Bang.
 * Runs exclusively on the Host browser and broadcasts snapshots to the Guest.
 */

import { applyExplosionDamage, determineWinner } from "./combatEngine";
import { checkGrenadeImpact, createGrenadeProjectile, stepGrenadeProjectile } from "./physicsEngine";
import { getTraitBonus } from "./statsCalculator";
import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  carveTerrainCrater,
  generateTerrainHeightMap,
  getSurfaceY,
} from "./terrainEngine";
import type {
  CreatureStats,
  FighterState,
  MatchSnapshot,
  PartRarity,
  PlayerCommand,
} from "./types";

export const BASE_TURN_SECONDS = 20;
const MOVE_STEP_PX = 8;
const MOVE_ENERGY_COST = 5;
const MAX_CLIMB_HEIGHT_PX = 18;
const ARENA_PADDING_PX = 32;

export interface MatchParticipantInput {
  playerId: string;
  displayName: string;
  role: "host" | "guest";
  stats: CreatureStats;
  rarityAccent: PartRarity;
}

/**
 * Compute turn duration in seconds including any unique turn-time trait.
 */
export function getTurnDurationSeconds(fighter: FighterState): number {
  return BASE_TURN_SECONDS + getTraitBonus(fighter.activeTraits, "turn_time_bonus");
}

/**
 * Build the initial authoritative match snapshot for two connected players.
 */
export function createInitialMatchState(
  roomCode: string,
  terrainSeed: number,
  host: MatchParticipantInput,
  guest: MatchParticipantInput
): MatchSnapshot {
  const heightMap = generateTerrainHeightMap(ARENA_WIDTH, ARENA_HEIGHT, terrainSeed);
  const hostX = Math.round(ARENA_WIDTH * 0.22);
  const guestX = Math.round(ARENA_WIDTH * 0.78);

  const hostFighter: FighterState = {
    playerId: host.playerId,
    displayName: host.displayName,
    role: "host",
    x: hostX,
    y: getSurfaceY(heightMap, hostX),
    facing: 1,
    aimAngleDeg: 45,
    hp: host.stats.maxHp,
    maxHp: host.stats.maxHp,
    attack: host.stats.attack,
    defense: host.stats.defense,
    mobility: host.stats.mobility,
    moveEnergyLeft: host.stats.mobility,
    activeTraits: host.stats.activeTraits,
    rarityAccent: host.rarityAccent,
  };

  const guestFighter: FighterState = {
    playerId: guest.playerId,
    displayName: guest.displayName,
    role: "guest",
    x: guestX,
    y: getSurfaceY(heightMap, guestX),
    facing: -1,
    aimAngleDeg: 45,
    hp: guest.stats.maxHp,
    maxHp: guest.stats.maxHp,
    attack: guest.stats.attack,
    defense: guest.stats.defense,
    mobility: guest.stats.mobility,
    moveEnergyLeft: guest.stats.mobility,
    activeTraits: guest.stats.activeTraits,
    rarityAccent: guest.rarityAccent,
  };

  return {
    roomCode,
    phase: "aiming",
    turnNumber: 1,
    activePlayerId: hostFighter.playerId,
    turnSecondsLeft: getTurnDurationSeconds(hostFighter),
    terrainWidth: ARENA_WIDTH,
    terrainHeight: ARENA_HEIGHT,
    heightMap,
    fighters: [hostFighter, guestFighter],
    projectile: null,
    lastExplosion: null,
    winnerPlayerId: null,
  };
}

/**
 * Snap all fighters onto the current ground heightmap after terrain changes.
 */
function settleFightersOnTerrain(
  fighters: FighterState[],
  heightMap: number[]
): FighterState[] {
  return fighters.map((fighter) => ({
    ...fighter,
    y: getSurfaceY(heightMap, fighter.x),
  }));
}

/**
 * Switch to the next player's turn and refresh their movement energy and timer.
 */
export function advanceHostTurn(snapshot: MatchSnapshot): MatchSnapshot {
  if (snapshot.phase === "finished") {
    return snapshot;
  }

  const nextFighter =
    snapshot.fighters.find((f) => f.playerId !== snapshot.activePlayerId) ??
    snapshot.fighters[0];

  const refreshedFighters = snapshot.fighters.map((fighter) =>
    fighter.playerId === nextFighter.playerId
      ? { ...fighter, moveEnergyLeft: fighter.mobility }
      : fighter
  );

  return {
    ...snapshot,
    phase: "aiming",
    turnNumber: snapshot.turnNumber + 1,
    activePlayerId: nextFighter.playerId,
    turnSecondsLeft: getTurnDurationSeconds(nextFighter),
    fighters: refreshedFighters,
    projectile: null,
  };
}

/**
 * Apply one player command (move, aim, or fire) if it belongs to the active turn.
 */
export function applyPlayerCommand(
  snapshot: MatchSnapshot,
  playerId: string,
  command: PlayerCommand
): MatchSnapshot {
  if (snapshot.phase !== "aiming" || snapshot.activePlayerId !== playerId) {
    return snapshot;
  }

  const activeFighter = snapshot.fighters.find((f) => f.playerId === playerId);
  if (!activeFighter || activeFighter.hp <= 0) {
    return snapshot;
  }

  if (command.type === "aim") {
    const clampedAngle = Math.max(10, Math.min(85, Math.round(command.angleDeg)));
    return {
      ...snapshot,
      fighters: snapshot.fighters.map((f) =>
        f.playerId === playerId ? { ...f, aimAngleDeg: clampedAngle } : f
      ),
    };
  }

  if (command.type === "move") {
    if (activeFighter.moveEnergyLeft < MOVE_ENERGY_COST) {
      return snapshot;
    }

    const candidateX = Math.max(
      ARENA_PADDING_PX,
      Math.min(
        snapshot.terrainWidth - ARENA_PADDING_PX,
        activeFighter.x + command.direction * MOVE_STEP_PX
      )
    );
    const candidateY = getSurfaceY(snapshot.heightMap, candidateX);

    // Block climbing sheer crater cliffs while still allowing facing changes.
    const canClimb = activeFighter.y - candidateY <= MAX_CLIMB_HEIGHT_PX;
    const nextX = canClimb ? candidateX : activeFighter.x;
    const nextY = canClimb ? candidateY : activeFighter.y;

    return {
      ...snapshot,
      fighters: snapshot.fighters.map((f) =>
        f.playerId === playerId
          ? {
              ...f,
              x: nextX,
              y: nextY,
              facing: command.direction,
              moveEnergyLeft: canClimb
                ? f.moveEnergyLeft - MOVE_ENERGY_COST
                : f.moveEnergyLeft,
            }
          : f
      ),
    };
  }

  // Launch grenade projectile and lock further actions during flight.
  const projectile = createGrenadeProjectile(activeFighter, command.powerRatio);
  return {
    ...snapshot,
    phase: "projectile",
    projectile,
    lastExplosion: null,
  };
}

/**
 * Advance the authoritative simulation by dtSeconds (turn timer or projectile).
 */
export function stepHostSimulation(
  snapshot: MatchSnapshot,
  dtSeconds: number
): MatchSnapshot {
  if (snapshot.phase === "finished" || snapshot.phase === "waiting") {
    return snapshot;
  }

  if (snapshot.phase === "aiming") {
    const nextSeconds = Math.max(0, snapshot.turnSecondsLeft - dtSeconds);
    if (nextSeconds === 0) {
      return advanceHostTurn(snapshot);
    }
    return { ...snapshot, turnSecondsLeft: nextSeconds };
  }

  if (!snapshot.projectile) {
    return advanceHostTurn(snapshot);
  }

  const movedProjectile = stepGrenadeProjectile(snapshot.projectile, dtSeconds);
  const collision = checkGrenadeImpact(
    movedProjectile,
    snapshot.terrainWidth,
    snapshot.terrainHeight,
    snapshot.heightMap,
    snapshot.fighters
  );

  if (collision === "none") {
    return { ...snapshot, projectile: movedProjectile };
  }

  if (collision === "out_of_bounds") {
    return advanceHostTurn({ ...snapshot, projectile: null });
  }

  // Resolve crater carving, explosion damage, and victory check.
  const carvedHeightMap = carveTerrainCrater(
    snapshot.heightMap,
    snapshot.terrainHeight,
    movedProjectile.x,
    movedProjectile.y,
    movedProjectile.blastRadius
  );

  const { updatedFighters, damages } = applyExplosionDamage(
    snapshot.fighters,
    movedProjectile.x,
    movedProjectile.y,
    movedProjectile.blastRadius,
    movedProjectile.attackerAtk
  );

  const settledFighters = settleFightersOnTerrain(updatedFighters, carvedHeightMap);
  const winnerPlayerId = determineWinner(settledFighters);

  const resolved: MatchSnapshot = {
    ...snapshot,
    heightMap: carvedHeightMap,
    fighters: settledFighters,
    projectile: null,
    lastExplosion: {
      x: Math.round(movedProjectile.x),
      y: Math.round(movedProjectile.y),
      radius: movedProjectile.blastRadius,
      damages,
    },
    winnerPlayerId,
    phase: winnerPlayerId ? "finished" : "aiming",
  };

  return winnerPlayerId ? resolved : advanceHostTurn(resolved);
}
