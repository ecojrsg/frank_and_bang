// @Author: Jonathan Serna
// @Date:   2026-11-23 21:00:30
// @Last Modified by:   Jonathan Serna
// @Last Modified time: 2026-11-23 21:00:30

/**
 * Supabase repository for public.parts_catalog, player profiles, inventory,
 * loadouts, and Storage asset URL resolution from the parts-assets bucket.
 */

import type { SupabaseClient, User } from "@supabase/supabase-js";

import { mapCatalogRowToPart } from "@/domain/partMapper";
import { computeCreatureStats, getHighestLoadoutRarity } from "@/domain/statsCalculator";
import type {
  CreatureStats,
  InventoryEntry,
  Loadout,
  Part,
  PartRarity,
  PartSlot,
} from "@/domain/types";

import { getCardBackPublicUrl, getSupabasePublicEnv } from "./config";

export interface PlayerProfile {
  id: string;
  displayName: string;
  coins: number;
  freePacks: number;
}

export interface PlayerFullState {
  profile: PlayerProfile;
  catalog: Part[];
  inventory: InventoryEntry[];
  loadout: Loadout;
  stats: CreatureStats;
  highestRarity: PartRarity;
  cardBackUrl: string | null;
}

/**
 * Fetch all active parts from public.parts_catalog and hydrate Storage URLs.
 */
export async function fetchActiveParts(supabase: SupabaseClient): Promise<Part[]> {
  const { url } = getSupabasePublicEnv();
  const { data, error } = await supabase
    .from("parts_catalog")
    .select(
      "id, name, slot, rarity, asset_path, card_asset_path, description, hp_delta, atk_delta, def_delta, mov_delta, trait, is_starter, is_active"
    )
    .eq("is_active", true)
    .order("slot", { ascending: true })
    .order("rarity", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch parts_catalog: ${error.message}`);
  }

  return (data ?? []).map((row: unknown) => mapCatalogRowToPart(row, url));
}

/**
 * Extract one starter part per anatomical slot from an active catalog.
 */
function resolveStarterPartsBySlot(catalog: Part[]): Record<PartSlot, Part> {
  const findStarter = (slot: PartSlot): Part => {
    const starter =
      catalog.find((p) => p.slot === slot && p.isStarter) ??
      catalog.find((p) => p.slot === slot);
    if (!starter) {
      throw new Error(`No active part found in parts_catalog for slot "${slot}".`);
    }
    return starter;
  };

  return {
    head: findStarter("head"),
    torso: findStarter("torso"),
    arms: findStarter("arms"),
    legs: findStarter("legs"),
  };
}

/**
 * Derive a clean player display name from Supabase auth metadata or email.
 */
function deriveDisplayName(user: User): string {
  const metaName =
    typeof user.user_metadata?.display_name === "string"
      ? user.user_metadata.display_name.trim()
      : "";

  if (metaName.length >= 2) {
    return metaName.slice(0, 24);
  }

  const emailPrefix = (user.email ?? "Frank").split("@")[0].trim();
  return emailPrefix.length >= 2 ? emailPrefix.slice(0, 24) : "Jugador";
}

/**
 * Ensure a newly registered user has a profile, starter inventory, and loadout.
 */
export async function ensurePlayerBootstrap(
  supabase: SupabaseClient,
  user: User,
  catalog: Part[]
): Promise<PlayerProfile> {
  const { data: existingProfile, error: profileError } = await supabase
    .from("profiles")
    .select("id, display_name, coins, free_packs")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    throw new Error(`Failed to read player profile: ${profileError.message}`);
  }

  let profileRow = existingProfile;
  if (!profileRow) {
    const { data: created, error: createError } = await supabase
      .from("profiles")
      .insert({
        id: user.id,
        display_name: deriveDisplayName(user),
        coins: 100,
        free_packs: 3,
      })
      .select("id, display_name, coins, free_packs")
      .single();

    if (createError) {
      throw new Error(`Failed to create player profile: ${createError.message}`);
    }
    profileRow = created;
  }

  const starters = resolveStarterPartsBySlot(catalog);
  const starterParts = [
    starters.head,
    starters.torso,
    starters.arms,
    starters.legs,
  ];

  // Ensure every starter part exists in inventory without duplicating quantities.
  const { data: ownedRows } = await supabase
    .from("user_inventory")
    .select("part_id")
    .eq("user_id", user.id);

  const ownedSet = new Set(
    (ownedRows ?? []).map((row: { part_id: string }) => row.part_id)
  );
  const missingStarters = starterParts.filter((part) => !ownedSet.has(part.id));

  if (missingStarters.length > 0) {
    const { error: invError } = await supabase.from("user_inventory").insert(
      missingStarters.map((part) => ({
        user_id: user.id,
        part_id: part.id,
        quantity: 1,
      }))
    );
    if (invError) {
      throw new Error(`Failed to seed starter inventory: ${invError.message}`);
    }
  }

  const { data: existingLoadout } = await supabase
    .from("user_loadouts")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!existingLoadout) {
    const { error: loadoutError } = await supabase.from("user_loadouts").insert({
      user_id: user.id,
      head_part_id: starters.head.id,
      torso_part_id: starters.torso.id,
      arms_part_id: starters.arms.id,
      legs_part_id: starters.legs.id,
    });
    if (loadoutError) {
      throw new Error(`Failed to initialize loadout: ${loadoutError.message}`);
    }
  }

  return {
    id: profileRow.id as string,
    displayName: profileRow.display_name as string,
    coins: profileRow.coins as number,
    freePacks: profileRow.free_packs as number,
  };
}

/**
 * Load the authenticated player's full state: profile, catalog, inventory,
 * equipped loadout, computed combat stats, and Storage card back URL.
 */
export async function fetchPlayerFullState(
  supabase: SupabaseClient,
  user: User
): Promise<PlayerFullState> {
  const catalog = await fetchActiveParts(supabase);
  const profile = await ensurePlayerBootstrap(supabase, user, catalog);
  const byId = new Map(catalog.map((part) => [part.id, part]));
  const starters = resolveStarterPartsBySlot(catalog);

  const [{ data: invRows, error: invError }, { data: loadoutRow, error: loadoutError }] =
    await Promise.all([
      supabase
        .from("user_inventory")
        .select("part_id, quantity")
        .eq("user_id", user.id),
      supabase
        .from("user_loadouts")
        .select("head_part_id, torso_part_id, arms_part_id, legs_part_id")
        .eq("user_id", user.id)
        .single(),
    ]);

  if (invError) {
    throw new Error(`Failed to fetch inventory: ${invError.message}`);
  }
  if (loadoutError) {
    throw new Error(`Failed to fetch loadout: ${loadoutError.message}`);
  }

  const inventory: InventoryEntry[] = (invRows ?? []).map(
    (row: { part_id: string; quantity: number }) => ({
      partId: row.part_id,
      quantity: row.quantity,
    })
  );

  const loadout: Loadout = {
    head: byId.get(loadoutRow.head_part_id as string) ?? starters.head,
    torso: byId.get(loadoutRow.torso_part_id as string) ?? starters.torso,
    arms: byId.get(loadoutRow.arms_part_id as string) ?? starters.arms,
    legs: byId.get(loadoutRow.legs_part_id as string) ?? starters.legs,
  };

  return {
    profile,
    catalog,
    inventory,
    loadout,
    stats: computeCreatureStats(loadout),
    highestRarity: getHighestLoadoutRarity(loadout),
    cardBackUrl: getCardBackPublicUrl(),
  };
}
