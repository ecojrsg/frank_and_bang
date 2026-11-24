// @Author: Jonathan Serna
// @Date:   2026-11-23 22:25:00
// @Last Modified by:   Jonathan Serna
// @Last Modified time: 2026-11-23 22:25:00

/**
 * Pure lobby team management for 2-to-4 player Frank and Bang rooms:
 * customizable team names, mutually exclusive team colors, balanced
 * team assignments, and start rules (allow 2 players 1v1, wait at 3, allow 4 2v2).
 */

import type { TeamColorKey, TeamConfig, TeamId } from "./types";

export interface TeamColorOption {
  key: TeamColorKey;
  label: string;
  hex: string;
}

export const TEAM_COLOR_PALETTE: TeamColorOption[] = [
  { key: "red", label: "Rojo", hex: "#ef4444" },
  { key: "blue", label: "Azul", hex: "#38bdf8" },
  { key: "green", label: "Verde", hex: "#34d399" },
  { key: "amber", label: "Dorado", hex: "#fbbf24" },
  { key: "purple", label: "Morado", hex: "#a855f7" },
  { key: "pink", label: "Rosa", hex: "#f472b6" },
];

export interface LobbyTeamsState {
  teams: Record<TeamId, TeamConfig>;
  assignments: Record<string, TeamId>;
}

export interface MatchStartValidation {
  canStart: boolean;
  modeLabel: string;
  reason: string;
}

const MAX_PLAYERS_PER_TEAM = 2;

function getColorOption(colorKey: TeamColorKey): TeamColorOption {
  return (
    TEAM_COLOR_PALETTE.find((item) => item.key === colorKey) ??
    TEAM_COLOR_PALETTE[0]
  );
}

/**
 * Create default customizable team configuration with mutually exclusive colors.
 */
export function createDefaultLobbyTeams(hostPlayerId: string): LobbyTeamsState {
  const team1Color = getColorOption("green");
  const team2Color = getColorOption("blue");

  return {
    teams: {
      team1: {
        id: "team1",
        name: "Equipo 1",
        colorKey: team1Color.key,
        hex: team1Color.hex,
      },
      team2: {
        id: "team2",
        name: "Equipo 2",
        colorKey: team2Color.key,
        hex: team2Color.hex,
      },
    },
    assignments: hostPlayerId ? { [hostPlayerId]: "team1" } : {},
  };
}

/**
 * Count how many currently connected players belong to each team.
 */
export function countTeamMembers(
  assignments: Record<string, TeamId>,
  connectedPlayerIds: string[]
): Record<TeamId, number> {
  let team1 = 0;
  let team2 = 0;

  for (const playerId of connectedPlayerIds) {
    if (assignments[playerId] === "team1") {
      team1 += 1;
    } else if (assignments[playerId] === "team2") {
      team2 += 1;
    }
  }

  return { team1, team2 };
}

/**
 * Synchronize team assignments against currently connected players:
 * drop disconnected players and auto-place newly joined players on the
 * team with fewer members (respecting 2-player-per-team cap).
 */
export function syncLobbyAssignments(
  state: LobbyTeamsState,
  connectedPlayerIds: string[]
): LobbyTeamsState {
  const connectedSet = new Set(connectedPlayerIds);
  const nextAssignments: Record<string, TeamId> = {};

  for (const [playerId, teamId] of Object.entries(state.assignments)) {
    if (connectedSet.has(playerId)) {
      nextAssignments[playerId] = teamId;
    }
  }

  for (const playerId of connectedPlayerIds) {
    if (nextAssignments[playerId]) {
      continue;
    }
    const counts = countTeamMembers(nextAssignments, connectedPlayerIds);
    if (counts.team1 <= counts.team2 && counts.team1 < MAX_PLAYERS_PER_TEAM) {
      nextAssignments[playerId] = "team1";
    } else if (counts.team2 < MAX_PLAYERS_PER_TEAM) {
      nextAssignments[playerId] = "team2";
    } else if (counts.team1 < MAX_PLAYERS_PER_TEAM) {
      nextAssignments[playerId] = "team1";
    }
  }

  return {
    teams: state.teams,
    assignments: nextAssignments,
  };
}

/**
 * Change a team's color only if the opposing team is not already using it.
 */
export function setTeamColor(
  state: LobbyTeamsState,
  teamId: TeamId,
  colorKey: TeamColorKey
): LobbyTeamsState {
  const otherTeamId: TeamId = teamId === "team1" ? "team2" : "team1";
  if (state.teams[otherTeamId].colorKey === colorKey) {
    return state;
  }

  const color = getColorOption(colorKey);
  return {
    ...state,
    teams: {
      ...state.teams,
      [teamId]: {
        ...state.teams[teamId],
        colorKey: color.key,
        hex: color.hex,
      },
    },
  };
}

/**
 * Rename a team with clean trimming and length clamping (1..18 chars).
 */
export function setTeamName(
  state: LobbyTeamsState,
  teamId: TeamId,
  rawName: string
): LobbyTeamsState {
  const clean = rawName.trim().slice(0, 18);
  const fallback = teamId === "team1" ? "Equipo 1" : "Equipo 2";

  return {
    ...state,
    teams: {
      ...state.teams,
      [teamId]: {
        ...state.teams[teamId],
        name: clean.length > 0 ? clean : fallback,
      },
    },
  };
}

/**
 * Move a connected player into targetTeam if that team has fewer than 2 members.
 */
export function assignPlayerToTeam(
  state: LobbyTeamsState,
  playerId: string,
  targetTeam: TeamId,
  connectedPlayerIds: string[]
): LobbyTeamsState {
  if (!connectedPlayerIds.includes(playerId)) {
    return state;
  }

  const counts = countTeamMembers(
    state.assignments,
    connectedPlayerIds.filter((id) => id !== playerId)
  );
  if (counts[targetTeam] >= MAX_PLAYERS_PER_TEAM) {
    return state;
  }

  return {
    ...state,
    assignments: {
      ...state.assignments,
      [playerId]: targetTeam,
    },
  };
}

/**
 * Enforce 2-to-4 player match start rules:
 * - 1 player: cannot start.
 * - 2 players: balanced 1 vs 1 allowed.
 * - 3 players: must wait for the 4th player to form 2 vs 2.
 * - 4 players: balanced 2 vs 2 allowed.
 */
export function validateMatchStart(
  state: LobbyTeamsState,
  connectedPlayerIds: string[]
): MatchStartValidation {
  const total = connectedPlayerIds.length;
  const counts = countTeamMembers(state.assignments, connectedPlayerIds);

  if (total < 2) {
    return {
      canStart: false,
      modeLabel: `${total}/4 Jugadores`,
      reason: "Se necesitan minimo 2 jugadores para iniciar (1 vs 1) o 4 para jugar 2 vs 2.",
    };
  }

  if (total === 3) {
    return {
      canStart: false,
      modeLabel: "3/4 Jugadores · Esperando al 4.º",
      reason:
        "Hay 3 jugadores en sala. Esperando al 4.º jugador para completar equipos 2 vs 2.",
    };
  }

  if (total === 2) {
    const balanced = counts.team1 === 1 && counts.team2 === 1;
    return {
      canStart: balanced,
      modeLabel: "2/4 Jugadores · Modo 1 vs 1",
      reason: balanced
        ? "Sala lista para combate 1 vs 1. Tambien pueden entrar hasta 4 jugadores."
        : "Cada jugador debe estar en un equipo distinto para iniciar 1 vs 1.",
    };
  }

  if (total === 4) {
    const balanced = counts.team1 === 2 && counts.team2 === 2;
    return {
      canStart: balanced,
      modeLabel: "4/4 Jugadores · Modo 2 vs 2",
      reason: balanced
        ? "Sala completa (2 vs 2). Lista para iniciar combate."
        : "Equilibra 2 jugadores por equipo para iniciar el 2 vs 2.",
    };
  }

  return {
    canStart: false,
    modeLabel: `${total}/4 Jugadores`,
    reason: "Maximo 4 jugadores permitidos por sala.",
  };
}
