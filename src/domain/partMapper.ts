// @Author: Jonathan Serna
// @Date:   2026-11-23 20:57:00
// @Last Modified by:   Jonathan Serna
// @Last Modified time: 2026-11-23 20:57:00

/**
 * Validation and mapping helpers for rows loaded from public.parts_catalog
 * and public asset URLs resolved from the Supabase Storage "parts-assets" bucket.
 */

import { z } from "zod";

import type { Part, PartRarity, PartSlot } from "./types";

export const PARTS_BUCKET_NAME = "parts-assets";

export const RARITY_MAX_DELTA: Record<PartRarity, number> = {
  normal: 2,
  rare: 3,
  unique: 4,
};

const specialTraitSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  effectType: z.enum([
    "blast_radius_pct",
    "turn_time_bonus",
    "splash_resist_pct",
    "launch_speed_pct",
  ]),
  effectValue: z.number().positive(),
});

export const partCatalogRowSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9_]+$/),
    name: z.string().min(1),
    slot: z.enum(["head", "torso", "arms", "legs"]),
    rarity: z.enum(["normal", "rare", "unique"]),
    asset_path: z.string().min(1).nullable(),
    card_asset_path: z.string().min(1).nullable(),
    description: z.string().min(1),
    hp_delta: z.number().int(),
    atk_delta: z.number().int(),
    def_delta: z.number().int(),
    mov_delta: z.number().int(),
    trait: specialTraitSchema.nullable(),
    is_starter: z.boolean(),
    is_active: z.boolean(),
  })
  .superRefine((row, ctx) => {
    const maxDelta = RARITY_MAX_DELTA[row.rarity];
    const deltas = [row.hp_delta, row.atk_delta, row.def_delta, row.mov_delta];

    if (deltas.some((delta) => Math.abs(delta) > maxDelta)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Part "${row.id}" exceeds rarity "${row.rarity}" stat bound (${maxDelta}).`,
      });
    }

    if (row.rarity === "unique" && row.trait === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Unique part "${row.id}" must declare a special trait.`,
      });
    }

    if (row.rarity !== "unique" && row.trait !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Non-unique part "${row.id}" cannot declare a special trait.`,
      });
    }
  });

export type PartCatalogRow = z.infer<typeof partCatalogRowSchema>;

/**
 * Build a public Supabase Storage URL for an object inside parts-assets.
 */
export function buildStoragePublicUrl(
  supabaseUrl: string | null | undefined,
  objectPath: string | null
): string | null {
  if (!supabaseUrl || !objectPath) {
    return null;
  }

  const trimmedBase = supabaseUrl.replace(/\/+$/, "");
  const cleanPath = objectPath.replace(/^\/+/, "");
  return `${trimmedBase}/storage/v1/object/public/${PARTS_BUCKET_NAME}/${cleanPath}`;
}

/**
 * Validate and map a raw database row from public.parts_catalog into a Part.
 *
 * When card_asset_path is null, cardAssetUrl inherits assetUrl so Gacha cards
 * and body parts share the same parts-assets Storage pipeline seamlessly.
 */
export function mapCatalogRowToPart(
  rawRow: unknown,
  supabaseUrl: string | null | undefined
): Part {
  const row = partCatalogRowSchema.parse(rawRow);
  const assetUrl = buildStoragePublicUrl(supabaseUrl, row.asset_path);
  const dedicatedCardUrl = buildStoragePublicUrl(supabaseUrl, row.card_asset_path);

  return {
    id: row.id,
    name: row.name,
    slot: row.slot,
    rarity: row.rarity,
    assetPath: row.asset_path,
    cardAssetPath: row.card_asset_path,
    assetUrl,
    cardAssetUrl: dedicatedCardUrl ?? assetUrl,
    description: row.description,
    modifiers: {
      hpDelta: row.hp_delta,
      atkDelta: row.atk_delta,
      defDelta: row.def_delta,
      movDelta: row.mov_delta,
    },
    trait: row.trait,
    isStarter: row.is_starter,
    isActive: row.is_active,
  };
}

/**
 * Group an array of parts into a dictionary indexed by slot.
 */
export function groupPartsBySlot(parts: Part[]): Record<PartSlot, Part[]> {
  const grouped: Record<PartSlot, Part[]> = {
    head: [],
    torso: [],
    arms: [],
    legs: [],
  };

  for (const part of parts) {
    grouped[part.slot].push(part);
  }

  return grouped;
}
