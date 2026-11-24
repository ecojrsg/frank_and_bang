// @Author: Jonathan Serna
// @Date:   2026-11-23 21:06:00
// @Last Modified by:   Jonathan Serna
// @Last Modified time: 2026-11-23 22:26:00

/**
 * Typed Supabase Realtime Broadcast and Presence protocol for up to 4 players
 * with Host-Authoritative lobby team customization and match snapshots.
 */

import type { LobbyTeamsState } from "@/domain/teamLobby";
import type {
  CreatureAppearance,
  CreatureStats,
  MatchSnapshot,
  PartRarity,
  PlayerCommand,
  TeamColorKey,
  TeamId,
} from "@/domain/types";

export const REALTIME_EVENTS = {
  matchStart: "match_start",
  inputCmd: "input_cmd",
  stateSnapshot: "state_snapshot",
  lobbyState: "lobby_state",
  lobbyAction: "lobby_action",
} as const;

export interface RoomPresencePayload {
  playerId: string;
  displayName: string;
  role: "host" | "guest";
  joinedAt: number;
  stats: CreatureStats;
  rarityAccent: PartRarity;
  appearance: CreatureAppearance;
}

export interface InputCommandMessage {
  playerId: string;
  command: PlayerCommand;
}

export interface SnapshotBroadcastMessage {
  snapshot: MatchSnapshot;
}

export type LobbyActionMessage =
  | { type: "switch_team"; playerId: string; targetTeam: TeamId }
  | { type: "set_team_color"; teamId: TeamId; colorKey: TeamColorKey }
  | { type: "set_team_name"; teamId: TeamId; name: string };

export interface LobbyStateMessage {
  lobby: LobbyTeamsState;
}

/**
 * Return the canonical Supabase Realtime channel name for a 6-character code.
 */
export function getRoomChannelName(roomCode: string): string {
  return `room:${roomCode.trim().toUpperCase()}`;
}

/**
 * Extract all connected participants (up to 4) from Supabase Presence state,
 * deduplicated by playerId and ordered with Host first then join timestamp.
 */
export function extractRoomParticipants(
  presenceState: Record<string, unknown[]>
): RoomPresencePayload[] {
  const byId = new Map<string, RoomPresencePayload>();

  for (const entries of Object.values(presenceState)) {
    for (const rawEntry of entries) {
      const candidate = rawEntry as Partial<RoomPresencePayload>;
      if (
        !candidate.playerId ||
        !candidate.role ||
        !candidate.stats ||
        !candidate.appearance
      ) {
        continue;
      }
      byId.set(candidate.playerId, candidate as RoomPresencePayload);
    }
  }

  return Array.from(byId.values())
    .sort((a, b) => {
      if (a.role !== b.role) {
        return a.role === "host" ? -1 : 1;
      }
      return (a.joinedAt ?? 0) - (b.joinedAt ?? 0);
    })
    .slice(0, 4);
}
