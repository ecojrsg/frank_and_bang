"use client";

// @Author: Jonathan Serna
// @Date:   2026-11-23 21:06:00
// @Last Modified by:   Jonathan Serna
// @Last Modified time: 2026-11-23 23:38:00

/**
 * Multiplayer room lobby (up to 4 players with customizable teams and exclusive
 * colors) and immersive fullscreen 2D Worms artillery arena powered by
 * Host-Authoritative state synchronization over Supabase Realtime.
 */

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";

import { ArtilleryDialGauge } from "@/components/arena/ArtilleryDialGauge";
import { Navbar } from "@/components/layout/Navbar";
import {
  applyPlayerCommand,
  createInitialMatchState,
  stepHostSimulation,
} from "@/domain/gameRoomHost";
import {
  assignPlayerToTeam,
  createDefaultLobbyTeams,
  setTeamColor,
  setTeamName,
  syncLobbyAssignments,
  TEAM_COLOR_PALETTE,
  validateMatchStart,
  type LobbyTeamsState,
} from "@/domain/teamLobby";
import type {
  CreatureAppearance,
  MatchSnapshot,
  PlayerCommand,
  TeamColorKey,
  TeamConfig,
  TeamId,
} from "@/domain/types";
import { ArenaCanvas } from "@/engine/ArenaCanvas";
import {
  buildAppearanceFromLoadout,
  drawAssembledCreature,
} from "@/engine/creatureRenderer";
import { soundEngine } from "@/engine/soundEngine";
import { createSupabaseBrowserClient } from "@/infrastructure/supabase/client";
import type { PlayerFullState } from "@/infrastructure/supabase/partsRepository";
import {
  extractRoomParticipants,
  getRoomChannelName,
  REALTIME_EVENTS,
  type InputCommandMessage,
  type LobbyActionMessage,
  type LobbyStateMessage,
  type RoomPresencePayload,
  type SnapshotBroadcastMessage,
} from "@/network/realtimeProtocol";

interface RoomRecord {
  code: string;
  host_user_id: string;
  guest_user_id: string | null;
  player_ids: string[];
  status: "waiting" | "playing" | "finished";
  terrain_seed: number;
}

/**
 * Reduce one team-lobby action safely using pure domain rules.
 */
function applyLobbyAction(
  current: LobbyTeamsState,
  action: LobbyActionMessage,
  connectedIds: string[]
): LobbyTeamsState {
  if (action.type === "switch_team") {
    return assignPlayerToTeam(
      current,
      action.playerId,
      action.targetTeam,
      connectedIds
    );
  }
  if (action.type === "set_team_color") {
    return setTeamColor(current, action.teamId, action.colorKey);
  }
  return setTeamName(current, action.teamId, action.name);
}

export default function ArenaRoomPage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const roomCode = (params.code ?? "").toUpperCase();

  const [playerState, setPlayerState] = useState<PlayerFullState | null>(null);
  const [room, setRoom] = useState<RoomRecord | null>(null);
  const [participants, setParticipants] = useState<RoomPresencePayload[]>([]);
  const [lobbyState, setLobbyState] = useState<LobbyTeamsState>(() =>
    createDefaultLobbyTeams("")
  );
  const [snapshot, setSnapshot] = useState<MatchSnapshot | null>(null);
  const [chargePower, setChargePower] = useState(0);
  const [copiedCode, setCopiedCode] = useState(false);
  const [muted, setMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [recenterNonce, setRecenterNonce] = useState(0);
  const [resetViewNonce, setResetViewNonce] = useState(0);
  const [rewardMessage, setRewardMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const arenaShellRef = useRef<HTMLDivElement | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const snapshotRef = useRef<MatchSnapshot | null>(null);
  const lobbyStateRef = useRef<LobbyTeamsState>(lobbyState);
  const participantsRef = useRef<RoomPresencePayload[]>([]);
  const chargingRef = useRef(false);
  const chargeValueRef = useRef(0);
  const rewardClaimedRef = useRef(false);
  const lastTurnNotifiedRef = useRef<number>(0);

  const isHost =
    Boolean(playerState && room) && room?.host_user_id === playerState?.profile.id;

  useEffect(() => {
    setMuted(soundEngine.isMuted());
  }, []);

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  useEffect(() => {
    lobbyStateRef.current = lobbyState;
  }, [lobbyState]);

  useEffect(() => {
    participantsRef.current = participants;
  }, [participants]);

  // Trigger turn alert chime when active turn advances.
  useEffect(() => {
    if (!snapshot || !playerState || snapshot.phase === "finished") {
      return;
    }
    if (snapshot.turnNumber > lastTurnNotifiedRef.current) {
      lastTurnNotifiedRef.current = snapshot.turnNumber;
      soundEngine.playTurnAlert(
        snapshot.activePlayerId === playerState.profile.id
      );
    }
  }, [snapshot, playerState]);

  // 1. Load player profile & room metadata.
  useEffect(() => {
    async function bootstrapRoom() {
      try {
        const [profileRes, roomRes] = await Promise.all([
          fetch("/api/profile"),
          fetch(`/api/rooms/${roomCode}`),
        ]);

        if (profileRes.status === 401) {
          router.push("/login");
          return;
        }

        const profileData = (await profileRes.json()) as PlayerFullState & {
          error?: string;
        };
        const roomData = (await roomRes.json()) as {
          room?: RoomRecord;
          error?: string;
        };

        if (!profileRes.ok) {
          throw new Error(profileData.error ?? "Error cargando perfil.");
        }
        if (!roomRes.ok || !roomData.room) {
          throw new Error(roomData.error ?? "Sala no encontrada.");
        }

        setPlayerState(profileData);
        setRoom(roomData.room);
        const initialLobby = createDefaultLobbyTeams(roomData.room.host_user_id);
        lobbyStateRef.current = initialLobby;
        setLobbyState(initialLobby);
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Error cargando sala."
        );
      }
    }

    if (roomCode) {
      bootstrapRoom();
    }
  }, [roomCode, router]);

  const broadcastSnapshot = useCallback((nextSnapshot: MatchSnapshot) => {
    snapshotRef.current = nextSnapshot;
    setSnapshot(nextSnapshot);
    channelRef.current?.send({
      type: "broadcast",
      event: REALTIME_EVENTS.stateSnapshot,
      payload: { snapshot: nextSnapshot } satisfies SnapshotBroadcastMessage,
    });
  }, []);

  const broadcastLobbyState = useCallback((nextLobby: LobbyTeamsState) => {
    lobbyStateRef.current = nextLobby;
    setLobbyState(nextLobby);
    channelRef.current?.send({
      type: "broadcast",
      event: REALTIME_EVENTS.lobbyState,
      payload: { lobby: nextLobby } satisfies LobbyStateMessage,
    });
  }, []);

  // 2. Subscribe to Supabase Realtime channel (Presence + Broadcast).
  useEffect(() => {
    if (!playerState || !room) {
      return;
    }

    const supabase = createSupabaseBrowserClient();
    const role: "host" | "guest" =
      room.host_user_id === playerState.profile.id ? "host" : "guest";
    const joinedAt = Date.now();

    const channel = supabase.channel(getRoomChannelName(room.code), {
      config: {
        presence: { key: playerState.profile.id },
      },
    });
    channelRef.current = channel;

    channel
      .on("presence", { event: "sync" }, () => {
        const rawState = channel.presenceState() as Record<string, unknown[]>;
        const connected = extractRoomParticipants(rawState);
        participantsRef.current = connected;
        setParticipants(connected);

        if (role === "host") {
          const synced = syncLobbyAssignments(
            lobbyStateRef.current,
            connected.map((p) => p.playerId)
          );
          broadcastLobbyState(synced);
        }
      })
      .on("broadcast", { event: REALTIME_EVENTS.lobbyState }, ({ payload }) => {
        if (role === "host") {
          return;
        }
        const msg = payload as LobbyStateMessage;
        if (msg?.lobby) {
          lobbyStateRef.current = msg.lobby;
          setLobbyState(msg.lobby);
        }
      })
      .on("broadcast", { event: REALTIME_EVENTS.lobbyAction }, ({ payload }) => {
        if (role !== "host") {
          return;
        }
        const action = payload as LobbyActionMessage;
        if (!action?.type) {
          return;
        }
        const connectedIds = participantsRef.current.map((p) => p.playerId);
        const updated = applyLobbyAction(lobbyStateRef.current, action, connectedIds);
        broadcastLobbyState(updated);
      })
      .on("broadcast", { event: REALTIME_EVENTS.matchStart }, ({ payload }) => {
        const msg = payload as SnapshotBroadcastMessage;
        if (msg?.snapshot) {
          snapshotRef.current = msg.snapshot;
          setSnapshot(msg.snapshot);
        }
      })
      .on("broadcast", { event: REALTIME_EVENTS.stateSnapshot }, ({ payload }) => {
        if (role === "host") {
          return;
        }
        const msg = payload as SnapshotBroadcastMessage;
        if (msg?.snapshot) {
          snapshotRef.current = msg.snapshot;
          setSnapshot(msg.snapshot);
        }
      })
      .on("broadcast", { event: REALTIME_EVENTS.inputCmd }, ({ payload }) => {
        if (role !== "host" || !snapshotRef.current) {
          return;
        }
        const msg = payload as InputCommandMessage;
        if (!msg?.playerId || !msg?.command) {
          return;
        }
        const updated = applyPlayerCommand(
          snapshotRef.current,
          msg.playerId,
          msg.command
        );
        broadcastSnapshot(updated);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          const presencePayload: RoomPresencePayload = {
            playerId: playerState.profile.id,
            displayName: playerState.profile.displayName,
            role,
            joinedAt,
            stats: playerState.stats,
            rarityAccent: playerState.highestRarity,
            appearance: buildAppearanceFromLoadout(playerState.loadout),
          };
          await channel.track(presencePayload);
        }
      });

    return () => {
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [playerState, room, broadcastSnapshot, broadcastLobbyState]);

  // 3. Host-Authoritative simulation loop (includes airborne jump frames!).
  const activePhase = snapshot?.phase ?? null;
  useEffect(() => {
    if (!isHost || !activePhase || activePhase === "finished") {
      return;
    }

    let frameCounter = 0;
    const interval = window.setInterval(() => {
      const current = snapshotRef.current;
      if (!current || current.phase === "finished" || current.phase === "waiting") {
        return;
      }

      const dt = 1 / 30;
      const next = stepHostSimulation(current, dt);
      frameCounter += 1;

      const phaseChanged = next.phase !== current.phase;
      const turnChanged = next.turnNumber !== current.turnNumber;
      const anyAirborne =
        next.fighters.some((f) => !f.grounded) ||
        current.fighters.some((f) => !f.grounded);
      const shouldBroadcast =
        phaseChanged ||
        turnChanged ||
        anyAirborne ||
        next.phase === "projectile" ||
        frameCounter % 15 === 0;

      snapshotRef.current = next;
      setSnapshot(next);

      if (shouldBroadcast) {
        channelRef.current?.send({
          type: "broadcast",
          event: REALTIME_EVENTS.stateSnapshot,
          payload: { snapshot: next } satisfies SnapshotBroadcastMessage,
        });
      }
    }, 33);

    return () => window.clearInterval(interval);
  }, [isHost, activePhase]);

  // 4. Victory/defeat audio & team reward claim once the match ends.
  useEffect(() => {
    if (
      !snapshot ||
      !playerState ||
      snapshot.phase !== "finished" ||
      !snapshot.winnerTeamId ||
      rewardClaimedRef.current
    ) {
      return;
    }

    rewardClaimedRef.current = true;
    const myFighter = snapshot.fighters.find(
      (f) => f.playerId === playerState.profile.id
    );
    const didWin = myFighter?.teamId === snapshot.winnerTeamId;

    if (didWin) {
      soundEngine.playVictory();
    } else {
      soundEngine.playDefeat();
    }

    fetch(`/api/rooms/${roomCode}/finish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        winnerTeamId: snapshot.winnerTeamId,
        didWin,
        winnerPlayerId: snapshot.winnerPlayerId ?? undefined,
      }),
    })
      .then((res) => res.json())
      .then((data: { rewardCoins?: number }) => {
        if (data.rewardCoins) {
          setRewardMessage(`+${data.rewardCoins} FrankenCoins acreditados a tu cuenta.`);
        }
      })
      .catch(() => {
        // Non-fatal reward notification failure.
      });
  }, [snapshot, playerState, roomCode]);

  const dispatchLobbyAction = useCallback(
    (action: LobbyActionMessage) => {
      if (isHost) {
        const connectedIds = participantsRef.current.map((p) => p.playerId);
        const updated = applyLobbyAction(lobbyStateRef.current, action, connectedIds);
        broadcastLobbyState(updated);
      } else {
        channelRef.current?.send({
          type: "broadcast",
          event: REALTIME_EVENTS.lobbyAction,
          payload: action,
        });
      }
    },
    [isHost, broadcastLobbyState]
  );

  const sendCommand = useCallback(
    (command: PlayerCommand) => {
      if (!playerState || !snapshotRef.current) {
        return;
      }
      if (snapshotRef.current.activePlayerId !== playerState.profile.id) {
        return;
      }

      if (command.type === "move") {
        soundEngine.playStep();
      } else if (command.type === "jump") {
        soundEngine.playJump();
      } else if (command.type === "aim") {
        soundEngine.playAimTick();
      } else if (command.type === "fire") {
        soundEngine.playGrenadeLaunch();
      }

      setRecenterNonce((n) => n + 1);

      if (isHost) {
        const updated = applyPlayerCommand(
          snapshotRef.current,
          playerState.profile.id,
          command
        );
        broadcastSnapshot(updated);
      } else {
        channelRef.current?.send({
          type: "broadcast",
          event: REALTIME_EVENTS.inputCmd,
          payload: {
            playerId: playerState.profile.id,
            command,
          } satisfies InputCommandMessage,
        });
      }
    },
    [playerState, isHost, broadcastSnapshot]
  );

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!chargingRef.current) {
        return;
      }
      const nextPower = Math.min(1, chargeValueRef.current + 0.04);
      chargeValueRef.current = nextPower;
      setChargePower(nextPower);
      soundEngine.playChargeTick(nextPower);
    }, 45);

    return () => window.clearInterval(timer);
  }, []);

  const beginCharge = useCallback(() => {
    chargingRef.current = true;
    chargeValueRef.current = 0.2;
    setChargePower(0.2);
  }, []);

  const releaseFire = useCallback(() => {
    if (!chargingRef.current) {
      return;
    }
    const power = chargeValueRef.current;
    chargingRef.current = false;
    chargeValueRef.current = 0;
    setChargePower(0);
    sendCommand({ type: "fire", powerRatio: power });
  }, [sendCommand]);

  // Keyboard controls: WASD or Arrow keys + Shift to jump + Space to charge/fire.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const current = snapshotRef.current;
      if (!current || !playerState || current.phase !== "aiming") {
        return;
      }
      if (current.activePlayerId !== playerState.profile.id) {
        return;
      }

      const myFighter = current.fighters.find(
        (f) => f.playerId === playerState.profile.id
      );
      if (!myFighter) {
        return;
      }

      if (event.key === "Shift") {
        if (!event.repeat) {
          event.preventDefault();
          sendCommand({ type: "jump" });
        }
        return;
      }

      if (event.key === "ArrowLeft" || event.key === "a" || event.key === "A") {
        event.preventDefault();
        sendCommand({ type: "move", direction: -1 });
      } else if (
        event.key === "ArrowRight" ||
        event.key === "d" ||
        event.key === "D"
      ) {
        event.preventDefault();
        sendCommand({ type: "move", direction: 1 });
      } else if (event.key === "ArrowUp" || event.key === "w" || event.key === "W") {
        event.preventDefault();
        sendCommand({ type: "aim", angleDeg: myFighter.aimAngleDeg + 4 });
      } else if (
        event.key === "ArrowDown" ||
        event.key === "s" ||
        event.key === "S"
      ) {
        event.preventDefault();
        sendCommand({ type: "aim", angleDeg: myFighter.aimAngleDeg - 4 });
      } else if (event.code === "Space" && !chargingRef.current) {
        event.preventDefault();
        beginCharge();
      }
    }

    function handleKeyUp(event: KeyboardEvent) {
      if (event.code === "Space") {
        event.preventDefault();
        releaseFire();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [playerState, sendCommand, beginCharge, releaseFire]);

  const startValidation = useMemo(
    () =>
      validateMatchStart(
        lobbyState,
        participants.map((p) => p.playerId)
      ),
    [lobbyState, participants]
  );

  function handleStartMatch() {
    if (!isHost || !room || !startValidation.canStart) {
      return;
    }

    const matchParticipants = participants.map((p) => ({
      playerId: p.playerId,
      displayName: p.displayName,
      role: p.role,
      teamId: lobbyState.assignments[p.playerId] ?? "team1",
      stats: p.stats,
      rarityAccent: p.rarityAccent,
      appearance: p.appearance,
    }));

    const matchSeed =
      (room.terrain_seed + Math.floor(Math.random() * 100000)) >>> 0;

    const initial = createInitialMatchState(
      room.code,
      matchSeed,
      matchParticipants,
      lobbyState.teams
    );
    snapshotRef.current = initial;
    setSnapshot(initial);
    channelRef.current?.send({
      type: "broadcast",
      event: REALTIME_EVENTS.matchStart,
      payload: { snapshot: initial } satisfies SnapshotBroadcastMessage,
    });
  }

  async function handleCopyCode() {
    await navigator.clipboard.writeText(roomCode);
    setCopiedCode(true);
    window.setTimeout(() => setCopiedCode(false), 1800);
  }

  async function toggleBrowserFullscreen() {
    if (!arenaShellRef.current) {
      return;
    }
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await arenaShellRef.current.requestFullscreen();
      }
    } catch {
      // Ignore fullscreen denial in restricted iframes.
    }
  }

  if (errorMessage) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#141418] p-6 text-center">
        <p className="font-mono text-sm text-[#E84A5F]">{errorMessage}</p>
        <Link
          href="/menu"
          className="bg-[#52FF2E] px-4 py-2 font-mono text-xs font-bold text-[#121216] uppercase"
        >
          Volver al Menú
        </Link>
      </main>
    );
  }

  if (!playerState || !room) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#141418] p-6 font-mono text-xs text-[#B0AEA6]">
        Conectando a la sala {roomCode}...
      </main>
    );
  }

  // Lobby View (up to 4 players, customizable teams with mutually exclusive colors)
  if (!snapshot) {
    const team1Members = participants.filter(
      (p) => (lobbyState.assignments[p.playerId] ?? "team1") === "team1"
    );
    const team2Members = participants.filter(
      (p) => lobbyState.assignments[p.playerId] === "team2"
    );
    const myTeamId: TeamId =
      lobbyState.assignments[playerState.profile.id] ?? "team1";

    return (
      <div className="min-h-screen bg-[#141418]">
        <Navbar
          displayName={playerState.profile.displayName}
          coins={playerState.profile.coins}
          freePacks={playerState.profile.freePacks}
        />

        <main className="mx-auto max-w-6xl px-4 py-8">
          <section className="bg-[#16161B]">
            <div className="sheet-rule-h" />

            <div className="sheet-cell-edge-b flex flex-wrap items-center justify-between gap-4 p-6">
              <div>
                <h1 className="text-2xl font-bold text-[#ECEAE4] sm:text-3xl">
                  Sala por Equipos · {startValidation.modeLabel}
                </h1>
                <p className="mt-1 font-mono text-xs text-[#52FF2E]">
                  {isHost
                    ? "ROL: HOST AUTORITATIVO (SERVIDOR)"
                    : "ROL: JUGADOR INVITADO"}
                </p>
              </div>

              <div className="blueprint-dots flex items-center gap-4 border border-[#D47E3F]/50 px-4 py-2.5">
                <div>
                  <div className="font-mono text-[10px] font-bold text-[#8E8D86] uppercase">
                    Código de Sala (Máx 4)
                  </div>
                  <div className="font-mono text-2xl font-bold tracking-widest text-[#EB9C5C]">
                    {room.code}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="border border-[#3A3D4A] bg-[#1B1C22] px-3 py-1.5 font-mono text-xs font-bold text-[#ECEAE4] uppercase hover:border-[#52FF2E] hover:text-[#52FF2E]"
                >
                  {copiedCode ? "Copiado" : "Copiar"}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2">
              <div className="sheet-cell-edge-b sheet-cell-edge-r p-6">
                <TeamLobbyCard
                  team={lobbyState.teams.team1}
                  otherTeamColor={lobbyState.teams.team2.colorKey}
                  members={team1Members}
                  isMember={myTeamId === "team1"}
                  canEdit={isHost || myTeamId === "team1"}
                  canJoin={myTeamId !== "team1" && team1Members.length < 2}
                  onJoin={() =>
                    dispatchLobbyAction({
                      type: "switch_team",
                      playerId: playerState.profile.id,
                      targetTeam: "team1",
                    })
                  }
                  onColorChange={(colorKey) =>
                    dispatchLobbyAction({
                      type: "set_team_color",
                      teamId: "team1",
                      colorKey,
                    })
                  }
                  onNameChange={(name) =>
                    dispatchLobbyAction({
                      type: "set_team_name",
                      teamId: "team1",
                      name,
                    })
                  }
                />
              </div>

              <div className="sheet-cell-edge-b p-6">
                <TeamLobbyCard
                  team={lobbyState.teams.team2}
                  otherTeamColor={lobbyState.teams.team1.colorKey}
                  members={team2Members}
                  isMember={myTeamId === "team2"}
                  canEdit={isHost || myTeamId === "team2"}
                  canJoin={myTeamId !== "team2" && team2Members.length < 2}
                  onJoin={() =>
                    dispatchLobbyAction({
                      type: "switch_team",
                      playerId: playerState.profile.id,
                      targetTeam: "team2",
                    })
                  }
                  onColorChange={(colorKey) =>
                    dispatchLobbyAction({
                      type: "set_team_color",
                      teamId: "team2",
                      colorKey,
                    })
                  }
                  onNameChange={(name) =>
                    dispatchLobbyAction({
                      type: "set_team_name",
                      teamId: "team2",
                      name,
                    })
                  }
                />
              </div>
            </div>

            <div className="sheet-cell-edge-b flex flex-wrap items-center justify-between gap-4 p-6">
              <div className="space-y-0.5">
                <p className="font-mono text-sm font-bold text-[#ECEAE4]">
                  {startValidation.reason}
                </p>
                <p className="font-mono text-xs text-[#8E8D86]">
                  2 jugadores = 1 vs 1 · 3 jugadores = espera al 4.º · 4 jugadores = 2 vs 2
                </p>
              </div>

              {isHost && (
                <button
                  type="button"
                  disabled={!startValidation.canStart}
                  onClick={handleStartMatch}
                  className="bg-[#52FF2E] px-6 py-3 font-mono text-xs font-bold tracking-widest text-[#121216] uppercase transition hover:bg-[#32C81E] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  Iniciar Combate (Pantalla Completa)
                </button>
              )}
            </div>
          </section>
        </main>
      </div>
    );
  }

  const myFighter = snapshot.fighters.find(
    (f) => f.playerId === playerState.profile.id
  );
  const activeFighter = snapshot.fighters.find(
    (f) => f.playerId === snapshot.activePlayerId
  );
  const isMyTurn =
    snapshot.phase === "aiming" &&
    snapshot.activePlayerId === playerState.profile.id;
  const team1Fighters = snapshot.fighters.filter((f) => f.teamId === "team1");
  const team2Fighters = snapshot.fighters.filter((f) => f.teamId === "team2");
  const winningTeamConfig = snapshot.winnerTeamId
    ? snapshot.teams[snapshot.winnerTeamId]
    : null;

  // Fullscreen 100vw x 100vh Immersive Game View (palette adapted, layout preserved)
  return (
    <div
      ref={arenaShellRef}
      className="fixed inset-0 z-50 h-screen w-screen overflow-hidden bg-[#121318] select-none"
    >
      <ArenaCanvas
        snapshot={snapshot}
        localPlayerId={playerState.profile.id}
        chargePower={chargePower}
        recenterNonce={recenterNonce}
        resetViewNonce={resetViewNonce}
      />

      {/* Top Floating Team HUD */}
      <header className="pointer-events-none absolute top-3 right-3 left-3 z-20 flex flex-wrap items-start justify-between gap-3">
        <div className="pointer-events-auto flex flex-1 items-center gap-3 border border-[#D47E3F]/35 bg-[#15151A]/90 px-4 py-2.5 shadow-xl backdrop-blur md:max-w-3xl">
          <div className="flex-1">
            <TeamHudCard
              team={snapshot.teams.team1}
              fighters={team1Fighters}
              activePlayerId={snapshot.activePlayerId}
              align="left"
            />
          </div>

          <div className="px-2 text-center">
            <div
              className={`inline-block px-3 py-0.5 font-mono text-[11px] font-bold tracking-wider ${
                snapshot.phase === "finished"
                  ? "bg-[#D47E3F]/25 text-[#EB9C5C]"
                  : isMyTurn
                    ? "bg-[#52FF2E]/20 text-[#52FF2E] ring-1 ring-[#52FF2E]/60"
                    : "bg-[#22242C] text-[#B0AEA6]"
              }`}
            >
              {snapshot.phase === "finished"
                ? "FINALIZADO"
                : isMyTurn
                  ? "TU TURNO"
                  : `TURNO: ${activeFighter?.displayName ?? "RIVAL"}`}
            </div>
            <div className="mt-0.5 font-mono text-xl font-bold text-[#ECEAE4] tabular-nums">
              {Math.ceil(snapshot.turnSecondsLeft)}s
            </div>
            <div className="font-mono text-[10px] text-[#8E8D86]">
              T#{snapshot.turnNumber} · {room.code}
            </div>
          </div>

          <div className="flex-1">
            <TeamHudCard
              team={snapshot.teams.team2}
              fighters={team2Fighters}
              activePlayerId={snapshot.activePlayerId}
              align="right"
            />
          </div>
        </div>

        {/* Utility Floating Buttons */}
        <div className="pointer-events-auto flex items-center gap-1.5 border border-[#D47E3F]/35 bg-[#15151A]/90 p-1.5 shadow-xl backdrop-blur">
          <button
            type="button"
            onClick={() => setResetViewNonce((n) => n + 1)}
            className="px-2.5 py-1.5 font-mono text-xs font-bold text-[#ECEAE4] hover:bg-[#22242C]"
            title="Centrar camara y restablecer zoom al 100%"
          >
            Centrar
          </button>
          <button
            type="button"
            onClick={() => setMuted(soundEngine.toggleMute())}
            className="px-2.5 py-1.5 font-mono text-xs font-bold text-[#B0AEA6] hover:bg-[#22242C]"
          >
            {muted ? "Audio: OFF" : "Audio: ON"}
          </button>
          <button
            type="button"
            onClick={toggleBrowserFullscreen}
            className="px-2.5 py-1.5 font-mono text-xs font-bold text-[#52FF2E] hover:bg-[#22242C]"
          >
            {isFullscreen ? "Ventana" : "Pantalla Completa"}
          </button>
          <Link
            href="/menu"
            className="px-2.5 py-1.5 font-mono text-xs font-bold text-[#E84A5F] hover:bg-[#E84A5F]/15"
          >
            Salir
          </Link>
        </div>
      </header>

      {/* Bottom Floating Tactical Controls (including Shift Jump) */}
      {snapshot.phase !== "finished" && myFighter && (
        <footer className="pointer-events-none absolute right-3 bottom-3 left-3 z-20 flex justify-center">
          <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-2.5 border border-[#D47E3F]/40 bg-[#15151A]/90 px-4 py-2.5 shadow-2xl backdrop-blur">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={!isMyTurn}
                onClick={() => sendCommand({ type: "move", direction: -1 })}
                className="border border-[#3A3D4A] bg-[#1B1C22] px-3 py-2 font-mono text-xs font-bold text-[#ECEAE4] hover:border-[#52FF2E] disabled:opacity-40"
              >
                ← A
              </button>
              <button
                type="button"
                disabled={!isMyTurn}
                onClick={() => sendCommand({ type: "move", direction: 1 })}
                className="border border-[#3A3D4A] bg-[#1B1C22] px-3 py-2 font-mono text-xs font-bold text-[#ECEAE4] hover:border-[#52FF2E] disabled:opacity-40"
              >
                D →
              </button>
              <button
                type="button"
                disabled={!isMyTurn || !myFighter.grounded}
                onClick={() => sendCommand({ type: "jump" })}
                className="border border-[#D47E3F]/60 bg-[#D47E3F]/20 px-3 py-2 font-mono text-xs font-bold text-[#EB9C5C] hover:bg-[#D47E3F]/30 disabled:opacity-40"
              >
                Saltar (SHIFT)
              </button>
              <button
                type="button"
                disabled={!isMyTurn}
                onClick={() =>
                  sendCommand({
                    type: "aim",
                    angleDeg: myFighter.aimAngleDeg + 5,
                  })
                }
                className="border border-[#3A3D4A] bg-[#1B1C22] px-2.5 py-2 font-mono text-xs font-bold text-[#ECEAE4] hover:border-[#D47E3F] disabled:opacity-40"
              >
                ↑ W
              </button>
              <button
                type="button"
                disabled={!isMyTurn}
                onClick={() =>
                  sendCommand({
                    type: "aim",
                    angleDeg: myFighter.aimAngleDeg - 5,
                  })
                }
                className="border border-[#3A3D4A] bg-[#1B1C22] px-2.5 py-2 font-mono text-xs font-bold text-[#ECEAE4] hover:border-[#D47E3F] disabled:opacity-40"
              >
                ↓ S
              </button>
            </div>

            <ArtilleryDialGauge
              aimAngleDeg={myFighter.aimAngleDeg}
              chargePower={chargePower}
            />

            <div className="flex items-center gap-2.5">
              <div className="font-mono text-[11px] text-[#B0AEA6] tabular-nums">
                Energia:{" "}
                <strong className="text-[#52FF2E]">
                  {myFighter.moveEnergyLeft}
                </strong>
              </div>
              <button
                type="button"
                disabled={!isMyTurn}
                onMouseDown={beginCharge}
                onMouseUp={releaseFire}
                onMouseLeave={releaseFire}
                onTouchStart={beginCharge}
                onTouchEnd={releaseFire}
                className="bg-[#D47E3F] px-5 py-2.5 font-mono text-xs font-bold text-[#121216] uppercase shadow-lg transition hover:bg-[#EB9C5C] disabled:opacity-40"
              >
                Mantener: Disparar (ESPACIO)
              </button>
            </div>
          </div>
        </footer>
      )}

      {/* Team Victory Overlay */}
      {snapshot.phase === "finished" && winningTeamConfig && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#121216]/80 p-4 backdrop-blur-sm">
          <div
            className="max-w-md border-2 bg-[#15151A] p-7 text-center shadow-2xl"
            style={{ borderColor: winningTeamConfig.hex }}
          >
            <div
              className="font-mono text-xs font-bold tracking-widest uppercase"
              style={{ color: winningTeamConfig.hex }}
            >
              {myFighter?.teamId === snapshot.winnerTeamId
                ? "¡Victoria de tu equipo!"
                : "Equipo Ganador"}
            </div>
            <h2
              className="mt-1 text-3xl font-bold"
              style={{ color: winningTeamConfig.hex }}
            >
              {winningTeamConfig.name}
            </h2>
            {rewardMessage && (
              <p className="mt-2 font-mono text-xs font-bold text-[#52FF2E]">
                {rewardMessage}
              </p>
            )}
            <div className="mt-6 flex justify-center gap-3">
              <Link
                href="/gacha"
                className="bg-[#D47E3F] px-5 py-2.5 font-mono text-xs font-bold text-[#121216] uppercase hover:bg-[#EB9C5C]"
              >
                Abrir Sobres TCG
              </Link>
              <Link
                href="/menu"
                className="border border-[#3A3D4A] px-5 py-2.5 font-mono text-xs font-bold text-[#ECEAE4] uppercase hover:border-[#52FF2E]"
              >
                Volver al Menú
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface TeamLobbyCardProps {
  team: TeamConfig;
  otherTeamColor: TeamColorKey;
  members: RoomPresencePayload[];
  isMember: boolean;
  canEdit: boolean;
  canJoin: boolean;
  onJoin: () => void;
  onColorChange: (colorKey: TeamColorKey) => void;
  onNameChange: (name: string) => void;
}

function TeamLobbyCard({
  team,
  otherTeamColor,
  members,
  isMember,
  canEdit,
  canJoin,
  onJoin,
  onColorChange,
  onNameChange,
}: TeamLobbyCardProps) {
  return (
    <div
      className="space-y-4 border bg-[#15151A] p-4"
      style={{ borderColor: `${team.hex}88` }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-1 items-center gap-2">
          <span
            className="h-3.5 w-3.5 shrink-0"
            style={{ backgroundColor: team.hex }}
          />
          <input
            type="text"
            maxLength={18}
            disabled={!canEdit}
            value={team.name}
            onChange={(e) => onNameChange(e.target.value)}
            aria-label={`Nombre del ${team.name}`}
            className="w-full border border-[#2E313D] bg-[#141418] px-2.5 py-1 font-display text-sm font-bold text-[#ECEAE4] outline-none focus:border-[#52FF2E] disabled:opacity-75"
          />
        </div>

        <span className="border border-[#3A3D4A] bg-[#1B1C22] px-2.5 py-0.5 font-mono text-[11px] font-bold text-[#ECEAE4] tabular-nums">
          {members.length}/2
        </span>
      </div>

      {/* Exclusive color selector */}
      <div className="space-y-1.5">
        <div className="font-mono text-[10px] font-bold tracking-wider text-[#8E8D86] uppercase">
          Color del Equipo (Exclusivo)
        </div>
        <div className="flex flex-wrap gap-2">
          {TEAM_COLOR_PALETTE.map((option) => {
            const isSelected = team.colorKey === option.key;
            const takenByOther = otherTeamColor === option.key;
            return (
              <button
                key={option.key}
                type="button"
                disabled={!canEdit || takenByOther}
                onClick={() => onColorChange(option.key)}
                title={takenByOther ? "En uso por el otro equipo" : option.label}
                className={`flex items-center gap-1.5 border px-2.5 py-1 font-mono text-[11px] font-bold transition ${
                  isSelected
                    ? "border-[#ECEAE4] bg-[#22242C] text-[#ECEAE4]"
                    : takenByOther
                      ? "cursor-not-allowed border-[#252731] bg-[#141418] text-[#5C5E6B] line-through"
                      : "border-[#2E313D] bg-[#141418] text-[#B0AEA6] hover:border-[#D47E3F]"
                }`}
              >
                <span
                  className="h-2.5 w-2.5"
                  style={{ backgroundColor: option.hex }}
                />
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Team member slots (max 2) */}
      <div className="grid gap-2.5 sm:grid-cols-2">
        {[0, 1].map((slotIdx) => {
          const member = members[slotIdx];
          if (!member) {
            return (
              <div
                key={slotIdx}
                className="flex h-24 items-center justify-center border border-dashed border-[#2E313D] font-mono text-xs text-[#8E8D86]"
              >
                Espacio libre ({slotIdx === 0 ? "1v1 / 2v2" : "2v2"})
              </div>
            );
          }

          return (
            <div
              key={member.playerId}
              className="flex items-center gap-2.5 border border-[#2E313D] bg-[#1B1C22] p-2"
            >
              <LobbyCreaturePreview
                appearance={member.appearance}
                teamColor={team.hex}
                facing={team.id === "team1" ? 1 : -1}
              />
              <div className="min-w-0 font-mono tabular-nums">
                <div className="truncate font-display text-xs font-bold text-[#ECEAE4]">
                  {member.displayName}
                </div>
                <div className="text-[10px] text-[#B0AEA6]">
                  HP {member.stats.maxHp} · ATK {member.stats.attack}
                </div>
                <div className="text-[10px] text-[#8E8D86]">
                  DEF {member.stats.defense} · MOV {member.stats.mobility}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-end">
        {isMember ? (
          <span className="font-mono text-[11px] font-bold text-[#52FF2E] uppercase">
            Estás en este equipo
          </span>
        ) : (
          <button
            type="button"
            disabled={!canJoin}
            onClick={onJoin}
            className="border border-[#D47E3F] bg-[#1B1C22] px-3 py-1.5 font-mono text-xs font-bold text-[#EB9C5C] uppercase hover:bg-[#D47E3F]/15 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {members.length >= 2 ? "Equipo lleno" : "Unirme a este equipo"}
          </button>
        )}
      </div>
    </div>
  );
}

function LobbyCreaturePreview({
  appearance,
  teamColor,
  facing,
}: {
  appearance: CreatureAppearance;
  teamColor: string;
  facing: 1 | -1;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawAssembledCreature(ctx, {
      x: canvas.width / 2,
      y: canvas.height - 8,
      facing,
      aimAngleDeg: 40,
      appearance,
      teamColor,
      scale: 1.15,
      timeSec: 0,
      isAlive: true,
    });
  }, [appearance, teamColor, facing]);

  return <canvas ref={canvasRef} width={76} height={80} className="shrink-0" />;
}

function TeamHudCard({
  team,
  fighters,
  activePlayerId,
  align,
}: {
  team: TeamConfig;
  fighters: MatchSnapshot["fighters"];
  activePlayerId: string;
  align: "left" | "right";
}) {
  const totalHp = fighters.reduce((acc, f) => acc + Math.max(0, f.hp), 0);
  const totalMaxHp = Math.max(
    1,
    fighters.reduce((acc, f) => acc + f.maxHp, 0)
  );
  const pct = Math.max(0, Math.min(100, Math.round((totalHp / totalMaxHp) * 100)));

  return (
    <div className={align === "right" ? "text-right" : "text-left"}>
      <div
        className="truncate font-display text-xs font-bold sm:text-sm"
        style={{ color: team.hex }}
      >
        {team.name}{" "}
        <span className="font-mono text-[11px] font-semibold text-[#B0AEA6] tabular-nums">
          ({totalHp}/{totalMaxHp})
        </span>
      </div>
      <div className="mt-1 h-2.5 overflow-hidden bg-[#22242C]">
        <div
          className="h-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: team.hex }}
        />
      </div>
      <div
        className={`mt-1 flex flex-wrap gap-1.5 font-mono text-[10px] tabular-nums ${
          align === "right" ? "justify-end" : "justify-start"
        }`}
      >
        {fighters.map((fighter) => (
          <span
            key={fighter.playerId}
            className={`px-1.5 py-0.5 font-bold ${
              fighter.playerId === activePlayerId
                ? "bg-[#D47E3F]/25 text-[#EB9C5C] ring-1 ring-[#D47E3F]/60"
                : "bg-[#1B1C22] text-[#B0AEA6]"
            }`}
          >
            {fighter.displayName}: {fighter.hp}
          </span>
        ))}
      </div>
    </div>
  );
}
