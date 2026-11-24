// @Author: Jonathan Serna
// @Date:   2026-11-23 21:00:30
// @Last Modified by:   Jonathan Serna
// @Last Modified time: 2026-11-23 22:23:00

/**
 * POST /api/rooms/[code]/finish — Mark a team match finished and reward
 * FrankenCoins (+60 winning team, +30 participant) to the authenticated player.
 */

import { NextResponse } from "next/server";
import { z } from "zod";

import { createSupabaseServerClient } from "@/infrastructure/supabase/server";

const WINNER_REWARD_COINS = 60;
const PARTICIPANT_REWARD_COINS = 30;

const finishSchema = z.object({
  winnerTeamId: z.enum(["team1", "team2"]),
  didWin: z.boolean(),
  winnerPlayerId: z.string().uuid().optional(),
});

export async function POST(
  request: Request,
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

    const parsed = finishSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Payload invalido." }, { status: 400 });
    }

    const { code } = await context.params;
    const normalizedCode = code.trim().toUpperCase();

    const { data: room } = await supabase
      .from("game_rooms")
      .select("code, host_user_id, guest_user_id, player_ids, status")
      .eq("code", normalizedCode)
      .maybeSingle();

    const playerIds = Array.isArray(room?.player_ids)
      ? (room.player_ids as string[])
      : [];

    if (
      !room ||
      (room.host_user_id !== user.id &&
        room.guest_user_id !== user.id &&
        !playerIds.includes(user.id))
    ) {
      return NextResponse.json(
        { error: "No participas en esta sala." },
        { status: 403 }
      );
    }

    if (room.host_user_id === user.id && room.status !== "finished") {
      await supabase
        .from("game_rooms")
        .update({
          status: "finished",
          winner_team_id: parsed.data.winnerTeamId,
          winner_user_id: parsed.data.winnerPlayerId ?? null,
        })
        .eq("code", normalizedCode);
    }

    const reward = parsed.data.didWin
      ? WINNER_REWARD_COINS
      : PARTICIPANT_REWARD_COINS;

    const { data: profile } = await supabase
      .from("profiles")
      .select("coins")
      .eq("id", user.id)
      .single();

    const nextCoins = ((profile?.coins as number | undefined) ?? 0) + reward;
    await supabase
      .from("profiles")
      .update({ coins: nextCoins })
      .eq("id", user.id);

    return NextResponse.json({ rewardCoins: reward, coins: nextCoins });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error inesperado.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
