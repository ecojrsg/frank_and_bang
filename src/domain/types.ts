// @Author: Jonathan Serna
// @Date:   2026-11-23 20:57:00
// @Last Modified by:   Jonathan Serna
// @Last Modified time: 2026-11-23 22:25:00

/**
 * Core domain types for Frank and Bang.
 * Kept framework-free so domain logic remains pure and easy to test.
 */

export type PartSlot = "head" | "torso" | "arms" | "legs";

export type PartRarity = "normal" | "rare" | "unique";

export type TeamId = "team1" | "team2";

export type TeamColorKey =
  | "red"
  | "blue"
  | "green"
  | "amber"
  | "purple"
  | "pink";

export interface TeamConfig {
  id: TeamId;
  name: string;
  colorKey: TeamColorKey;
  hex: string;
}

export type TraitEffectType =
  | "blast_radius_pct"
  | "turn_time_bonus"
  | "splash_resist_pct"
  | "launch_speed_pct";

export interface SpecialTrait {
  id: string;
  name: string;
  description: string;
  effectType: TraitEffectType;
  effectValue: number;
}

export interface StatModifier {
  hpDelta: number;
  atkDelta: number;
  defDelta: number;
  movDelta: number;
}

export interface Part {
  id: string;
  name: string;
  slot: PartSlot;
  rarity: PartRarity;
  assetPath: string | null;
  cardAssetPath: string | null;
  assetUrl: string | null;
  cardAssetUrl: string | null;
  description: string;
  modifiers: StatModifier;
  trait: SpecialTrait | null;
  isStarter: boolean;
  isActive: boolean;
}

export interface Loadout {
  head: Part;
  torso: Part;
  arms: Part;
  legs: Part;
}

export interface CreatureAppearance {
  headId: string;
  torsoId: string;
  armsId: string;
  legsId: string;
  headRarity: PartRarity;
  torsoRarity: PartRarity;
  armsRarity: PartRarity;
  legsRarity: PartRarity;
}

export interface CreatureStats {
  maxHp: number;
  attack: number;
  defense: number;
  mobility: number;
  activeTraits: SpecialTrait[];
}

export interface InventoryEntry {
  partId: string;
  quantity: number;
}

export interface GachaPullResult {
  part: Part;
  isNew: boolean;
  duplicateCoins: number;
}

export interface FighterState {
  playerId: string;
  displayName: string;
  role: "host" | "guest";
  teamId: TeamId;
  teamColor: string;
  teamName: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  grounded: boolean;
  facing: 1 | -1;
  aimAngleDeg: number;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  mobility: number;
  moveEnergyLeft: number;
  activeTraits: SpecialTrait[];
  rarityAccent: PartRarity;
  appearance: CreatureAppearance;
}

export interface GrenadeProjectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  blastRadius: number;
  ownerPlayerId: string;
  attackerAtk: number;
}

export interface DamageEvent {
  targetPlayerId: string;
  damage: number;
  remainingHp: number;
  directHit: boolean;
}

export interface ExplosionEvent {
  explosionId: number;
  x: number;
  y: number;
  radius: number;
  damages: DamageEvent[];
}

export type MatchPhase = "waiting" | "aiming" | "projectile" | "finished";

export interface MatchSnapshot {
  roomCode: string;
  phase: MatchPhase;
  turnNumber: number;
  activePlayerId: string;
  turnSecondsLeft: number;
  terrainWidth: number;
  terrainHeight: number;
  heightMap: number[];
  teams: Record<TeamId, TeamConfig>;
  fighters: FighterState[];
  projectile: GrenadeProjectile | null;
  lastExplosion: ExplosionEvent | null;
  winnerPlayerId: string | null;
  winnerTeamId: TeamId | null;
}

export type PlayerCommand =
  | { type: "move"; direction: -1 | 1 }
  | { type: "jump" }
  | { type: "aim"; angleDeg: number }
  | { type: "fire"; powerRatio: number };
