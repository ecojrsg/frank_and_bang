// @Author: Jonathan Serna
// @Date:   2026-11-23 20:59:45
// @Last Modified by:   Jonathan Serna
// @Last Modified time: 2026-11-23 20:59:45

/**
 * Unit tests for Frank and Bang pure domain modules:
 * parts_catalog mapping, stats calculator, Gacha engine, combat damage,
 * destructible terrain, parabolic physics, and host match state machine.
 */

import { describe, expect, it } from "vitest";

import {
  applyExplosionDamage,
  BASE_GRENADE_BLAST_RADIUS,
  calculateDamage,
  computeBlastRadius,
  determineWinner,
} from "@/domain/combatEngine";
import {
  DUPLICATE_COIN_REWARDS,
  evaluatePackPulls,
  rollPack,
  rollRarity,
} from "@/domain/gachaEngine";
import {
  advanceHostTurn,
  applyPlayerCommand,
  createInitialMatchState,
  stepHostSimulation,
} from "@/domain/gameRoomHost";
import {
  buildStoragePublicUrl,
  mapCatalogRowToPart,
} from "@/domain/partMapper";
import {
  createGrenadeProjectile,
  stepGrenadeProjectile,
} from "@/domain/physicsEngine";
import {
  BASE_STATS,
  computeCreatureStats,
  getHighestLoadoutRarity,
} from "@/domain/statsCalculator";
import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  carveTerrainCrater,
  generateTerrainHeightMap,
  getSurfaceY,
} from "@/domain/terrainEngine";
import type { Loadout, Part } from "@/domain/types";

const TEST_SUPABASE_URL = "https://tgsoflrcoezgmoopnzdi.supabase.co";

/**
 * Build a sample catalog mirroring rows stored in public.parts_catalog.
 */
function buildSampleCatalog(): Part[] {
  const rows = [
    {
      id: "head_stitch_skull",
      name: "Craneo Cosido",
      slot: "head",
      rarity: "normal",
      asset_path: null,
      card_asset_path: null,
      description: "Craneo base.",
      hp_delta: 1,
      atk_delta: 0,
      def_delta: 1,
      mov_delta: 0,
      trait: null,
      is_starter: true,
      is_active: true,
    },
    {
      id: "torso_canvas_ribcage",
      name: "Caja Toracica",
      slot: "torso",
      rarity: "normal",
      asset_path: null,
      card_asset_path: null,
      description: "Torso base.",
      hp_delta: 1,
      atk_delta: 0,
      def_delta: 1,
      mov_delta: 0,
      trait: null,
      is_starter: true,
      is_active: true,
    },
    {
      id: "arms_copper_hook",
      name: "Gancho de Cobre",
      slot: "arms",
      rarity: "normal",
      asset_path: "parts/arms/arms_copper_hook.svg",
      card_asset_path: null,
      description: "Brazos base.",
      hp_delta: 0,
      atk_delta: 1,
      def_delta: 0,
      mov_delta: 1,
      trait: null,
      is_starter: true,
      is_active: true,
    },
    {
      id: "legs_peg_struts",
      name: "Puntal Basico",
      slot: "legs",
      rarity: "normal",
      asset_path: "parts/legs/legs_peg_struts.svg",
      card_asset_path: null,
      description: "Piernas base.",
      hp_delta: 1,
      atk_delta: 0,
      def_delta: 0,
      mov_delta: 1,
      trait: null,
      is_starter: true,
      is_active: true,
    },
    {
      id: "arms_pneumatic_piston",
      name: "Piston Neumatico",
      slot: "arms",
      rarity: "rare",
      asset_path: "parts/arms/arms_pneumatic_piston.svg",
      card_asset_path: "cards/custom/piston_card.png",
      description: "Brazos raros.",
      hp_delta: 0,
      atk_delta: 3,
      def_delta: -1,
      mov_delta: 1,
      trait: null,
      is_starter: false,
      is_active: true,
    },
    {
      id: "arms_tesla_catapult",
      name: "Catapulta Tesla",
      slot: "arms",
      rarity: "unique",
      asset_path: "parts/arms/arms_tesla_catapult.svg",
      card_asset_path: null,
      description: "Brazos unicos.",
      hp_delta: -1,
      atk_delta: 4,
      def_delta: 0,
      mov_delta: 1,
      trait: {
        id: "overcharged_blast",
        name: "Detonacion Amplificada",
        description: "+15% radio de explosion.",
        effectType: "blast_radius_pct",
        effectValue: 15,
      },
      is_starter: false,
      is_active: true,
    },
  ];

  return rows.map((row) => mapCatalogRowToPart(row, TEST_SUPABASE_URL));
}

describe("partMapper & Supabase parts-assets URLs", () => {
  it("resolves storage URLs and inherits assetUrl for cards when card_asset_path is null", () => {
    const catalog = buildSampleCatalog();
    const copperHook = catalog.find((p) => p.id === "arms_copper_hook")!;
    const pneumatic = catalog.find((p) => p.id === "arms_pneumatic_piston")!;

    expect(copperHook.assetUrl).toBe(
      `${TEST_SUPABASE_URL}/storage/v1/object/public/parts-assets/parts/arms/arms_copper_hook.svg`
    );
    expect(copperHook.cardAssetUrl).toBe(copperHook.assetUrl);
    expect(pneumatic.cardAssetUrl).toBe(
      `${TEST_SUPABASE_URL}/storage/v1/object/public/parts-assets/cards/custom/piston_card.png`
    );
    expect(buildStoragePublicUrl(TEST_SUPABASE_URL, null)).toBeNull();
  });

  it("rejects rows whose deltas violate rarity bounds or lack unique traits", () => {
    expect(() =>
      mapCatalogRowToPart(
        {
          id: "broken_normal",
          name: "Rota",
          slot: "arms",
          rarity: "normal",
          asset_path: null,
          card_asset_path: null,
          description: "Excede limite normal.",
          hp_delta: 0,
          atk_delta: 4,
          def_delta: 0,
          mov_delta: 0,
          trait: null,
          is_starter: false,
          is_active: true,
        },
        TEST_SUPABASE_URL
      )
    ).toThrow();

    expect(() =>
      mapCatalogRowToPart(
        {
          id: "broken_unique",
          name: "Sin rasgo",
          slot: "head",
          rarity: "unique",
          asset_path: null,
          card_asset_path: null,
          description: "Falta trait.",
          hp_delta: 3,
          atk_delta: 0,
          def_delta: 0,
          mov_delta: 0,
          trait: null,
          is_starter: false,
          is_active: true,
        },
        TEST_SUPABASE_URL
      )
    ).toThrow();
  });
});

describe("statsCalculator", () => {
  it("computes scaled HP/MOV, direct ATK/DEF and active unique traits", () => {
    const catalog = buildSampleCatalog();
    const loadout: Loadout = {
      head: catalog[0],
      torso: catalog[1],
      arms: catalog[5],
      legs: catalog[3],
    };

    const stats = computeCreatureStats(loadout);
    expect(stats.maxHp).toBe(BASE_STATS.hp + (1 + 1 - 1 + 1) * 5);
    expect(stats.attack).toBe(BASE_STATS.attack + 4);
    expect(stats.defense).toBe(BASE_STATS.defense + 2);
    expect(stats.mobility).toBe(BASE_STATS.mobility + (1 + 1) * 5);
    expect(stats.activeTraits).toHaveLength(1);
    expect(getHighestLoadoutRarity(loadout)).toBe("unique");
  });
});

describe("combatEngine", () => {
  it("applies exact ATK - DEF mitigation with minimum 1 damage", () => {
    expect(calculateDamage(20, 5, 1)).toBe(15);
    expect(calculateDamage(10, 25, 1)).toBe(1);
    expect(calculateDamage(20, 5, 0)).toBe(0);
  });

  it("applies blast radius bonus and splash resistance traits", () => {
    const catalog = buildSampleCatalog();
    const uniqueTrait = catalog[5].trait!;
    expect(computeBlastRadius([uniqueTrait])).toBe(
      Math.round(BASE_GRENADE_BLAST_RADIUS * 1.15)
    );

    const { updatedFighters, damages } = applyExplosionDamage(
      [
        {
          playerId: "p1",
          displayName: "Frank",
          role: "host",
          x: 200,
          y: 300,
          facing: 1,
          aimAngleDeg: 45,
          hp: 100,
          maxHp: 100,
          attack: 20,
          defense: 5,
          mobility: 100,
          moveEnergyLeft: 100,
          activeTraits: [],
          rarityAccent: "normal",
        },
      ],
      200,
      284,
      44,
      20
    );

    expect(damages).toHaveLength(1);
    expect(damages[0].damage).toBe(15);
    expect(updatedFighters[0].hp).toBe(85);
    expect(determineWinner(updatedFighters)).toBe("p1");
  });
});

describe("gachaEngine", () => {
  it("maps uniform rolls to unique (6%), rare (24%) and normal (70%)", () => {
    expect(rollRarity(0.01)).toBe("unique");
    expect(rollRarity(0.15)).toBe("rare");
    expect(rollRarity(0.85)).toBe("normal");
  });

  it("rolls deterministic 3-card packs and rewards duplicate FrankenCoins", () => {
    const catalog = buildSampleCatalog();
    const rolls = [0.02, 0.0, 0.1, 0.0, 0.9, 0.0];
    let cursor = 0;
    const pulled = rollPack(catalog, 3, () => rolls[cursor++] ?? 0.5);

    expect(pulled).toHaveLength(3);
    expect(pulled[0].rarity).toBe("unique");
    expect(pulled[1].rarity).toBe("rare");
    expect(pulled[2].rarity).toBe("normal");

    const owned = new Set<string>([pulled[0].id]);
    const evaluated = evaluatePackPulls(pulled, owned);

    expect(evaluated.results[0].isNew).toBe(false);
    expect(evaluated.results[0].duplicateCoins).toBe(DUPLICATE_COIN_REWARDS.unique);
    expect(evaluated.results[1].isNew).toBe(true);
    expect(evaluated.totalDuplicateCoins).toBe(DUPLICATE_COIN_REWARDS.unique);
  });
});

describe("terrainEngine, physicsEngine & gameRoomHost", () => {
  it("generates deterministic heightmaps and carves blast craters", () => {
    const mapA = generateTerrainHeightMap(ARENA_WIDTH, ARENA_HEIGHT, 42);
    const mapB = generateTerrainHeightMap(ARENA_WIDTH, ARENA_HEIGHT, 42);
    expect(mapA).toEqual(mapB);

    const beforeY = getSurfaceY(mapA, 400);
    const carved = carveTerrainCrater(mapA, ARENA_HEIGHT, 400, beforeY, 40);
    expect(getSurfaceY(carved, 400)).toBeGreaterThan(beforeY);
  });

  it("advances grenade parabola under gravity and runs a full host turn", () => {
    const catalog = buildSampleCatalog();
    const loadout: Loadout = {
      head: catalog[0],
      torso: catalog[1],
      arms: catalog[2],
      legs: catalog[3],
    };
    const stats = computeCreatureStats(loadout);
    const initial = createInitialMatchState(
      "FRNK42",
      77,
      {
        playerId: "host-1",
        displayName: "Victor",
        role: "host",
        stats,
        rarityAccent: "normal",
      },
      {
        playerId: "guest-1",
        displayName: "Igor",
        role: "guest",
        stats,
        rarityAccent: "normal",
      }
    );

    const moved = applyPlayerCommand(initial, "host-1", {
      type: "move",
      direction: 1,
    });
    expect(moved.fighters[0].x).toBeGreaterThan(initial.fighters[0].x);
    expect(moved.fighters[0].moveEnergyLeft).toBeLessThan(initial.fighters[0].moveEnergyLeft);

    const projectile = createGrenadeProjectile(moved.fighters[0], 0.7);
    const stepped = stepGrenadeProjectile(projectile, 0.1);
    expect(stepped.x).toBeGreaterThan(projectile.x);
    expect(stepped.vy).toBeGreaterThan(projectile.vy);

    const fired = applyPlayerCommand(moved, "host-1", {
      type: "fire",
      powerRatio: 0.65,
    });
    expect(fired.phase).toBe("projectile");

    let state = fired;
    for (let tick = 0; tick < 300 && state.phase === "projectile"; tick++) {
      state = stepHostSimulation(state, 1 / 60);
    }

    expect(state.phase).not.toBe("projectile");
    const nextTurn = advanceHostTurn(initial);
    expect(nextTurn.activePlayerId).toBe("guest-1");
  });
});
