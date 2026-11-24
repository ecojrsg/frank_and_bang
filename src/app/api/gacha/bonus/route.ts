// @Author: Jonathan Serna
// @Date:   2026-11-23 21:00:30
// @Last Modified by:   Jonathan Serna
// @Last Modified time: 2026-11-23 21:00:30

/**
 * POST /api/gacha/bonus — Grant one lab refill pack when a player has zero
 * free packs and fewer coins than the pack price (keeps classroom demos fluid).
 */

import { NextResponse } from "next/server";

import { PACK_COST_COINS } from "@/domain/gachaEngine";
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

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("coins, free_packs")
      .eq("id", user.id)
      .single();

    if (error || !profile) {
      return NextResponse.json({ error: "Perfil no encontrado." }, { status: 404 });
    }

    if ((profile.free_packs as number) > 0 || (profile.coins as number) >= PACK_COST_COINS) {
      return NextResponse.json(
        { error: "Ya cuentas con sobres o monedas suficientes para abrir un sobre." },
        { status: 400 }
      );
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ free_packs: 1 })
      .eq("id", user.id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    return NextResponse.json({ freePacks: 1, coins: profile.coins });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error inesperado.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
