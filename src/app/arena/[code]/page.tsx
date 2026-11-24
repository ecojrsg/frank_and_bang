"use client";

// @Author: Jonathan Serna
// @Date:   2026-11-23 21:06:00
// @Last Modified by:   Jonathan Serna
// @Last Modified time: 2026-11-23 22:26:00

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
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-sm text-rose-300">{errorMessage}</p>
        <Link
          href="/menu"
          className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-slate-950"
        >
          Volver al Menu
        </Link>
      </main>
    );
  }

  if (!playerState || !room) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6 text-sm text-slate-300">
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
      <div className="min-h-screen">
        <Navbar
          displayName={playerState.profile.displayName}
          coins={playerState.profile.coins}
          freePacks={playerState.profile.freePacks}
        />

        <main className="mx-auto max-w-6xl px-4 py-8">
          <section className="rounded-2xl border border-emerald-500/40 bg-slate-900/90 p-6 shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-widest text-emerald-300">
                  {isHost
                    ? "Eres el Host (Servidor de la Partida)"
                    : "Conectado como Invitado"}
                </span>
                <h1 className="mt-1 text-2xl font-black text-white">
                  Sala por Equipos · {startValidation.modeLabel}
                </h1>
              </div>

              <div className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5">
                <div>
                  <div className="text-[10px] font-bold uppercase text-slate-400">
                    Codigo de Sala (Max 4)
                  </div>
                  <div className="font-mono text-2xl font-black tracking-widest text-emerald-300">
                    {room.code}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-bold text-slate-200 hover:border-emerald-400"
                >
                  {copiedCode ? "Copiado" : "Copiar"}
                </button>
              </div>
            </div>

            <div className="mt-6 grid gap-5 lg:grid-cols-2">
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

            <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-slate-800 pt-5">
              <div className="space-y-0.5">
                <p className="text-sm font-semibold text-white">
                  {startValidation.reason}
                </p>
                <p className="text-xs text-slate-400">
                  2 jugadores = 1 vs 1 · 3 jugadores = espera al 4.º · 4 jugadores = 2 vs 2
                </p>
              </div>

              {isHost && (
                <button
                  type="button"
                  disabled={!startValidation.canStart}
                  onClick={handleStartMatch}
                  className="rounded-xl bg-emerald-500 px-6 py-3 text-sm font-black text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-45"
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

  // Fullscreen 100vw x 100vh Immersive Game View
  return (
    <div
      ref={arenaShellRef}
      className="fixed inset-0 z-50 h-screen w-screen overflow-hidden bg-slate-950 select-none"
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
        <div className="pointer-events-auto flex flex-1 items-center gap-3 rounded-2xl border border-slate-700/70 bg-slate-950/85 px-4 py-2.5 shadow-xl backdrop-blur md:max-w-3xl">
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
              className={`inline-block rounded-full px-3 py-0.5 text-[11px] font-black tracking-wider ${
                snapshot.phase === "finished"
                  ? "bg-amber-400/20 text-amber-200"
                  : isMyTurn
                    ? "bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-400/50"
                    : "bg-slate-800 text-slate-300"
              }`}
            >
              {snapshot.phase === "finished"
                ? "FINALIZADO"
                : isMyTurn
                  ? "TU TURNO"
                  : `TURNO: ${activeFighter?.displayName ?? "RIVAL"}`}
            </div>
            <div className="mt-0.5 font-mono text-xl font-black text-white">
              {Math.ceil(snapshot.turnSecondsLeft)}s
            </div>
            <div className="text-[10px] text-slate-400">
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
        <div className="pointer-events-auto flex items-center gap-1.5 rounded-2xl border border-slate-700/70 bg-slate-950/85 p-1.5 shadow-xl backdrop-blur">
          <button
            type="button"
            onClick={() => setResetViewNonce((n) => n + 1)}
            className="rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-200 hover:bg-slate-800"
            title="Centrar camara y restablecer zoom al 100%"
          >
            Centrar
          </button>
          <button
            type="button"
            onClick={() => setMuted(soundEngine.toggleMute())}
            className="rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-200 hover:bg-slate-800"
          >
            {muted ? "Audio: OFF" : "Audio: ON"}
          </button>
          <button
            type="button"
            onClick={toggleBrowserFullscreen}
            className="rounded-xl px-2.5 py-1.5 text-xs font-bold text-emerald-300 hover:bg-slate-800"
          >
            {isFullscreen ? "Ventana" : "Pantalla Completa"}
          </button>
          <Link
            href="/menu"
            className="rounded-xl px-2.5 py-1.5 text-xs font-bold text-rose-300 hover:bg-rose-500/20"
          >
            Salir
          </Link>
        </div>
      </header>

      {/* Bottom Floating Tactical Controls (including Shift Jump) */}
      {snapshot.phase !== "finished" && myFighter && (
        <footer className="pointer-events-none absolute right-3 bottom-3 left-3 z-20 flex justify-center">
          <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-2.5 rounded-2xl border border-slate-700/75 bg-slate-950/85 px-4 py-2.5 shadow-2xl backdrop-blur">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={!isMyTurn}
                onClick={() => sendCommand({ type: "move", direction: -1 })}
                className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:border-emerald-400 disabled:opacity-40"
              >
                ← A
              </button>
              <button
                type="button"
                disabled={!isMyTurn}
                onClick={() => sendCommand({ type: "move", direction: 1 })}
                className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:border-emerald-400 disabled:opacity-40"
              >
                D →
              </button>
              <button
                type="button"
                disabled={!isMyTurn || !myFighter.grounded}
                onClick={() => sendCommand({ type: "jump" })}
                className="rounded-xl border border-violet-400/50 bg-violet-500/20 px-3 py-2 text-xs font-bold text-violet-200 hover:bg-violet-500/30 disabled:opacity-40"
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
                className="rounded-xl border border-slate-700 bg-slate-900 px-2.5 py-2 text-xs font-bold text-white hover:border-sky-400 disabled:opacity-40"
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
                className="rounded-xl border border-slate-700 bg-slate-900 px-2.5 py-2 text-xs font-bold text-white hover:border-sky-400 disabled:opacity-40"
              >
                ↓ S
              </button>
            </div>

            <ArtilleryDialGauge
              aimAngleDeg={myFighter.aimAngleDeg}
              chargePower={chargePower}
            />

            <div className="flex items-center gap-2.5">
              <div className="text-[11px] text-slate-300">
                Energia:{" "}
                <strong className="text-violet-300">
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
                className="rounded-xl bg-amber-400 px-5 py-2.5 text-xs font-black text-slate-950 shadow-lg shadow-amber-400/20 transition hover:bg-amber-300 disabled:opacity-40"
              >
                Mantener: Disparar (ESPACIO)
              </button>
            </div>
          </div>
        </footer>
      )}

      {/* Team Victory Overlay */}
      {snapshot.phase === "finished" && winningTeamConfig && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div
            className="max-w-md rounded-2xl border-2 bg-slate-900 p-7 text-center shadow-2xl"
            style={{ borderColor: winningTeamConfig.hex }}
          >
            <div
              className="text-xs font-black uppercase tracking-widest"
              style={{ color: winningTeamConfig.hex }}
            >
              {myFighter?.teamId === snapshot.winnerTeamId
                ? "¡Victoria de tu equipo!"
                : "Equipo Ganador"}
            </div>
            <h2
              className="mt-1 text-3xl font-black"
              style={{ color: winningTeamConfig.hex }}
            >
              {winningTeamConfig.name}
            </h2>
            {rewardMessage && (
              <p className="mt-2 text-sm font-semibold text-emerald-300">
                {rewardMessage}
              </p>
            )}
            <div className="mt-6 flex justify-center gap-3">
              <Link
                href="/gacha"
                className="rounded-xl bg-amber-400 px-5 py-2.5 text-sm font-black text-slate-950 hover:bg-amber-300"
              >
                Abrir Sobres TCG
              </Link>
              <Link
                href="/menu"
                className="rounded-xl border border-slate-700 px-5 py-2.5 text-sm font-bold text-white hover:border-emerald-400"
              >
                Volver al Menu
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
      className="space-y-4 rounded-2xl border-2 bg-slate-950/80 p-4"
      style={{ borderColor: `${team.hex}88` }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-1 items-center gap-2">
          <span
            className="h-3.5 w-3.5 shrink-0 rounded-full"
            style={{ backgroundColor: team.hex }}
          />
          <input
            type="text"
            maxLength={18}
            disabled={!canEdit}
            value={team.name}
            onChange={(e) => onNameChange(e.target.value)}
            aria-label={`Nombre del ${team.name}`}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-sm font-black text-white outline-none focus:border-white disabled:opacity-75"
          />
        </div>

        <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-[11px] font-bold text-slate-200">
          {members.length}/2
        </span>
      </div>

      {/* Exclusive color selector */}
      <div className="space-y-1.5">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
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
                className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-bold transition ${
                  isSelected
                    ? "border-white bg-slate-800 text-white"
                    : takenByOther
                      ? "cursor-not-allowed border-slate-800 bg-slate-900/40 text-slate-600 line-through"
                      : "border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500"
                }`}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
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
                className="flex h-24 items-center justify-center rounded-xl border border-dashed border-slate-800 text-xs text-slate-500"
              >
                Espacio libre ({slotIdx === 0 ? "1v1 / 2v2" : "2v2"})
              </div>
            );
          }

          return (
            <div
              key={member.playerId}
              className="flex items-center gap-2.5 rounded-xl border border-slate-800 bg-slate-900/90 p-2"
            >
              <LobbyCreaturePreview
                appearance={member.appearance}
                teamColor={team.hex}
                facing={team.id === "team1" ? 1 : -1}
              />
              <div className="min-w-0">
                <div className="truncate text-xs font-black text-white">
                  {member.displayName}
                </div>
                <div className="text-[10px] text-slate-400">
                  HP {member.stats.maxHp} · ATK {member.stats.attack}
                </div>
                <div className="text-[10px] text-slate-400">
                  DEF {member.stats.defense} · MOV {member.stats.mobility}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-end">
        {isMember ? (
          <span className="text-[11px] font-bold text-emerald-300">
            Estas en este equipo
          </span>
        ) : (
          <button
            type="button"
            disabled={!canJoin}
            onClick={onJoin}
            className="rounded-xl border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-bold text-white hover:border-white disabled:cursor-not-allowed disabled:opacity-40"
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
        className="truncate text-xs font-black sm:text-sm"
        style={{ color: team.hex }}
      >
        {team.name}{" "}
        <span className="text-[11px] font-semibold text-slate-300">
          ({totalHp}/{totalMaxHp})
        </span>
      </div>
      <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: team.hex }}
        />
      </div>
      <div
        className={`mt-1 flex flex-wrap gap-1.5 text-[10px] ${
          align === "right" ? "justify-end" : "justify-start"
        }`}
      >
        {fighters.map((fighter) => (
          <span
            key={fighter.playerId}
            className={`rounded px-1.5 py-0.5 font-semibold ${
              fighter.playerId === activePlayerId
                ? "bg-amber-400/20 text-amber-200 ring-1 ring-amber-400/50"
                : "bg-slate-900 text-slate-300"
            }`}
          >
            {fighter.displayName}: {fighter.hp}
          </span>
        ))}
      </div>
    </div>
  );
}
