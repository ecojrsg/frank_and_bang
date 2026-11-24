"use client";

// @Author: Jonathan Serna
// @Date:   2026-11-23 21:03:00
// @Last Modified by:   Jonathan Serna
// @Last Modified time: 2026-11-23 21:03:00

/**
 * Main menu hub after authentication: create/join multiplayer lobbies,
 * open Gacha TCG packs, or customize the creature in Victor's Lab.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { Navbar } from "@/components/layout/Navbar";
import { PartArtwork } from "@/components/parts/PartArtwork";
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
      setRoomError("Introduce un codigo valido de 6 caracteres.");
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
      <main className="flex min-h-screen items-center justify-center p-6 text-sm text-slate-300">
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
    <div className="min-h-screen">
      <Navbar
        displayName={state.profile.displayName}
        coins={state.profile.coins}
        freePacks={state.profile.freePacks}
      />

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Play / Multiplayer Host-Server Lobby Card */}
          <section className="flex flex-col justify-between rounded-2xl border border-emerald-500/40 bg-slate-900/90 p-6 shadow-xl lg:col-span-2">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-emerald-300">
                Combate 2D Multijugador (Host-Servidor)
              </span>
              <h1 className="mt-1 text-2xl font-black text-white">
                Jugar Partida de Artilleria
              </h1>
              <p className="mt-1.5 text-sm text-slate-300">
                Quien crea la sala se convierte en el servidor de la partida y
                comparte un codigo de 6 caracteres para combatir desde otra
                computadora.
              </p>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4">
                <h2 className="text-sm font-bold text-white">Crear nueva sala</h2>
                <p className="mt-1 text-xs text-slate-400">
                  Genera un codigo unico y controla la fisica y turnos como Host.
                </p>
                <button
                  type="button"
                  disabled={busyRoom}
                  onClick={handleCreateRoom}
                  className="mt-4 w-full rounded-xl bg-emerald-500 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-60"
                >
                  {busyRoom ? "Preparando sala..." : "Crear Sala (Ser Host)"}
                </button>
              </div>

              <form
                onSubmit={handleJoinRoom}
                className="rounded-xl border border-slate-800 bg-slate-950/80 p-4"
              >
                <h2 className="text-sm font-bold text-white">
                  Unirme con codigo
                </h2>
                <p className="mt-1 text-xs text-slate-400">
                  Pide el codigo de 6 caracteres al anfitrion de la partida.
                </p>
                <div className="mt-3 flex gap-2">
                  <input
                    type="text"
                    maxLength={6}
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="EJ. FRNK42"
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-center font-mono text-sm font-bold tracking-widest text-white uppercase outline-none focus:border-sky-400"
                  />
                  <button
                    type="submit"
                    disabled={busyRoom}
                    className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-sky-400 disabled:opacity-60"
                  >
                    Entrar
                  </button>
                </div>
              </form>
            </div>

            {roomError && (
              <div className="mt-4 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                {roomError}
              </div>
            )}
          </section>

          {/* Gacha & Lab quick pillars */}
          <section className="flex flex-col gap-4">
            <Link
              href="/gacha"
              className="group flex-1 rounded-2xl border border-amber-400/40 bg-gradient-to-br from-slate-900 to-amber-950/30 p-5 shadow-xl transition hover:border-amber-300"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-widest text-amber-300">
                  Gacha estilo TCG
                </span>
                <span className="rounded-full bg-amber-400/20 px-2.5 py-0.5 text-xs font-bold text-amber-200">
                  {state.profile.freePacks} sobres gratis
                </span>
              </div>
              <h2 className="mt-2 text-xl font-black text-white group-hover:text-amber-200">
                Abrir Sobres de Cartas
              </h2>
              <p className="mt-1 text-xs text-slate-300">
                Consigue piezas Normales, Raras y Unicas. Las repetidas se
                convierten en FrankenCoins.
              </p>
            </Link>

            <Link
              href="/lab"
              className="group flex-1 rounded-2xl border border-sky-400/40 bg-gradient-to-br from-slate-900 to-sky-950/30 p-5 shadow-xl transition hover:border-sky-300"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-widest text-sky-300">
                  Laboratorio de Victor
                </span>
                <span className="rounded-full bg-sky-400/20 px-2.5 py-0.5 text-xs font-bold text-sky-200">
                  {state.inventory.length}/{state.catalog.length} piezas
                </span>
              </div>
              <h2 className="mt-2 text-xl font-black text-white group-hover:text-sky-200">
                Personalizar Criatura
              </h2>
              <p className="mt-1 text-xs text-slate-300">
                Combina cabeza, torso, brazos y piernas para optimizar vida,
                ataque, defensa y rasgos unicos.
              </p>
            </Link>
          </section>
        </div>

        {/* Equipped creature overview */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white">
                Tu Criatura Activa ({state.profile.displayName})
              </h2>
              <p className="text-xs text-slate-400">
                Base 100 HP · 20 ATK · 5 DEF · Dano estimado vs defensa base:{" "}
                <strong className="text-emerald-300">
                  {Math.max(1, state.stats.attack - 5)} dmg
                </strong>
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs font-bold">
              <span className="rounded-lg bg-emerald-500/15 px-3 py-1.5 text-emerald-300">
                VIDA {state.stats.maxHp}
              </span>
              <span className="rounded-lg bg-rose-500/15 px-3 py-1.5 text-rose-300">
                ATAQUE {state.stats.attack}
              </span>
              <span className="rounded-lg bg-sky-500/15 px-3 py-1.5 text-sky-300">
                DEFENSA {state.stats.defense}
              </span>
              <span className="rounded-lg bg-violet-500/15 px-3 py-1.5 text-violet-300">
                MOVILIDAD {state.stats.mobility}
              </span>
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {equippedParts.map((part) => (
              <div
                key={part.id}
                className="rounded-xl border border-slate-800 bg-slate-950/70 p-3"
              >
                <PartArtwork
                  imageUrl={part.assetUrl}
                  alt={part.name}
                  slot={part.slot}
                  rarity={part.rarity}
                  className="h-28 w-full"
                />
                <div className="mt-2 text-xs font-bold text-white">
                  {part.name}
                </div>
                <div className="text-[11px] text-slate-400 capitalize">
                  {part.slot} · {part.rarity}
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
