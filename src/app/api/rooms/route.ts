// @Author: Jonathan Serna
// @Date:   2026-11-23 21:00:30
// @Last Modified by:   Jonathan Serna
// @Last Modified time: 2026-11-23 22:23:00

/**
 * POST /api/rooms — Create a new multiplayer lobby (up to 4 players) where
 * the creator acts as the authoritative game Host with a 6-character code.
 */

import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/infrastructure/supabase/server";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/**
 * Generate a 6-character uppercase room code avoiding ambiguous characters.
 */
function generateRoomCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) {
    const index = Math.floor(Math.random() * CODE_ALPHABET.length);
    code += CODE_ALPHABET[index];
  }
  return code;
}

export async function POST(): Promise<NextResponse> {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }

    const terrainSeed = Math.floor(Math.random() * 900000) + 1000;

    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateRoomCode();
      const { data, error } = await supabase
        .from("game_rooms")
        .insert({
          code,
          host_user_id: user.id,
          player_ids: [user.id],
          status: "waiting",
          terrain_seed: terrainSeed,
        })
        .select("code, host_user_id, guest_user_id, player_ids, status, terrain_seed")
        .single();

      if (!error && data) {
        return NextResponse.json({ room: data });
      }
    }

    return NextResponse.json(
      { error: "No fue posible generar un codigo de sala unico." },
      { status: 500 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error inesperado.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
