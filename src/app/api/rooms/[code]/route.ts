// @Author: Jonathan Serna
// @Date:   2026-11-23 21:06:00
// @Last Modified by:   Jonathan Serna
// @Last Modified time: 2026-11-23 21:06:00

/**
 * GET /api/rooms/[code] — Return metadata for an existing multiplayer room.
 */

import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/infrastructure/supabase/server";

export async function GET(
  _request: Request,
  context: { params: Promise<{ code: string }> }
): Promise<NextResponse> {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }

    const { code } = await context.params;
    const normalizedCode = code.trim().toUpperCase();

    const { data: room, error } = await supabase
      .from("game_rooms")
      .select("code, host_user_id, guest_user_id, status, terrain_seed, winner_user_id")
      .eq("code", normalizedCode)
      .maybeSingle();

    if (error || !room) {
      return NextResponse.json({ error: "Sala no encontrada." }, { status: 404 });
    }

    return NextResponse.json({ room });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error inesperado.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
