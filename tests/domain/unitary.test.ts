// @Author: Daniel Martinez
// @Date:   2026-11-24 22:20:28
// @Last Modified by: Daniel Martinez
// @Last Modified time: 2026-11-24 22:21:34

/**
 * Unit tests for map generation, principal stat limits, and Gacha part results.
 */

import { describe, expect, it } from "vitest";

import {
  calculateDamage,
  applyExplosionDamage,
} from "@/domain/combatEngine";
import {
  DUPLICATE_COIN_REWARDS,
  PACK_SIZE,
  RARITY_DROP_RATES,
  evaluatePackPulls,
  rollPack,
  rollRarity,
} from "@/domain/gachaEngine";
import {
  advanceHostTurn,
  applyPlayerCommand,
  createInitialMatchState,
} from "@/domain/gameRoomHost";
import { createDefaultLobbyTeams } from "@/domain/teamLobby";
import { computeCreatureStats } from "@/domain/statsCalculator";
import {
  ARENA_4P_WIDTH,
  ARENA_HEIGHT,
  ARENA_WIDTH,
  MIN_SPAWN_DISTANCE_2P,
  MIN_SPAWN_DISTANCE_4P,
  carveTerrainCrater,
  createSeededRng,
  generateSpawnPositions,
  generateTerrainHeightMap,
  getArenaDimensions,
  getSurfaceY,
} from "@/domain/terrainEngine";
import type { MatchParticipantInput } from "@/domain/gameRoomHost";
import type {
  CreatureAppearance,
  CreatureStats,
  Loadout,
  MatchSnapshot,
  Part,
  PartRarity,
  PartSlot,
  SpecialTrait,
  StatModifier,
  TeamId,
} from "@/domain/types";

const ZERO_MODIFIERS: StatModifier = {
  hpDelta: 0,
  atkDelta: 0,
  defDelta: 0,
  movDelta: 0,
};

const TEST_TRAIT: SpecialTrait = {
  id: "test_blast_bonus",
  name: "Test Blast Bonus",
  description: "Fixture passive used by unit tests.",
  effectType: "blast_radius_pct",
  effectValue: 10,
};

const TEST_APPEARANCE: CreatureAppearance = {
  headId: "head_fixture",
  torsoId: "torso_fixture",
  armsId: "arms_fixture",
  legsId: "legs_fixture",
  headRarity: "normal",
  torsoRarity: "normal",
  armsRarity: "normal",
  legsRarity: "normal",
};

// These literals mirror private constants in terrainEngine and gameRoomHost.
const MIN_SURFACE_Y = 240;
const SPAWN_EDGE_MARGIN = 180;
const TERRAIN_FLOOR_OFFSET = 18;
const MOVE_ENERGY_COST = 5;
const JUMP_ENERGY_COST = 12;

interface BuildPartOptions {
  slot: PartSlot;
  id: string;
  rarity?: PartRarity;
  modifiers?: StatModifier;
  trait?: SpecialTrait | null;
  isActive?: boolean;
}

/** Build a catalog part fixture without depending on Supabase Storage. */
function buildPart({
  slot,
  id,
  rarity = "normal",
  modifiers = ZERO_MODIFIERS,
  trait = null,
  isActive = true,
}: BuildPartOptions): Part {
  return {
    id,
    name: `${slot} ${rarity} fixture`,
    slot,
    rarity,
    assetPath: null,
    cardAssetPath: null,
    assetUrl: null,
    cardAssetUrl: null,
    description: "Fixture part for unit tests.",
    modifiers: { ...modifiers },
    trait,
    isStarter: false,
    isActive,
  };
}

/** Build a four-slot loadout whose parts share the same modifiers. */
function buildLoadout(
  modifiers: StatModifier = ZERO_MODIFIERS,
  rarity: PartRarity = "normal",
  trait: SpecialTrait | null = null
): Loadout {
  return {
    head: buildPart({ slot: "head", id: `head_${rarity}`, rarity, modifiers, trait }),
    torso: buildPart({ slot: "torso", id: `torso_${rarity}`, rarity, modifiers, trait }),
    arms: buildPart({ slot: "arms", id: `arms_${rarity}`, rarity, modifiers, trait }),
    legs: buildPart({ slot: "legs", id: `legs_${rarity}`, rarity, modifiers, trait }),
  };
}

/** Build one participant with deterministic stats and appearance. */
function buildParticipant(
  playerId: string,
  teamId: TeamId,
  stats: CreatureStats
): MatchParticipantInput {
  return {
    playerId,
    displayName: playerId,
    role: playerId === "p1" ? "host" : "guest",
    teamId,
    stats,
    rarityAccent: "normal",
    appearance: TEST_APPEARANCE,
  };
}

/** Create a deterministic two-player match used by stat and energy tests. */
function createTestMatch(): MatchSnapshot {
  const stats = computeCreatureStats(buildLoadout());
  const teams = createDefaultLobbyTeams("p1").teams;

  return createInitialMatchState("UNIT42", 2026, [
    buildParticipant("p1", "team1", stats),
    buildParticipant("p2", "team2", stats),
  ], teams);
}

/** Build an active catalog with one part per Gacha rarity tier. */
function buildGachaCatalog(): Part[] {
  return [
    buildPart({ slot: "arms", id: "arms_normal", rarity: "normal" }),
    buildPart({ slot: "arms", id: "arms_rare", rarity: "rare" }),
    buildPart({ slot: "arms", id: "arms_unique", rarity: "unique", trait: TEST_TRAIT }),
    buildPart({ slot: "legs", id: "legs_inactive", rarity: "normal", isActive: false }),
  ];
}

describe("map generation", () => {
  it("sizes the arena according to the player count", () => {
    expect(getArenaDimensions(2)).toEqual({ width: ARENA_WIDTH, height: ARENA_HEIGHT });
    expect(getArenaDimensions(3)).toEqual({ width: ARENA_WIDTH, height: ARENA_HEIGHT });
    expect(getArenaDimensions(4)).toEqual({ width: ARENA_4P_WIDTH, height: ARENA_HEIGHT });
  });

  it("generates reproducible seeded random values inside [0, 1)", () => {
    const rngA = createSeededRng(42);
    const rngB = createSeededRng(42);
    const rngC = createSeededRng(43);
    const valuesA = Array.from({ length: 8 }, () => rngA());
    const valuesB = Array.from({ length: 8 }, () => rngB());
    const valuesC = Array.from({ length: 8 }, () => rngC());

    expect(valuesA).toEqual(valuesB);
    expect(valuesA).not.toEqual(valuesC);
    expect(valuesA.every((value) => value >= 0 && value < 1)).toBe(true);
  });

  it("builds bounded terrain maps and clamps surface lookups", () => {
    const mapA = generateTerrainHeightMap(ARENA_WIDTH, ARENA_HEIGHT, 2026);
    const mapRepeat = generateTerrainHeightMap(ARENA_WIDTH, ARENA_HEIGHT, 2026);
    const mapB = generateTerrainHeightMap(ARENA_WIDTH, ARENA_HEIGHT, 2027);

    expect(mapA).toHaveLength(ARENA_WIDTH);
    expect(mapA).toEqual(mapRepeat);
    expect(mapA).not.toEqual(mapB);
    expect(mapA.every((y) => Number.isInteger(y))).toBe(true);
    expect(mapA.every((y) => y >= MIN_SURFACE_Y && y <= ARENA_HEIGHT - 110)).toBe(true);

    expect(getSurfaceY([], 500)).toBe(ARENA_HEIGHT);
    expect(getSurfaceY([100, 200, 300], -5)).toBe(100);
    expect(getSurfaceY([100, 200, 300], 999)).toBe(300);
  });

  it("places spawns within margins and minimum distances across seeds", () => {
    for (let seed = 100; seed < 120; seed++) {
      const spawns2P = generateSpawnPositions(ARENA_WIDTH, 2, seed);
      expect(spawns2P).toHaveLength(2);
      expect(Math.abs(spawns2P[0] - spawns2P[1])).toBeGreaterThanOrEqual(
        MIN_SPAWN_DISTANCE_2P
      );

      const spawns4P = generateSpawnPositions(ARENA_4P_WIDTH, 4, seed);
      expect(spawns4P).toHaveLength(4);
      for (let i = 0; i < spawns4P.length; i++) {
        expect(spawns4P[i]).toBeGreaterThanOrEqual(SPAWN_EDGE_MARGIN);
        expect(spawns4P[i]).toBeLessThanOrEqual(ARENA_4P_WIDTH - SPAWN_EDGE_MARGIN);
        for (let j = i + 1; j < spawns4P.length; j++) {
          expect(Math.abs(spawns4P[i] - spawns4P[j])).toBeGreaterThanOrEqual(
            MIN_SPAWN_DISTANCE_4P
          );
        }
      }
    }

    expect(generateSpawnPositions(ARENA_WIDTH, 0, 1)).toEqual([]);
    const customSpawns = generateSpawnPositions(ARENA_WIDTH, 3, 5, 500);
    expect(customSpawns).toHaveLength(3);
    expect(Math.abs(customSpawns[0] - customSpawns[1])).toBeGreaterThanOrEqual(500);
    expect(Math.abs(customSpawns[1] - customSpawns[2])).toBeGreaterThanOrEqual(500);
  });

  it("carves craters immutably without crossing the terrain floor", () => {
    const map = generateTerrainHeightMap(ARENA_WIDTH, ARENA_HEIGHT, 55);
    const surfaceY = getSurfaceY(map, 500);
    const carved = carveTerrainCrater(map, ARENA_HEIGHT, 500, surfaceY, 56);

    expect(carved).not.toBe(map);
    expect(carved).toHaveLength(map.length);
    expect(map).toEqual(generateTerrainHeightMap(ARENA_WIDTH, ARENA_HEIGHT, 55));
    expect(getSurfaceY(carved, 500)).toBeGreaterThan(surfaceY);
    expect(carved.every((y) => y <= ARENA_HEIGHT - TERRAIN_FLOOR_OFFSET)).toBe(true);

    const edgeCarved = carveTerrainCrater(map, ARENA_HEIGHT, 0, surfaceY, 56);
    expect(edgeCarved).toHaveLength(map.length);
  });
});

describe("principal statistics and value limits", () => {
  it("computes base stats and applies the correct per-stat scaling", () => {
    const base = computeCreatureStats(buildLoadout());
    expect(base.maxHp).toBe(100);
    expect(base.attack).toBe(20);
    expect(base.defense).toBe(5);
    expect(base.mobility).toBe(100);
    expect(base.activeTraits).toEqual([]);

    const scaled = computeCreatureStats({
      ...buildLoadout(),
      arms: buildPart({
        slot: "arms",
        id: "arms_scaled",
        modifiers: { hpDelta: 2, atkDelta: 3, defDelta: -1, movDelta: 2 },
      }),
    });
    expect(scaled.maxHp).toBe(base.maxHp + 2 * 5);
    expect(scaled.attack).toBe(base.attack + 3);
    expect(scaled.defense).toBe(base.defense - 1);
    expect(scaled.mobility).toBe(base.mobility + 2 * 5);
  });

  it("clamps HP, ATK, DEF and mobility at their minimum values", () => {
    const worst = buildLoadout(
      { hpDelta: -4, atkDelta: -4, defDelta: -4, movDelta: -4 },
      "unique",
      TEST_TRAIT
    );
    const stats = computeCreatureStats(worst);

    expect(stats.maxHp).toBe(50);
    expect(stats.attack).toBe(5);
    expect(stats.defense).toBe(0);
    expect(stats.mobility).toBe(40);
    expect(stats.activeTraits).toHaveLength(4);
  });

  it("bounds movement energy by mobility and refreshes it on turn change", () => {
    const match = createTestMatch();
    const mobility = match.fighters[0].mobility;

    expect(match.fighters[0].moveEnergyLeft).toBe(mobility);

    const moved = applyPlayerCommand(match, "p1", { type: "move", direction: 1 });
    expect(moved.fighters[0].moveEnergyLeft).toBe(mobility - MOVE_ENERGY_COST);

    let drained = moved;
    for (let step = 0; step < 40 && drained.fighters[0].moveEnergyLeft >= MOVE_ENERGY_COST; step++) {
      drained = applyPlayerCommand(drained, "p1", { type: "move", direction: 1 });
    }
    expect(drained.fighters[0].moveEnergyLeft).toBeLessThan(MOVE_ENERGY_COST);
    expect(applyPlayerCommand(drained, "p1", { type: "move", direction: 1 })).toBe(drained);

    const jumped = applyPlayerCommand(match, "p1", { type: "jump" });
    expect(jumped.fighters[0].moveEnergyLeft).toBe(mobility - JUMP_ENERGY_COST);
    expect(jumped.fighters[0].grounded).toBe(false);
    expect(applyPlayerCommand(jumped, "p1", { type: "jump" })).toBe(jumped);

    const nextTurn = advanceHostTurn(moved);
    expect(nextTurn.activePlayerId).toBe("p2");
    expect(nextTurn.fighters[1].moveEnergyLeft).toBe(mobility);
    expect(nextTurn.fighters[0].moveEnergyLeft).toBe(mobility - MOVE_ENERGY_COST);
  });

  it("keeps damage and remaining HP inside their valid limits", () => {
    expect(calculateDamage(20, 5, 1)).toBe(15);
    expect(calculateDamage(1, 50, 1)).toBe(1);
    expect(calculateDamage(20, 5, 0)).toBe(0);

    const fighter = { ...createTestMatch().fighters[0], hp: 3, defense: 0 };
    const impactY = fighter.y - 24;
    const hit = applyExplosionDamage([fighter], fighter.x, impactY, 56, 100);

    expect(hit.damages[0].damage).toBe(100);
    expect(hit.damages[0].remainingHp).toBe(0);
    expect(hit.updatedFighters[0].hp).toBe(0);
    expect(hit.updatedFighters[0].hp).toBeGreaterThanOrEqual(0);

    const deadFighter = { ...fighter, hp: 0 };
    const ignored = applyExplosionDamage([deadFighter], deadFighter.x, impactY, 56, 100);
    expect(ignored.damages).toHaveLength(0);
    expect(ignored.updatedFighters[0]).toBe(deadFighter);
  });
});

describe("Gacha part results", () => {
  it("maps uniform rolls to the published rarity boundaries", () => {
    const rareStart = RARITY_DROP_RATES.unique;
    const normalStart = rareStart + RARITY_DROP_RATES.rare;

    expect(rollRarity(-1)).toBe("unique");
    expect(rollRarity(0)).toBe("unique");
    expect(rollRarity(rareStart - 0.000001)).toBe("unique");
    expect(rollRarity(rareStart)).toBe("rare");
    expect(rollRarity(normalStart - 0.000001)).toBe("rare");
    expect(rollRarity(normalStart)).toBe("normal");
    expect(rollRarity(0.999999)).toBe("normal");
    expect(rollRarity(2)).toBe("normal");
  });

  it("rolls deterministic active parts and rejects an empty catalog", () => {
    const catalog = buildGachaCatalog();
    const rolls = [0.01, 0, 0.1, 0, 0.9, 0];
    let cursor = 0;
    const pulled = rollPack(catalog, PACK_SIZE, () => rolls[cursor++] ?? 0.5);

    expect(pulled).toHaveLength(PACK_SIZE);
    expect(pulled.map((part) => part.id)).toEqual([
      "arms_unique",
      "arms_rare",
      "arms_normal",
    ]);
    expect(pulled.every((part) => part.isActive)).toBe(true);

    expect(() => rollPack([], PACK_SIZE, () => 0.5)).toThrow();
    expect(() =>
      rollPack(catalog.filter((part) => !part.isActive), PACK_SIZE, () => 0.5)
    ).toThrow();
  });

  it("marks new parts and pays coins only for duplicates", () => {
    const catalog = buildGachaCatalog();
    const uniquePart = catalog[2];
    const rarePart = catalog[1];
    const normalPart = catalog[0];

    const owned = new Set<string>([uniquePart.id]);
    const evaluated = evaluatePackPulls([uniquePart, rarePart, normalPart], owned);

    expect(evaluated.results[0].isNew).toBe(false);
    expect(evaluated.results[0].duplicateCoins).toBe(DUPLICATE_COIN_REWARDS.unique);
    expect(evaluated.results[1].isNew).toBe(true);
    expect(evaluated.results[1].duplicateCoins).toBe(0);
    expect(evaluated.results[2].isNew).toBe(true);
    expect(evaluated.totalDuplicateCoins).toBe(DUPLICATE_COIN_REWARDS.unique);
  });

  it("treats repeated cards inside one pack as duplicates and sums rewards", () => {
    const normalPart = buildGachaCatalog()[0];
    const rarePart = buildGachaCatalog()[1];
    const evaluated = evaluatePackPulls([normalPart, normalPart, rarePart, rarePart], new Set());

    expect(evaluated.results.map((result) => result.isNew)).toEqual([
      true,
      false,
      true,
      false,
    ]);
    expect(evaluated.results[1].duplicateCoins).toBe(DUPLICATE_COIN_REWARDS.normal);
    expect(evaluated.results[3].duplicateCoins).toBe(DUPLICATE_COIN_REWARDS.rare);
    expect(evaluated.totalDuplicateCoins).toBe(
      DUPLICATE_COIN_REWARDS.normal + DUPLICATE_COIN_REWARDS.rare
    );
  });
});
