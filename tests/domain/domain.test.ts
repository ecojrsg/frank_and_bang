// @Author: Jonathan Serna
// @Date:   2026-11-23 20:59:45
// @Last Modified by:   Jonathan Serna
// @Last Modified time: 2026-11-23 22:42:00

/**
 * Unit tests for Frank and Bang pure domain modules:
 * parts_catalog mapping, stats calculator, Gacha engine, combat damage,
 * destructible terrain, parabolic physics, team lobby, jumping, and Camera2D.
 */

import { describe, expect, it } from "vitest";

import {
  applyCameraZoomDelta,
  computeMinZoomFactor,
  computeResponsiveZoom,
  createInitialCamera,
  focusCameraOnPoint,
  getEffectiveViewport,
  MAX_USER_ZOOM_FACTOR,
  MAX_VISIBLE_WORLD_H,
  MAX_VISIBLE_WORLD_W,
  panCameraManual,
  recenterCamera,
  stepCamera,
} from "@/domain/cameraEngine";
import {
  applyExplosionDamage,
  BASE_GRENADE_BLAST_RADIUS,
  calculateDamage,
  computeBlastRadius,
  determineWinner,
  determineWinningTeam,
} from "@/domain/combatEngine";
import {
  assignPlayerToTeam,
  createDefaultLobbyTeams,
  setTeamColor,
  setTeamName,
  syncLobbyAssignments,
  validateMatchStart,
} from "@/domain/teamLobby";
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
  ARENA_4P_WIDTH,
  ARENA_HEIGHT,
  ARENA_WIDTH,
  carveTerrainCrater,
  generateSpawnPositions,
  generateTerrainHeightMap,
  getArenaDimensions,
  getSurfaceY,
  MIN_SPAWN_DISTANCE_2P,
  MIN_SPAWN_DISTANCE_4P,
} from "@/domain/terrainEngine";
import type { CreatureAppearance, Loadout, Part } from "@/domain/types";

const TEST_TEAMS = createDefaultLobbyTeams("host-1").teams;

const TEST_APPEARANCE: CreatureAppearance = {
  headId: "head_stitch_skull",
  torsoId: "torso_canvas_ribcage",
  armsId: "arms_copper_hook",
  legsId: "legs_peg_struts",
  headRarity: "normal",
  torsoRarity: "normal",
  armsRarity: "normal",
  legsRarity: "normal",
};

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
          teamId: "team1",
          teamColor: "#34d399",
          teamName: "Equipo 1",
          x: 200,
          y: 300,
          vx: 0,
          vy: 0,
          grounded: true,
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
          appearance: TEST_APPEARANCE,
        },
      ],
      200,
      276,
      56,
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

describe("terrainEngine, physicsEngine, gameRoomHost & cameraEngine", () => {
  it("scales arena dimensions by player count and varies heights across seeds", () => {
    expect(getArenaDimensions(2)).toEqual({ width: 2600, height: 1050 });
    expect(getArenaDimensions(4)).toEqual({ width: 4200, height: 1050 });

    const mapA = generateTerrainHeightMap(ARENA_WIDTH, ARENA_HEIGHT, 42);
    const mapB = generateTerrainHeightMap(ARENA_WIDTH, ARENA_HEIGHT, 42);
    const mapC = generateTerrainHeightMap(ARENA_WIDTH, ARENA_HEIGHT, 9001);
    expect(ARENA_WIDTH).toBe(2600);
    expect(ARENA_4P_WIDTH).toBe(4200);
    expect(ARENA_HEIGHT).toBe(1050);
    expect(mapA).toEqual(mapB);
    expect(mapA).not.toEqual(mapC);

    const beforeY = getSurfaceY(mapA, 400);
    const carved = carveTerrainCrater(mapA, ARENA_HEIGHT, 400, beforeY, 56);
    expect(getSurfaceY(carved, 400)).toBeGreaterThan(beforeY);
  });

  it("enforces minimum pairwise spawn distance across 20 random seeds for 2P and 4P", () => {
    for (let seed = 10; seed < 30; seed++) {
      const spawns2P = generateSpawnPositions(ARENA_WIDTH, 2, seed);
      expect(spawns2P).toHaveLength(2);
      expect(Math.abs(spawns2P[0] - spawns2P[1])).toBeGreaterThanOrEqual(
        MIN_SPAWN_DISTANCE_2P
      );

      const spawns4P = generateSpawnPositions(ARENA_4P_WIDTH, 4, seed);
      expect(spawns4P).toHaveLength(4);
      for (let i = 0; i < spawns4P.length; i++) {
        expect(spawns4P[i]).toBeGreaterThanOrEqual(180);
        expect(spawns4P[i]).toBeLessThanOrEqual(ARENA_4P_WIDTH - 180);
        for (let j = i + 1; j < spawns4P.length; j++) {
          expect(Math.abs(spawns4P[i] - spawns4P[j])).toBeGreaterThanOrEqual(
            MIN_SPAWN_DISTANCE_4P
          );
        }
      }
    }
  });

  it("computes responsive zoom so 2K ultrawide and 4K screens frame only the active area", () => {
    const screens = [
      [3440, 1440],
      [2560, 1080],
      [2560, 1440],
      [1920, 1080],
      [1280, 720],
    ];

    for (const [w, h] of screens) {
      const zoom = computeResponsiveZoom(w, h);
      const viewport = getEffectiveViewport(w, h);
      expect(zoom).toBeGreaterThanOrEqual(1);
      expect(viewport.viewW).toBeLessThanOrEqual(MAX_VISIBLE_WORLD_W + 0.01);
      expect(viewport.viewH).toBeLessThanOrEqual(MAX_VISIBLE_WORLD_H + 0.01);
      expect(viewport.viewW).toBeLessThan(ARENA_WIDTH);
      expect(viewport.viewH).toBeLessThan(ARENA_HEIGHT);
    }
  });

  it("advances grenade parabola under gravity and runs a full host turn with appearance", () => {
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
      [
        {
          playerId: "host-1",
          displayName: "Victor",
          role: "host",
          teamId: "team1",
          stats,
          rarityAccent: "normal",
          appearance: TEST_APPEARANCE,
        },
        {
          playerId: "guest-1",
          displayName: "Igor",
          role: "guest",
          teamId: "team2",
          stats,
          rarityAccent: "normal",
          appearance: TEST_APPEARANCE,
        },
      ],
      TEST_TEAMS
    );

    expect(initial.fighters[0].appearance.headId).toBe("head_stitch_skull");
    expect(
      Math.abs(initial.fighters[1].x - initial.fighters[0].x)
    ).toBeGreaterThanOrEqual(MIN_SPAWN_DISTANCE_2P);

    const moveDir = initial.fighters[0].facing;
    const moved = applyPlayerCommand(initial, "host-1", {
      type: "move",
      direction: moveDir,
    });
    expect(moved.fighters[0].x).not.toBe(initial.fighters[0].x);
    expect(moved.fighters[0].moveEnergyLeft).toBeLessThan(initial.fighters[0].moveEnergyLeft);

    const projectile = createGrenadeProjectile(moved.fighters[0], 0.7);
    const stepped = stepGrenadeProjectile(projectile, 0.1);
    expect((stepped.x - projectile.x) * moveDir).toBeGreaterThan(0);
    expect(stepped.vy).toBeGreaterThan(projectile.vy);

    const fired = applyPlayerCommand(moved, "host-1", {
      type: "fire",
      powerRatio: 0.45,
    });
    expect(fired.phase).toBe("projectile");

    let state = fired;
    for (let tick = 0; tick < 360 && state.phase === "projectile"; tick++) {
      state = stepHostSimulation(state, 1 / 60);
    }

    expect(state.phase).not.toBe("projectile");
    expect(state.lastExplosion?.explosionId).toBe(1);
    const nextTurn = advanceHostTurn(initial);
    expect(nextTurn.activePlayerId).toBe("guest-1");
  });

  it("tracks attacker, projectile, impact_hold shake, and manual scouting within bounds", () => {
    const catalog = buildSampleCatalog();
    const stats = computeCreatureStats({
      head: catalog[0],
      torso: catalog[1],
      arms: catalog[2],
      legs: catalog[3],
    });
    const match = createInitialMatchState(
      "FRNK42",
      12,
      [
        {
          playerId: "host-1",
          displayName: "Victor",
          role: "host",
          teamId: "team1",
          stats,
          rarityAccent: "normal",
          appearance: TEST_APPEARANCE,
        },
        {
          playerId: "guest-1",
          displayName: "Igor",
          role: "guest",
          teamId: "team2",
          stats,
          rarityAccent: "normal",
          appearance: TEST_APPEARANCE,
        },
      ],
      TEST_TEAMS
    );

    const viewportW = 1000;
    const viewportH = 600;
    let cam = createInitialCamera(
      match.fighters[0].x,
      match.fighters[0].y,
      viewportW,
      viewportH,
      match.terrainWidth,
      match.terrainHeight
    );
    expect(cam.mode).toBe("follow_attacker");

    // Manual drag & minimap focus enter manual_scout clamped to world edges.
    cam = panCameraManual(cam, 5000, 5000, viewportW, viewportH, ARENA_WIDTH, ARENA_HEIGHT);
    expect(cam.mode).toBe("manual_scout");
    expect(cam.x).toBe(ARENA_WIDTH - viewportW);
    expect(cam.y).toBe(ARENA_HEIGHT - viewportH);

    cam = focusCameraOnPoint(cam, 1800, 500, viewportW, viewportH, ARENA_WIDTH, ARENA_HEIGHT);
    expect(cam.mode).toBe("manual_scout");
    cam = recenterCamera(cam);
    expect(cam.mode).toBe("follow_attacker");

    // Firing forces camera to follow the projectile.
    const fired = applyPlayerCommand(match, "host-1", { type: "fire", powerRatio: 0.7 });
    cam = stepCamera(cam, fired, 0.05, viewportW, viewportH);
    expect(cam.mode).toBe("follow_projectile");

    // New explosion triggers impact_hold and screen-shake decay.
    const exploded = {
      ...match,
      lastExplosion: {
        explosionId: 1,
        x: 900,
        y: 540,
        radius: 56,
        damages: [],
      },
    };
    cam = stepCamera(cam, exploded, 0.05, viewportW, viewportH);
    expect(cam.mode).toBe("impact_hold");
    expect(cam.shakeIntensity).toBeGreaterThan(0);

    // After hold completes, camera returns to follow_attacker.
    cam = stepCamera(cam, exploded, 0.1, viewportW, viewportH);
    cam = { ...cam, holdSecondsLeft: 0.01 };
    cam = stepCamera(cam, exploded, 0.05, viewportW, viewportH);
    expect(cam.mode).toBe("follow_attacker");
  });

  it("bounds mouse-wheel zoom out inside world dimensions and resets smoothly on turn change", () => {
    const catalog = buildSampleCatalog();
    const stats = computeCreatureStats({
      head: catalog[0],
      torso: catalog[1],
      arms: catalog[2],
      legs: catalog[3],
    });
    const match = createInitialMatchState(
      "ZOOM2K",
      55,
      [
        {
          playerId: "host-1",
          displayName: "Victor",
          role: "host",
          teamId: "team1",
          stats,
          rarityAccent: "normal",
          appearance: TEST_APPEARANCE,
        },
        {
          playerId: "guest-1",
          displayName: "Igor",
          role: "guest",
          teamId: "team2",
          stats,
          rarityAccent: "normal",
          appearance: TEST_APPEARANCE,
        },
      ],
      TEST_TEAMS
    );

    const ultrawideW = 3440;
    const ultrawideH = 1440;
    const baseVp = getEffectiveViewport(
      ultrawideW,
      ultrawideH,
      1,
      match.terrainWidth,
      match.terrainHeight
    );
    let cam = createInitialCamera(
      match.fighters[0].x,
      match.fighters[0].y,
      baseVp.viewW,
      baseVp.viewH,
      match.terrainWidth,
      match.terrainHeight,
      match.turnNumber
    );

    const minFactor = computeMinZoomFactor(
      ultrawideW,
      ultrawideH,
      match.terrainWidth,
      match.terrainHeight
    );

    // Zooming out repeatedly with wheel down clamps cleanly to minFactor.
    for (let i = 0; i < 20; i++) {
      cam = applyCameraZoomDelta(
        cam,
        120,
        ultrawideW,
        ultrawideH,
        match.terrainWidth,
        match.terrainHeight
      );
    }
    expect(cam.targetZoomFactor).toBeGreaterThanOrEqual(minFactor);
    expect(cam.targetZoomFactor).toBeLessThan(1);

    const zoomedOutVp = getEffectiveViewport(
      ultrawideW,
      ultrawideH,
      cam.targetZoomFactor,
      match.terrainWidth,
      match.terrainHeight
    );
    expect(zoomedOutVp.viewW).toBeLessThanOrEqual(match.terrainWidth + 0.01);
    expect(zoomedOutVp.viewH).toBeLessThanOrEqual(match.terrainHeight + 0.01);

    // Step camera eases zoomFactor toward targetZoomFactor and respects world bounds.
    cam = stepCamera(cam, match, 0.2, ultrawideW, ultrawideH);
    expect(cam.zoomFactor).toBeLessThan(1);
    expect(cam.x).toBeGreaterThanOrEqual(0);
    expect(cam.y).toBeGreaterThanOrEqual(0);

    // Zooming in caps at MAX_USER_ZOOM_FACTOR.
    for (let i = 0; i < 25; i++) {
      cam = applyCameraZoomDelta(
        cam,
        -120,
        ultrawideW,
        ultrawideH,
        match.terrainWidth,
        match.terrainHeight
      );
    }
    expect(cam.targetZoomFactor).toBe(MAX_USER_ZOOM_FACTOR);

    // Advancing turn gently restores default 1.0 zoom.
    const nextTurnMatch = advanceHostTurn(match);
    cam = stepCamera(cam, nextTurnMatch, 0.05, ultrawideW, ultrawideH);
    expect(cam.targetZoomFactor).toBe(1);

    // Recenter with resetZoom=true restores targetZoomFactor=1.
    cam = applyCameraZoomDelta(
      cam,
      120,
      ultrawideW,
      ultrawideH,
      match.terrainWidth,
      match.terrainHeight
    );
    cam = recenterCamera(cam, true);
    expect(cam.targetZoomFactor).toBe(1);
  });
});

describe("teamLobby, jumping physics & 4-player 2v2 turns", () => {
  it("enforces exclusive team colors, custom names, and 2/3/4 player start rules", () => {
    let lobby = createDefaultLobbyTeams("p1");
    expect(validateMatchStart(lobby, ["p1"]).canStart).toBe(false);

    // 2 players -> 1v1 allowed.
    lobby = syncLobbyAssignments(lobby, ["p1", "p2"]);
    expect(validateMatchStart(lobby, ["p1", "p2"]).canStart).toBe(true);

    // 3 players -> blocked waiting for 4th.
    lobby = syncLobbyAssignments(lobby, ["p1", "p2", "p3"]);
    const threeCheck = validateMatchStart(lobby, ["p1", "p2", "p3"]);
    expect(threeCheck.canStart).toBe(false);
    expect(threeCheck.reason).toContain("4.º jugador");

    // 4 players -> 2v2 allowed.
    lobby = syncLobbyAssignments(lobby, ["p1", "p2", "p3", "p4"]);
    expect(validateMatchStart(lobby, ["p1", "p2", "p3", "p4"]).canStart).toBe(true);

    // Exclusive color lock: team2 cannot pick team1's green color.
    lobby = setTeamColor(lobby, "team1", "red");
    expect(lobby.teams.team1.colorKey).toBe("red");
    const blockedColor = setTeamColor(lobby, "team2", "red");
    expect(blockedColor.teams.team2.colorKey).toBe("blue");

    // Rename & team cap (max 2).
    lobby = setTeamName(lobby, "team1", "Los Voltios");
    expect(lobby.teams.team1.name).toBe("Los Voltios");
    const capped = assignPlayerToTeam(lobby, "p2", "team1", ["p1", "p2", "p3", "p4"]);
    expect(capped.assignments.p2).toBe("team2");
  });

  it("jumps forward under gravity, blocks double-jump, and alternates 2v2 turns", () => {
    const catalog = buildSampleCatalog();
    const stats = computeCreatureStats({
      head: catalog[0],
      torso: catalog[1],
      arms: catalog[2],
      legs: catalog[3],
    });
    const lobby = syncLobbyAssignments(createDefaultLobbyTeams("p1"), [
      "p1",
      "p2",
      "p3",
      "p4",
    ]);

    const match = createInitialMatchState(
      "TEAM22",
      99,
      [
        {
          playerId: "p1",
          displayName: "A",
          role: "host",
          teamId: "team1",
          stats,
          rarityAccent: "normal",
          appearance: TEST_APPEARANCE,
        },
        {
          playerId: "p2",
          displayName: "B",
          role: "guest",
          teamId: "team2",
          stats,
          rarityAccent: "normal",
          appearance: TEST_APPEARANCE,
        },
        {
          playerId: "p3",
          displayName: "C",
          role: "guest",
          teamId: "team1",
          stats,
          rarityAccent: "normal",
          appearance: TEST_APPEARANCE,
        },
        {
          playerId: "p4",
          displayName: "D",
          role: "guest",
          teamId: "team2",
          stats,
          rarityAccent: "normal",
          appearance: TEST_APPEARANCE,
        },
      ],
      lobby.teams
    );

    expect(match.terrainWidth).toBe(ARENA_4P_WIDTH);
    expect(match.terrainHeight).toBe(ARENA_HEIGHT);

    // Turn order interleaves team1 & team2: p1 -> p2 -> p3 -> p4.
    expect(match.fighters.map((f) => f.playerId)).toEqual(["p1", "p2", "p3", "p4"]);
    const t2 = advanceHostTurn(match);
    expect(t2.activePlayerId).toBe("p2");
    const t3 = advanceHostTurn(t2);
    expect(t3.activePlayerId).toBe("p3");

    // Jump launches upward/forward and blocks double-jump while airborne.
    const jumped = applyPlayerCommand(match, "p1", { type: "jump" });
    expect(jumped.fighters[0].grounded).toBe(false);
    expect(jumped.fighters[0].vy).toBeLessThan(0);
    const doubleJump = applyPlayerCommand(jumped, "p1", { type: "jump" });
    expect(doubleJump.fighters[0].vy).toBe(jumped.fighters[0].vy);

    const startX = match.fighters[0].x;
    const facing = match.fighters[0].facing;
    let sim = jumped;
    for (let i = 0; i < 120 && !sim.fighters[0].grounded; i++) {
      sim = stepHostSimulation(sim, 1 / 30);
    }
    expect(sim.fighters[0].grounded).toBe(true);
    expect((sim.fighters[0].x - startX) * facing).toBeGreaterThan(0);

    // Winning team resolves once opposing team members are all at 0 HP.
    const koTeam2 = sim.fighters.map((f) =>
      f.teamId === "team2" ? { ...f, hp: 0 } : f
    );
    expect(determineWinningTeam(koTeam2)).toBe("team1");
  });
});
