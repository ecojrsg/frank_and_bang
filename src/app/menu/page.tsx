"use client";

// @Author: Jonathan Serna
// @Date:   2026-11-23 21:03:00
// @Last Modified by:   Jonathan Serna
// @Last Modified time: 2026-11-23 23:36:00

/**
 * Main command hub after authentication: create/join multiplayer lobbies,
 * launch Gacha TCG pack openings, inspect assembled creature, and explore
 * the 5-column technical blueprint architecture sheet.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { BlueprintSheetSection } from "@/components/blueprint/BlueprintSheetSection";
import { Navbar } from "@/components/layout/Navbar";
import { PartArtwork } from "@/components/parts/PartArtwork";
import type { Loadout } from "@/domain/types";
import {
  buildAppearanceFromLoadout,
  drawAssembledCreature,
} from "@/engine/creatureRenderer";
import type { PlayerFullState } from "@/infrastructure/supabase/partsRepository";

export default function MenuPage() {
  const router = useRouter();
  const [state, setState] = useState<PlayerFullState | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [roomError, setRoomError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyRoom, setBusyRoom] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await fetch("/api/profile");
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        const data = (await res.json()) as PlayerFullState & { error?: string };
        if (!res.ok) {
          throw new Error(data.error ?? "No se pudo cargar tu perfil.");
        }
        setState(data);
      } catch (error) {
        setRoomError(
          error instanceof Error ? error.message : "Error cargando perfil."
        );
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [router]);

  async function handleCreateRoom() {
    setRoomError(null);
    setBusyRoom(true);
    try {
      const res = await fetch("/api/rooms", { method: "POST" });
      const data = (await res.json()) as {
        room?: { code: string };
        error?: string;
      };
      if (!res.ok || !data.room) {
        throw new Error(data.error ?? "No fue posible crear la sala.");
      }
      router.push(`/arena/${data.room.code}`);
    } catch (error) {
      setRoomError(error instanceof Error ? error.message : "Error de sala.");
      setBusyRoom(false);
    }
  }

  async function handleJoinRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanCode = joinCode.trim().toUpperCase();
    if (cleanCode.length !== 6) {
      setRoomError("Introduce un código válido de 6 caracteres.");
      return;
    }

    setRoomError(null);
    setBusyRoom(true);
    try {
      const res = await fetch(`/api/rooms/${cleanCode}/join`, {
        method: "POST",
      });
      const data = (await res.json()) as {
        room?: { code: string };
        error?: string;
      };
      if (!res.ok || !data.room) {
        throw new Error(data.error ?? "No fue posible unirte a la sala.");
      }
      router.push(`/arena/${data.room.code}`);
    } catch (error) {
      setRoomError(error instanceof Error ? error.message : "Error al unirse.");
      setBusyRoom(false);
    }
  }

  if (loading || !state) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#141418] p-6 font-mono text-xs text-[#B0AEA6]">
        {roomError ?? "Cargando tu laboratorio desde Supabase..."}
      </main>
    );
  }

  const equippedParts = [
    state.loadout.head,
    state.loadout.torso,
    state.loadout.arms,
    state.loadout.legs,
  ];

  return (
    <div className="min-h-screen bg-[#141418]">
      <Navbar
        displayName={state.profile.displayName}
        coins={state.profile.coins}
        freePacks={state.profile.freePacks}
      />

      <main className="mx-auto max-w-6xl space-y-10 px-4 py-8">
        {/* Top Command Sheet */}
        <section className="bg-[#16161B]">
          <div className="sheet-rule-h" />

          <div className="grid grid-cols-1 lg:grid-cols-5">
            {/* Left 3 cols: Multiplayer Host & Join Controls */}
            <div className="sheet-cell-edge-b sheet-cell-edge-r flex flex-col justify-between p-6 sm:p-8 lg:col-span-3">
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-[#ECEAE4] sm:text-4xl">
                  Partida de Artillería Multijugador
                </h1>
                <p className="mt-2.5 max-w-[54ch] text-sm leading-relaxed text-[#B0AEA6]">
                  Quien crea la sala actúa como servidor autoritativo y comparte
                  un código de 6 caracteres. Juega 1 vs 1 o arma equipos
                  personalizables 2 vs 2.
                </p>
              </div>

              <div className="mt-8 grid gap-6 border-t border-[#2B2D38] pt-6 sm:grid-cols-2">
                <div className="flex flex-col justify-between">
                  <div>
                    <h2 className="text-base font-bold text-[#ECEAE4]">
                      Crear nueva sala
                    </h2>
                    <p className="mt-1 font-mono text-xs text-[#8E8D86]">
                      Genera un código único y controla física y turnos como Host.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busyRoom}
                    onClick={handleCreateRoom}
                    className="mt-4 w-full bg-[#52FF2E] py-3 font-mono text-xs font-bold tracking-widest text-[#121216] uppercase transition hover:bg-[#32C81E] disabled:opacity-60"
                  >
                    {busyRoom ? "Preparando sala..." : "Crear Sala (Ser Host)"}
                  </button>
                </div>

                <form
                  onSubmit={handleJoinRoom}
                  className="flex flex-col justify-between"
                >
                  <div>
                    <h2 className="text-base font-bold text-[#ECEAE4]">
                      Unirme con código
                    </h2>
                    <p className="mt-1 font-mono text-xs text-[#8E8D86]">
                      Introduce el código de 6 caracteres del anfitrión.
                    </p>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <input
                      type="text"
                      maxLength={6}
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                      placeholder="FRNK42"
                      className="w-full border border-[#2E313D] bg-[#141418] px-3 py-2.5 text-center font-mono text-sm font-bold tracking-widest text-[#ECEAE4] uppercase outline-none focus:border-[#D47E3F]"
                    />
                    <button
                      type="submit"
                      disabled={busyRoom}
                      className="bg-[#D47E3F] px-5 py-2.5 font-mono text-xs font-bold tracking-wider text-[#121216] uppercase transition hover:bg-[#EB9C5C] disabled:opacity-60"
                    >
                      Entrar
                    </button>
                  </div>
                </form>
              </div>

              {roomError && (
                <div className="mt-4 border border-[#E84A5F]/60 bg-[#E84A5F]/15 px-3 py-2 font-mono text-xs text-[#ECEAE4]">
                  {roomError}
                </div>
              )}
            </div>

            {/* Right 2 cols: Stacked Gacha + Lab Navigation Cells */}
            <div className="grid grid-rows-2 lg:col-span-2">
              <Link
                href="/gacha"
                className="sheet-cell-edge-b group flex flex-col justify-between bg-[#15151A] p-6 transition hover:bg-[#1B1C22]"
              >
                <div className="flex items-center justify-between font-mono text-xs">
                  <span className="font-bold text-[#D47E3F]">GACHA TCG</span>
                  <span className="border border-[#D47E3F]/50 bg-[#D47E3F]/15 px-2 py-0.5 font-bold text-[#EB9C5C] tabular-nums">
                    {state.profile.freePacks} SOBRES GRATIS
                  </span>
                </div>
                <div>
                  <h2 className="mt-3 text-xl font-bold text-[#ECEAE4] group-hover:text-[#EB9C5C]">
                    Abrir Sobres de Cartas
                  </h2>
                  <p className="mt-1 font-mono text-xs text-[#B0AEA6]">
                    Desgarra sobres isométricos y obtén piezas Normales, Raras y
                    Únicas.
                  </p>
                </div>
              </Link>

              <Link
                href="/lab"
                className="sheet-cell-edge-b group flex flex-col justify-between bg-[#15151A] p-6 transition hover:bg-[#1B1C22]"
              >
                <div className="flex items-center justify-between font-mono text-xs">
                  <span className="font-bold text-[#52FF2E]">LABORATORIO</span>
                  <span className="border border-[#52FF2E]/50 bg-[#52FF2E]/15 px-2 py-0.5 font-bold text-[#52FF2E] tabular-nums">
                    {state.inventory.length}/{state.catalog.length} PIEZAS
                  </span>
                </div>
                <div>
                  <h2 className="mt-3 text-xl font-bold text-[#ECEAE4] group-hover:text-[#52FF2E]">
                    Personalizar Criatura
                  </h2>
                  <p className="mt-1 font-mono text-xs text-[#B0AEA6]">
                    Combina cabeza, torso, brazos y piernas para calibrar HP,
                    ATK, DEF y rasgos.
                  </p>
                </div>
              </Link>
            </div>
          </div>
        </section>

        {/* Active Creature 5-Column Blueprint Strip */}
        <section className="bg-[#16161B]">
          <div className="sheet-rule-h" />

          <div className="sheet-cell-edge-b flex flex-wrap items-center justify-between gap-4 px-6 py-4">
            <div>
              <h2 className="text-lg font-bold text-[#ECEAE4]">
                Criatura Activa — {state.profile.displayName}
              </h2>
              <p className="font-mono text-xs text-[#8E8D86] tabular-nums">
                Impacto directo vs DEF base (5):{" "}
                <strong className="text-[#52FF2E]">
                  {Math.max(1, state.stats.attack - 5)} DMG
                </strong>
              </p>
            </div>

            <div className="flex flex-wrap gap-4 font-mono text-xs font-bold tabular-nums">
              <span className="text-[#52FF2E]">VIDA {state.stats.maxHp}</span>
              <span className="text-[#EB9C5C]">ATAQUE {state.stats.attack}</span>
              <span className="text-[#ECEAE4]">DEFENSA {state.stats.defense}</span>
              <span className="text-[#B0AEA6]">
                MOVILIDAD {state.stats.mobility}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
            <div className="blueprint-dots sheet-cell-edge-b sheet-cell-edge-r flex flex-col items-center justify-between p-4">
              <div className="flex w-full justify-between font-mono text-[10px] text-[#8E8D86]">
                <span>SPECIMEN_00</span>
                <span className="text-[#52FF2E]">ACTIVA</span>
              </div>
              <MiniCreatureBadge
                loadout={state.loadout}
                displayName={state.profile.displayName}
              />
              <span className="font-mono text-[11px] font-bold text-[#ECEAE4]">
                Ensamblaje en Vivo
              </span>
            </div>

            {equippedParts.map((part, idx) => (
              <div
                key={part.id}
                className={`sheet-cell-edge-b p-4 ${
                  idx < equippedParts.length - 1 ? "sheet-cell-edge-r" : ""
                }`}
              >
                <PartArtwork
                  imageUrl={part.assetUrl}
                  alt={part.name}
                  slot={part.slot}
                  rarity={part.rarity}
                  className="h-28 w-full"
                />
                <div className="mt-2.5 truncate font-display text-sm font-bold text-[#ECEAE4]">
                  {part.name}
                </div>
                <div className="font-mono text-[11px] text-[#8E8D86] uppercase">
                  {part.slot} · {part.rarity}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 5-Column Technical Design Blueprint Sheet (FIG_01..FIG_04) */}
        <BlueprintSheetSection />
      </main>
    </div>
  );
}

/**
 * Render a compact live assembled creature canvas on the Main Menu.
 */
function MiniCreatureBadge({
  loadout,
  displayName,
}: {
  loadout: Loadout;
  displayName: string;
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

    const appearance = buildAppearanceFromLoadout(loadout);
    let frameId = 0;

    const render = (nowMs: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawAssembledCreature(ctx, {
        x: canvas.width / 2,
        y: canvas.height - 16,
        facing: 1,
        aimAngleDeg: 38,
        appearance,
        teamColor: "#52FF2E",
        scale: 1.55,
        timeSec: nowMs / 1000,
        isAlive: true,
      });
      frameId = window.requestAnimationFrame(render);
    };

    frameId = window.requestAnimationFrame(render);
    return () => window.cancelAnimationFrame(frameId);
  }, [loadout]);

  return (
    <canvas
      ref={canvasRef}
      width={150}
      height={128}
      aria-label={`Vista de ${displayName}`}
      className="h-28 w-36"
    />
  );
}
