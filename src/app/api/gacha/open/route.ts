// @Author: Jonathan Serna
// @Date:   2026-11-23 21:00:30
// @Last Modified by:   Jonathan Serna
// @Last Modified time: 2026-11-23 21:00:30

/**
 * POST /api/gacha/open — Open a 3-card Gacha pack from public.parts_catalog,
 * check ownership in public.user_inventory, persist new cards or duplicate
 * FrankenCoins, and return cards hydrated with parts-assets Storage URLs.
 */

import { NextResponse } from "next/server";

import {
  evaluatePackPulls,
  PACK_COST_COINS,
  PACK_SIZE,
  rollPack,
} from "@/domain/gachaEngine";
import {
  ensurePlayerBootstrap,
  fetchActiveParts,
} from "@/infrastructure/supabase/partsRepository";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server";

export async function POST(): Promise<NextResponse> {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }

    const catalog = await fetchActiveParts(supabase);
    const profile = await ensurePlayerBootstrap(supabase, user, catalog);

    const useFreePack = profile.freePacks > 0;
    if (!useFreePack && profile.coins < PACK_COST_COINS) {
      return NextResponse.json(
        {
          error: `Necesitas ${PACK_COST_COINS} FrankenCoins o un sobre gratis.`,
        },
        { status: 400 }
      );
    }

    // Check current player ownership to classify new vs duplicate cards.
    const { data: invRows, error: invReadError } = await supabase
      .from("user_inventory")
      .select("part_id, quantity")
      .eq("user_id", user.id);

    if (invReadError) {
      throw new Error(`Failed to read user_inventory: ${invReadError.message}`);
    }

    const quantityByPartId = new Map<string, number>();
    for (const row of invRows ?? []) {
      quantityByPartId.set(row.part_id as string, row.quantity as number);
    }

    const pulledParts = rollPack(catalog, PACK_SIZE);
    const { results, totalDuplicateCoins } = evaluatePackPulls(
      pulledParts,
      new Set(quantityByPartId.keys())
    );

    // Count increments per part_id so duplicate pulls within one pack persist cleanly.
    const countDelta = new Map<string, number>();
    for (const item of results) {
      countDelta.set(item.part.id, (countDelta.get(item.part.id) ?? 0) + 1);
    }

    for (const [partId, delta] of countDelta.entries()) {
      const existingQty = quantityByPartId.get(partId);
      if (existingQty === undefined) {
        const { error: insertError } = await supabase
          .from("user_inventory")
          .insert({
            user_id: user.id,
            part_id: partId,
            quantity: delta,
          });
        if (insertError) {
          throw new Error(`Failed to save new card: ${insertError.message}`);
        }
      } else {
        const { error: updateError } = await supabase
          .from("user_inventory")
          .update({ quantity: existingQty + delta })
          .eq("user_id", user.id)
          .eq("part_id", partId);
        if (updateError) {
          throw new Error(`Failed to update duplicate card: ${updateError.message}`);
        }
      }
    }

    const nextFreePacks = useFreePack ? profile.freePacks - 1 : profile.freePacks;
    const nextCoins =
      (useFreePack ? profile.coins : profile.coins - PACK_COST_COINS) +
      totalDuplicateCoins;

    const { error: profileUpdateError } = await supabase
      .from("profiles")
      .update({ free_packs: nextFreePacks, coins: nextCoins })
      .eq("id", user.id);

    if (profileUpdateError) {
      throw new Error(`Failed to update player balance: ${profileUpdateError.message}`);
    }

    return NextResponse.json({
      pulls: results,
      totalDuplicateCoins,
      coins: nextCoins,
      freePacks: nextFreePacks,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error inesperado.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
