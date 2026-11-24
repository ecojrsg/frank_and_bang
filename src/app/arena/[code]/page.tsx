"use client";

// @Author: Jonathan Serna
// @Date:   2026-11-23 21:06:00
// @Last Modified by:   Jonathan Serna
// @Last Modified time: 2026-11-23 21:06:00

/**
 * Multiplayer room lobby and live 2D Worms-style artillery battlefield
 * powered by Host-Authoritative state synchronization over Supabase Realtime.
 */

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";

import { Navbar } from "@/components/layout/Navbar";
import {
  applyPlayerCommand,
  createInitialMatchState,
  stepHostSimulation,
} from "@/domain/gameRoomHost";
import type { MatchSnapshot, PlayerCommand } from "@/domain/types";
import { ArenaCanvas } from "@/engine/ArenaCanvas";
import { createSupabaseBrowserClient } from "@/infrastructure/supabase/client";
import type { PlayerFullState } from "@/infrastructure/supabase/partsRepository";
import {
  extractRoomParticipants,
  getRoomChannelName,
  REALTIME_EVENTS,
  type InputCommandMessage,
  type RoomPresencePayload,
  type SnapshotBroadcastMessage,
} from "@/network/realtimeProtocol";

interface RoomRecord {
  code: string;
  host_user_id: string;
  guest_user_id: string | null;
  status: "waiting" | "playing" | "finished";
  terrain_seed: number;
}

export default function ArenaRoomPage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const roomCode = (params.code ?? "").toUpperCase();

  const [playerState, setPlayerState] = useState<PlayerFullState | null>(null);
  const [room, setRoom] = useState<RoomRecord | null>(null);
  const [hostPresence, setHostPresence] = useState<RoomPresencePayload | null>(null);
  const [guestPresence, setGuestPresence] = useState<RoomPresencePayload | null>(null);
  const [snapshot, setSnapshot] = useState<MatchSnapshot | null>(null);
  const [chargePower, setChargePower] = useState(0);
  const [copiedCode, setCopiedCode] = useState(false);
  const [rewardMessage, setRewardMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const snapshotRef = useRef<MatchSnapshot | null>(null);
  const chargingRef = useRef(false);
  const chargeValueRef = useRef(0);
  const rewardClaimedRef = useRef(false);

  const isHost =
    Boolean(playerState && room) && room?.host_user_id === playerState?.profile.id;

  // Keep ref mirrored for the 60 Hz host simulation loop.
  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

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

  // Broadcast authoritative snapshot from Host to Guest.
  const broadcastSnapshot = useCallback((nextSnapshot: MatchSnapshot) => {
    snapshotRef.current = nextSnapshot;
    setSnapshot(nextSnapshot);
    channelRef.current?.send({
      type: "broadcast",
      event: REALTIME_EVENTS.stateSnapshot,
      payload: { snapshot: nextSnapshot } satisfies SnapshotBroadcastMessage,
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

    const channel = supabase.channel(getRoomChannelName(room.code), {
      config: {
        presence: { key: playerState.profile.id },
      },
    });
    channelRef.current = channel;

    channel
      .on("presence", { event: "sync" }, () => {
        const rawState = channel.presenceState() as Record<string, unknown[]>;
        const { host, guest } = extractRoomParticipants(rawState);
        setHostPresence(host);
        setGuestPresence(guest);
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
            stats: playerState.stats,
            rarityAccent: playerState.highestRarity,
          };
          await channel.track(presencePayload);
        }
      });

    return () => {
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [playerState, room, broadcastSnapshot]);

  // 3. Host-Authoritative simulation loop (ticks timer & grenade physics).
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
      const shouldBroadcast =
        phaseChanged ||
        turnChanged ||
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

  // 4. Claim match reward coins once the match finishes.
  useEffect(() => {
    if (
      !snapshot ||
      snapshot.phase !== "finished" ||
      !snapshot.winnerPlayerId ||
      rewardClaimedRef.current
    ) {
      return;
    }

    rewardClaimedRef.current = true;
    fetch(`/api/rooms/${roomCode}/finish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ winnerPlayerId: snapshot.winnerPlayerId }),
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
  }, [snapshot, roomCode]);

  // Send a player command locally (Host) or over Realtime Broadcast (Guest).
  const sendCommand = useCallback(
    (command: PlayerCommand) => {
      if (!playerState || !snapshotRef.current) {
        return;
      }
      if (snapshotRef.current.activePlayerId !== playerState.profile.id) {
        return;
      }

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

  // Charge power bar smoothly while holding Space or the Fire button.
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!chargingRef.current) {
        return;
      }
      const nextPower = Math.min(1, chargeValueRef.current + 0.04);
      chargeValueRef.current = nextPower;
      setChargePower(nextPower);
    }, 35);

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

  // Keyboard controls for smooth desktop gameplay.
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

  function handleStartMatch() {
    if (!isHost || !room || !hostPresence || !guestPresence) {
      return;
    }
    const initial = createInitialMatchState(
      room.code,
      room.terrain_seed,
      hostPresence,
      guestPresence
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

  const myFighter = snapshot?.fighters.find(
    (f) => f.playerId === playerState.profile.id
  );
  const isMyTurn =
    snapshot?.phase === "aiming" &&
    snapshot.activePlayerId === playerState.profile.id;
  const winnerFighter = snapshot?.fighters.find(
    (f) => f.playerId === snapshot.winnerPlayerId
  );

  return (
    <div className="min-h-screen">
      <Navbar
        displayName={playerState.profile.displayName}
        coins={playerState.profile.coins}
        freePacks={playerState.profile.freePacks}
      />

      <main className="mx-auto max-w-6xl space-y-5 px-4 py-6">
        {/* Waiting Lobby */}
        {!snapshot && (
          <section className="rounded-2xl border border-emerald-500/40 bg-slate-900/90 p-6 shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-widest text-emerald-300">
                  {isHost
                    ? "Eres el Host (Servidor de la Partida)"
                    : "Conectado como Invitado"}
                </span>
                <h1 className="mt-1 text-2xl font-black text-white">
                  Sala de Combate
                </h1>
              </div>

              <div className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5">
                <div>
                  <div className="text-[10px] font-bold uppercase text-slate-400">
                    Codigo de Sala
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

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <LobbyParticipantCard
                title="Jugador 1 (Host / Servidor)"
                participant={hostPresence}
                accent="emerald"
              />
              <LobbyParticipantCard
                title="Jugador 2 (Invitado)"
                participant={guestPresence}
                accent="sky"
              />
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-slate-800 pt-5">
              <p className="text-xs text-slate-300">
                {hostPresence && guestPresence
                  ? isHost
                    ? "Ambos jugadores estan listos. Pulsa Iniciar Combate."
                    : "Esperando a que el Host inicie la partida..."
                  : "Comparte el codigo de 6 caracteres con otro jugador en otra computadora."}
              </p>

              {isHost && (
                <button
                  type="button"
                  disabled={!hostPresence || !guestPresence}
                  onClick={handleStartMatch}
                  className="rounded-xl bg-emerald-500 px-6 py-3 text-sm font-black text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  Iniciar Combate
                </button>
              )}
            </div>
          </section>
        )}

        {/* Active Match Arena */}
        {snapshot && (
          <section className="space-y-4">
            {/* Top HUD */}
            <div className="grid items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/90 p-4 md:grid-cols-3">
              {snapshot.fighters[0] && (
                <FighterHudCard fighter={snapshot.fighters[0]} align="left" />
              )}

              <div className="text-center">
                <div
                  className={`inline-block rounded-full px-4 py-1 text-xs font-black tracking-wider ${
                    snapshot.phase === "finished"
                      ? "bg-amber-400/20 text-amber-200"
                      : isMyTurn
                        ? "bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-400/50"
                        : "bg-slate-800 text-slate-300"
                  }`}
                >
                  {snapshot.phase === "finished"
                    ? "COMBATE FINALIZADO"
                    : isMyTurn
                      ? "TU TURNO"
                      : "TURNO DEL RIVAL"}
                </div>
                <div className="mt-1 font-mono text-2xl font-black text-white">
                  {Math.ceil(snapshot.turnSecondsLeft)}s
                </div>
                <div className="text-[11px] text-slate-400">
                  Turno #{snapshot.turnNumber} · Sala {room.code}
                </div>
              </div>

              {snapshot.fighters[1] && (
                <FighterHudCard fighter={snapshot.fighters[1]} align="right" />
              )}
            </div>

            <ArenaCanvas
              snapshot={snapshot}
              localPlayerId={playerState.profile.id}
              chargePower={chargePower}
            />

            {/* Controls bar */}
            {snapshot.phase !== "finished" && myFighter && (
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/90 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={!isMyTurn}
                    onClick={() => sendCommand({ type: "move", direction: -1 })}
                    className="rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs font-bold text-white hover:border-emerald-400 disabled:opacity-40"
                  >
                    ← Mover (A)
                  </button>
                  <button
                    type="button"
                    disabled={!isMyTurn}
                    onClick={() => sendCommand({ type: "move", direction: 1 })}
                    className="rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs font-bold text-white hover:border-emerald-400 disabled:opacity-40"
                  >
                    Mover (D) →
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
                    className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-bold text-white hover:border-sky-400 disabled:opacity-40"
                  >
                    Angulo + (W)
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
                    className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-bold text-white hover:border-sky-400 disabled:opacity-40"
                  >
                    Angulo - (S)
                  </button>
                  <span className="ml-2 text-xs text-slate-300">
                    Angulo: <strong>{myFighter.aimAngleDeg}°</strong> · Energia:{" "}
                    <strong>{myFighter.moveEnergyLeft}</strong>
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-28">
                    <div className="mb-1 flex justify-between text-[10px] font-bold text-amber-300">
                      <span>POTENCIA</span>
                      <span>{Math.round(chargePower * 100)}%</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-400 via-amber-400 to-rose-500 transition-all"
                        style={{ width: `${Math.round(chargePower * 100)}%` }}
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={!isMyTurn}
                    onMouseDown={beginCharge}
                    onMouseUp={releaseFire}
                    onMouseLeave={releaseFire}
                    onTouchStart={beginCharge}
                    onTouchEnd={releaseFire}
                    className="rounded-xl bg-amber-400 px-5 py-2.5 text-xs font-black text-slate-950 shadow-lg transition hover:bg-amber-300 disabled:opacity-40"
                  >
                    Mantener: Lanzar Granada (ESPACIO)
                  </button>
                </div>
              </div>
            )}

            {/* Victory Banner */}
            {snapshot.phase === "finished" && (
              <div className="rounded-2xl border border-amber-400/50 bg-gradient-to-r from-slate-900 via-amber-950/30 to-slate-900 p-6 text-center shadow-2xl">
                <h2 className="text-2xl font-black text-amber-300">
                  {winnerFighter?.playerId === playerState.profile.id
                    ? "¡Victoria en la Arena!"
                    : `Ganador: ${winnerFighter?.displayName ?? "Rival"}`}
                </h2>
                {rewardMessage && (
                  <p className="mt-1 text-sm font-semibold text-emerald-300">
                    {rewardMessage}
                  </p>
                )}
                <div className="mt-4 flex justify-center gap-3">
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
            )}
          </section>
        )}
      </main>
    </div>
  );
}

interface LobbyParticipantCardProps {
  title: string;
  participant: RoomPresencePayload | null;
  accent: "emerald" | "sky";
}

function LobbyParticipantCard({
  title,
  participant,
  accent,
}: LobbyParticipantCardProps) {
  const borderClass =
    accent === "emerald" ? "border-emerald-500/40" : "border-sky-500/40";
  return (
    <div className={`rounded-xl border ${borderClass} bg-slate-950/70 p-4`}>
      <div className="text-xs font-bold uppercase text-slate-400">{title}</div>
      {participant ? (
        <div className="mt-2 space-y-2">
          <div className="text-lg font-black text-white">
            {participant.displayName}
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded bg-slate-800 px-2 py-0.5 text-emerald-300">
              HP {participant.stats.maxHp}
            </span>
            <span className="rounded bg-slate-800 px-2 py-0.5 text-rose-300">
              ATK {participant.stats.attack}
            </span>
            <span className="rounded bg-slate-800 px-2 py-0.5 text-sky-300">
              DEF {participant.stats.defense}
            </span>
            <span className="rounded bg-slate-800 px-2 py-0.5 text-violet-300">
              MOV {participant.stats.mobility}
            </span>
          </div>
        </div>
      ) : (
        <div className="mt-3 text-sm text-slate-400">
          Esperando conexion...
        </div>
      )}
    </div>
  );
}

function FighterHudCard({
  fighter,
  align,
}: {
  fighter: MatchSnapshot["fighters"][number];
  align: "left" | "right";
}) {
  const pct = Math.max(0, Math.min(100, Math.round((fighter.hp / fighter.maxHp) * 100)));
  const color = fighter.role === "host" ? "bg-emerald-400" : "bg-sky-400";
  return (
    <div className={align === "right" ? "text-right" : "text-left"}>
      <div className="text-sm font-black text-white">
        {fighter.displayName}{" "}
        <span className="text-xs font-semibold text-slate-400">
          ({fighter.hp}/{fighter.maxHp} HP)
        </span>
      </div>
      <div className="mt-1.5 h-3 overflow-hidden rounded-full bg-slate-800">
        <div
          className={`h-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-1 text-[11px] text-slate-400">
        ATK {fighter.attack} · DEF {fighter.defense} · MOV {fighter.mobility}
      </div>
    </div>
  );
}
