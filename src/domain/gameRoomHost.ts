// @Author: Jonathan Serna
// @Date:   2026-11-23 20:57:00
// @Last Modified by:   Jonathan Serna
// @Last Modified time: 2026-11-23 22:42:00

/**
 * Pure Host-Authoritative match state machine for Frank and Bang.
 * Supports 1v1 and 2v2 (up to 4 players) with dynamically scaled maps,
 * randomized terrain & minimum-distance spawns, jumping physics, and turns.
 */

import { applyExplosionDamage, determineWinningTeam } from "./combatEngine";
import {
  checkGrenadeImpact,
  createGrenadeProjectile,
  GRAVITY_PX_PER_SEC2,
  stepGrenadeProjectile,
} from "./physicsEngine";
import { getTraitBonus } from "./statsCalculator";
import {
  carveTerrainCrater,
  generateSpawnPositions,
  generateTerrainHeightMap,
  getArenaDimensions,
  getSurfaceY,
} from "./terrainEngine";
import type {
  CreatureAppearance,
  CreatureStats,
  FighterState,
  MatchSnapshot,
  PartRarity,
  PlayerCommand,
  TeamConfig,
  TeamId,
} from "./types";

export const BASE_TURN_SECONDS = 20;
const MOVE_STEP_PX = 14;
const MOVE_ENERGY_COST = 5;
const AIR_MOVE_VX_DELTA = 45;
const JUMP_VY = -340;
const JUMP_FORWARD_VX = 135;
const JUMP_ENERGY_COST = 12;
const MAX_CLIMB_HEIGHT_PX = 26;
const ARENA_PADDING_PX = 48;

export interface MatchParticipantInput {
  playerId: string;
  displayName: string;
  role: "host" | "guest";
  teamId: TeamId;
  stats: CreatureStats;
  rarityAccent: PartRarity;
  appearance: CreatureAppearance;
}

/**
 * Compute turn duration in seconds including any unique turn-time trait.
 */
export function getTurnDurationSeconds(fighter: FighterState): number {
  return BASE_TURN_SECONDS + getTraitBonus(fighter.activeTraits, "turn_time_bonus");
}

/**
 * Interleave team1 and team2 participants so turns alternate cleanly
 * (e.g. T1-P1 -> T2-P1 -> T1-P2 -> T2-P2).
 */
function buildInterleavedParticipants(
  participants: MatchParticipantInput[]
): MatchParticipantInput[] {
  const team1 = participants.filter((p) => p.teamId === "team1");
  const team2 = participants.filter((p) => p.teamId === "team2");
  const ordered: MatchParticipantInput[] = [];
  const maxLen = Math.max(team1.length, team2.length);

  for (let i = 0; i < maxLen; i++) {
    if (team1[i]) {
      ordered.push(team1[i]);
    }
    if (team2[i]) {
      ordered.push(team2[i]);
    }
  }

  return ordered;
}

/**
 * Build the initial authoritative match snapshot for 2 (1v1) or 4 (2v2) players
 * with randomized terrain heights and distance-enforced spawn positions.
 */
export function createInitialMatchState(
  roomCode: string,
  terrainSeed: number,
  participants: MatchParticipantInput[],
  teams: Record<TeamId, TeamConfig>
): MatchSnapshot {
  const { width: arenaWidth, height: arenaHeight } = getArenaDimensions(
    participants.length
  );
  const heightMap = generateTerrainHeightMap(arenaWidth, arenaHeight, terrainSeed);
  const ordered = buildInterleavedParticipants(participants);
  const spawns = generateSpawnPositions(arenaWidth, ordered.length, terrainSeed);

  const fighters: FighterState[] = ordered.map((participant, index) => {
    const spawnX = spawns[index] ?? Math.round(arenaWidth * 0.5);
    const teamConfig = teams[participant.teamId];

    return {
      playerId: participant.playerId,
      displayName: participant.displayName,
      role: participant.role,
      teamId: participant.teamId,
      teamColor: teamConfig.hex,
      teamName: teamConfig.name,
      x: spawnX,
      y: getSurfaceY(heightMap, spawnX),
      vx: 0,
      vy: 0,
      grounded: true,
      facing: 1,
      aimAngleDeg: 45,
      hp: participant.stats.maxHp,
      maxHp: participant.stats.maxHp,
      attack: participant.stats.attack,
      defense: participant.stats.defense,
      mobility: participant.stats.mobility,
      moveEnergyLeft: participant.stats.mobility,
      activeTraits: participant.stats.activeTraits,
      rarityAccent: participant.rarityAccent,
      appearance: participant.appearance,
    };
  });

  // Orient each fighter toward their nearest opponent at match start.
  for (const fighter of fighters) {
    const enemies = fighters.filter((other) => other.teamId !== fighter.teamId);
    let nearestX = arenaWidth / 2;
    let bestDistance = Infinity;
    for (const enemy of enemies) {
      const dist = Math.abs(enemy.x - fighter.x);
      if (dist < bestDistance) {
        bestDistance = dist;
        nearestX = enemy.x;
      }
    }
    fighter.facing = nearestX >= fighter.x ? 1 : -1;
  }

  const firstFighter = fighters[0];
  return {
    roomCode,
    phase: "aiming",
    turnNumber: 1,
    activePlayerId: firstFighter.playerId,
    turnSecondsLeft: getTurnDurationSeconds(firstFighter),
    terrainWidth: arenaWidth,
    terrainHeight: arenaHeight,
    heightMap,
    teams,
    fighters,
    projectile: null,
    lastExplosion: null,
    winnerPlayerId: null,
    winnerTeamId: null,
  };
}

/**
 * Switch to the next alive fighter in interleaved team order and refresh energy.
 */
export function advanceHostTurn(snapshot: MatchSnapshot): MatchSnapshot {
  if (snapshot.phase === "finished" || snapshot.fighters.length === 0) {
    return snapshot;
  }

  const currentIndex = snapshot.fighters.findIndex(
    (f) => f.playerId === snapshot.activePlayerId
  );
  let nextFighter = snapshot.fighters[0];

  for (let offset = 1; offset <= snapshot.fighters.length; offset++) {
    const candidate =
      snapshot.fighters[(Math.max(0, currentIndex) + offset) % snapshot.fighters.length];
    if (candidate.hp > 0) {
      nextFighter = candidate;
      break;
    }
  }

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
 * Apply one player command (move, jump, aim, or fire) during their active turn.
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

  if (command.type === "jump") {
    if (!activeFighter.grounded || activeFighter.moveEnergyLeft < JUMP_ENERGY_COST) {
      return snapshot;
    }

    return {
      ...snapshot,
      fighters: snapshot.fighters.map((f) =>
        f.playerId === playerId
          ? {
              ...f,
              y: f.y - 2,
              vx: f.facing * JUMP_FORWARD_VX,
              vy: JUMP_VY,
              grounded: false,
              moveEnergyLeft: f.moveEnergyLeft - JUMP_ENERGY_COST,
            }
          : f
      ),
    };
  }

  if (command.type === "move") {
    if (activeFighter.moveEnergyLeft < MOVE_ENERGY_COST) {
      return snapshot;
    }

    // Allow gentle mid-air horizontal steering while jumping.
    if (!activeFighter.grounded) {
      return {
        ...snapshot,
        fighters: snapshot.fighters.map((f) =>
          f.playerId === playerId
            ? {
                ...f,
                facing: command.direction,
                vx: Math.max(
                  -180,
                  Math.min(180, f.vx + command.direction * AIR_MOVE_VX_DELTA)
                ),
                moveEnergyLeft: f.moveEnergyLeft - MOVE_ENERGY_COST,
              }
            : f
        ),
      };
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
  };
}

/**
 * Step airborne fighters under gravity and land them cleanly on the heightmap.
 */
function stepFightersPhysics(
  fighters: FighterState[],
  heightMap: number[],
  terrainWidth: number,
  dtSeconds: number
): FighterState[] {
  return fighters.map((fighter) => {
    if (fighter.hp <= 0) {
      return fighter;
    }

    const groundY = getSurfaceY(heightMap, fighter.x);
    if (fighter.grounded && fighter.y >= groundY - 2) {
      return fighter.y === groundY ? fighter : { ...fighter, y: groundY };
    }

    const nextVy = fighter.vy + GRAVITY_PX_PER_SEC2 * dtSeconds;
    const nextX = Math.max(
      ARENA_PADDING_PX,
      Math.min(terrainWidth - ARENA_PADDING_PX, fighter.x + fighter.vx * dtSeconds)
    );
    const nextY = fighter.y + nextVy * dtSeconds;
    const nextGroundY = getSurfaceY(heightMap, nextX);

    if (nextY >= nextGroundY) {
      return {
        ...fighter,
        x: Math.round(nextX),
        y: nextGroundY,
        vx: 0,
        vy: 0,
        grounded: true,
      };
    }

    return {
      ...fighter,
      x: nextX,
      y: nextY,
      vy: nextVy,
      grounded: false,
    };
  });
}

/**
 * Advance the authoritative simulation by dtSeconds (fighter jumps/falls,
 * turn timer, and projectile flight).
 */
export function stepHostSimulation(
  snapshot: MatchSnapshot,
  dtSeconds: number
): MatchSnapshot {
  if (snapshot.phase === "finished" || snapshot.phase === "waiting") {
    return snapshot;
  }

  const steppedFighters = stepFightersPhysics(
    snapshot.fighters,
    snapshot.heightMap,
    snapshot.terrainWidth,
    dtSeconds
  );

  if (snapshot.phase === "aiming") {
    const nextSeconds = Math.max(0, snapshot.turnSecondsLeft - dtSeconds);
    const updatedSnapshot = {
      ...snapshot,
      fighters: steppedFighters,
      turnSecondsLeft: nextSeconds,
    };
    return nextSeconds === 0 ? advanceHostTurn(updatedSnapshot) : updatedSnapshot;
  }

  if (!snapshot.projectile) {
    return advanceHostTurn({ ...snapshot, fighters: steppedFighters });
  }

  const movedProjectile = stepGrenadeProjectile(snapshot.projectile, dtSeconds);
  const collision = checkGrenadeImpact(
    movedProjectile,
    snapshot.terrainWidth,
    snapshot.terrainHeight,
    snapshot.heightMap,
    steppedFighters
  );

  if (collision === "none") {
    return {
      ...snapshot,
      fighters: steppedFighters,
      projectile: movedProjectile,
    };
  }

  if (collision === "out_of_bounds") {
    return advanceHostTurn({
      ...snapshot,
      fighters: steppedFighters,
      projectile: null,
    });
  }

  // Resolve crater carving, explosion damage, crater drop, and team victory check.
  const carvedHeightMap = carveTerrainCrater(
    snapshot.heightMap,
    snapshot.terrainHeight,
    movedProjectile.x,
    movedProjectile.y,
    movedProjectile.blastRadius
  );

  const { updatedFighters, damages } = applyExplosionDamage(
    steppedFighters,
    movedProjectile.x,
    movedProjectile.y,
    movedProjectile.blastRadius,
    movedProjectile.attackerAtk
  );

  const settledFighters = updatedFighters.map((fighter) => {
    const craterY = getSurfaceY(carvedHeightMap, fighter.x);
    if (fighter.y < craterY - 2) {
      return { ...fighter, grounded: false };
    }
    return { ...fighter, y: craterY, grounded: true };
  });

  const winnerTeamId = determineWinningTeam(settledFighters);
  const winnerPlayerId = winnerTeamId
    ? settledFighters.find((f) => f.teamId === winnerTeamId && f.hp > 0)
        ?.playerId ??
      settledFighters.find((f) => f.teamId === winnerTeamId)?.playerId ??
      null
    : null;
  const nextExplosionId = (snapshot.lastExplosion?.explosionId ?? 0) + 1;

  const resolved: MatchSnapshot = {
    ...snapshot,
    heightMap: carvedHeightMap,
    fighters: settledFighters,
    projectile: null,
    lastExplosion: {
      explosionId: nextExplosionId,
      x: Math.round(movedProjectile.x),
      y: Math.round(movedProjectile.y),
      radius: movedProjectile.blastRadius,
      damages,
    },
    winnerPlayerId,
    winnerTeamId,
    phase: winnerTeamId ? "finished" : "aiming",
  };

  return winnerTeamId ? resolved : advanceHostTurn(resolved);
}
