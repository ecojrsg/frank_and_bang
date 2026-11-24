// @Author: Jonathan Serna
// @Date:   2026-11-23 21:06:00
// @Last Modified by:   Jonathan Serna
// @Last Modified time: 2026-11-23 21:06:00

/**
 * Typed Supabase Realtime Broadcast and Presence protocol for
 * Host-Authoritative multiplayer matches in Frank and Bang.
 */

import type {
  CreatureStats,
  MatchSnapshot,
  PartRarity,
  PlayerCommand,
} from "@/domain/types";

export const REALTIME_EVENTS = {
  matchStart: "match_start",
  inputCmd: "input_cmd",
  stateSnapshot: "state_snapshot",
} as const;

export interface RoomPresencePayload {
  playerId: string;
  displayName: string;
  role: "host" | "guest";
  stats: CreatureStats;
  rarityAccent: PartRarity;
}

export interface InputCommandMessage {
  playerId: string;
  command: PlayerCommand;
}

export interface SnapshotBroadcastMessage {
  snapshot: MatchSnapshot;
}

/**
 * Return the canonical Supabase Realtime channel name for a 6-character code.
 */
export function getRoomChannelName(roomCode: string): string {
  return `room:${roomCode.trim().toUpperCase()}`;
}

/**
 * Extract unique host and guest presence entries from Supabase Presence state.
 */
export function extractRoomParticipants(
  presenceState: Record<string, unknown[]>
): { host: RoomPresencePayload | null; guest: RoomPresencePayload | null } {
  let host: RoomPresencePayload | null = null;
  let guest: RoomPresencePayload | null = null;

  for (const entries of Object.values(presenceState)) {
    for (const rawEntry of entries) {
      const candidate = rawEntry as Partial<RoomPresencePayload>;
      if (!candidate.playerId || !candidate.role || !candidate.stats) {
        continue;
      }
      if (candidate.role === "host") {
        host = candidate as RoomPresencePayload;
      } else if (candidate.role === "guest") {
        guest = candidate as RoomPresencePayload;
      }
    }
  }

  return { host, guest };
}
