// @Author: Jonathan Serna
// @Date:   2026-11-23 21:00:30
// @Last Modified by:   Jonathan Serna
// @Last Modified time: 2026-11-23 21:00:30

/**
 * GET /api/profile — Bootstrap and return the authenticated player's profile,
 * active parts catalog, inventory, equipped loadout, and combat stats.
 */

import { NextResponse } from "next/server";

import { fetchPlayerFullState } from "@/infrastructure/supabase/partsRepository";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server";

export async function GET(): Promise<NextResponse> {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }

    const state = await fetchPlayerFullState(supabase, user);
    return NextResponse.json(state);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error inesperado.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
