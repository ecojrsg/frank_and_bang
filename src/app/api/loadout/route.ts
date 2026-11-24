// @Author: Jonathan Serna
// @Date:   2026-11-23 21:00:30
// @Last Modified by:   Jonathan Serna
// @Last Modified time: 2026-11-23 21:00:30

/**
 * PUT /api/loadout — Validate owned parts against public.parts_catalog and
 * public.user_inventory, persist equipped loadout, and return computed stats.
 */

import { NextResponse } from "next/server";
import { z } from "zod";

import { computeCreatureStats } from "@/domain/statsCalculator";
import { fetchActiveParts } from "@/infrastructure/supabase/partsRepository";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server";

const updateLoadoutSchema = z.object({
  headPartId: z.string().min(1),
  torsoPartId: z.string().min(1),
  armsPartId: z.string().min(1),
  legsPartId: z.string().min(1),
});

export async function PUT(request: Request): Promise<NextResponse> {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }

    const payload = updateLoadoutSchema.safeParse(await request.json());
    if (!payload.success) {
      return NextResponse.json(
        { error: "Seleccion de piezas invalida." },
        { status: 400 }
      );
    }

    const { headPartId, torsoPartId, armsPartId, legsPartId } = payload.data;
    const [catalog, { data: invRows }] = await Promise.all([
      fetchActiveParts(supabase),
      supabase
        .from("user_inventory")
        .select("part_id")
        .eq("user_id", user.id),
    ]);

    const ownedSet = new Set(
      (invRows ?? []).map((row: { part_id: string }) => row.part_id)
    );
    const byId = new Map(catalog.map((part) => [part.id, part]));

    const head = byId.get(headPartId);
    const torso = byId.get(torsoPartId);
    const arms = byId.get(armsPartId);
    const legs = byId.get(legsPartId);

    if (
      !head ||
      head.slot !== "head" ||
      !torso ||
      torso.slot !== "torso" ||
      !arms ||
      arms.slot !== "arms" ||
      !legs ||
      legs.slot !== "legs"
    ) {
      return NextResponse.json(
        { error: "Las piezas no corresponden a sus ranuras validas." },
        { status: 400 }
      );
    }

    if (
      !ownedSet.has(head.id) ||
      !ownedSet.has(torso.id) ||
      !ownedSet.has(arms.id) ||
      !ownedSet.has(legs.id)
    ) {
      return NextResponse.json(
        { error: "Solo puedes equipar piezas que ya hayas desbloqueado." },
        { status: 403 }
      );
    }

    const { error: saveError } = await supabase
      .from("user_loadouts")
      .upsert(
        {
          user_id: user.id,
          head_part_id: head.id,
          torso_part_id: torso.id,
          arms_part_id: arms.id,
          legs_part_id: legs.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (saveError) {
      throw new Error(saveError.message);
    }

    const stats = computeCreatureStats({ head, torso, arms, legs });
    return NextResponse.json({ loadout: { head, torso, arms, legs }, stats });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error inesperado.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
