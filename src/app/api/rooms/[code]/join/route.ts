// @Author: Jonathan Serna
// @Date:   2026-11-23 21:00:30
// @Last Modified by:   Jonathan Serna
// @Last Modified time: 2026-11-23 21:00:30

/**
 * POST /api/rooms/[code]/join — Validate a 6-character room code and join
 * the Host-Authoritative multiplayer lobby as Guest.
 */

import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/infrastructure/supabase/server";

export async function POST(
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
      .select("code, host_user_id, guest_user_id, status, terrain_seed")
      .eq("code", normalizedCode)
      .maybeSingle();

    if (error || !room) {
      return NextResponse.json(
        { error: "Sala no encontrada. Verifica el codigo de 6 caracteres." },
        { status: 404 }
      );
    }

    if (room.host_user_id === user.id || room.guest_user_id === user.id) {
      return NextResponse.json({ room });
    }

    if (room.status !== "waiting" || room.guest_user_id !== null) {
      return NextResponse.json(
        { error: "Esta sala ya esta llena o la partida ya comenzo." },
        { status: 409 }
      );
    }

    const { data: updated, error: joinError } = await supabase
      .from("game_rooms")
      .update({ guest_user_id: user.id })
      .eq("code", normalizedCode)
      .is("guest_user_id", null)
      .select("code, host_user_id, guest_user_id, status, terrain_seed")
      .single();

    if (joinError || !updated) {
      return NextResponse.json(
        { error: "No se pudo unir a la sala. Intenta de nuevo." },
        { status: 409 }
      );
    }

    return NextResponse.json({ room: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error inesperado.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
