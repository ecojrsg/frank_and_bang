"use client";

// @Author: Jonathan Serna
// @Date:   2026-11-23 21:03:00
// @Last Modified by:   Jonathan Serna
// @Last Modified time: 2026-11-23 21:03:00

/**
 * Pokémon TCG-style Gacha pack opening screen and full catalog collection
 * hydrated from public.parts_catalog and Supabase Storage "parts-assets".
 */

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { Navbar } from "@/components/layout/Navbar";
import { TcgPartCard } from "@/components/parts/TcgPartCard";
import { PACK_COST_COINS } from "@/domain/gachaEngine";
import type { GachaPullResult } from "@/domain/types";
import type { PlayerFullState } from "@/infrastructure/supabase/partsRepository";

export default function GachaPage() {
  const router = useRouter();
  const [state, setState] = useState<PlayerFullState | null>(null);
  const [pulls, setPulls] = useState<GachaPullResult[]>([]);
  const [revealedFlags, setRevealedFlags] = useState<boolean[]>([]);
  const [lastBonusCoins, setLastBonusCoins] = useState(0);
  const [opening, setOpening] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadState = useCallback(async () => {
    const res = await fetch("/api/profile");
    if (res.status === 401) {
      router.push("/login");
      return;
    }
    const data = (await res.json()) as PlayerFullState & { error?: string };
    if (res.ok) {
      setState(data);
    } else {
      setErrorMessage(data.error ?? "Error al cargar el catalogo.");
    }
  }, [router]);

  useEffect(() => {
    loadState();
  }, [loadState]);

  async function handleOpenPack() {
    setErrorMessage(null);
    setOpening(true);
    try {
      const res = await fetch("/api/gacha/open", { method: "POST" });
      const data = (await res.json()) as {
        pulls?: GachaPullResult[];
        totalDuplicateCoins?: number;
        error?: string;
      };
      if (!res.ok || !data.pulls) {
        throw new Error(data.error ?? "No se pudo abrir el sobre.");
      }

      setPulls(data.pulls);
      setRevealedFlags(data.pulls.map(() => false));
      setLastBonusCoins(data.totalDuplicateCoins ?? 0);
      await loadState();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Error abriendo sobre."
      );
    } finally {
      setOpening(false);
    }
  }

  async function handleClaimRefill() {
    setErrorMessage(null);
    const res = await fetch("/api/gacha/bonus", { method: "POST" });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      setErrorMessage(data.error ?? "No se pudo reclamar el sobre extra.");
      return;
    }
    await loadState();
  }

  function flipCard(index: number) {
    setRevealedFlags((prev) => prev.map((flag, i) => (i === index ? true : flag)));
  }

  function flipAllCards() {
    setRevealedFlags((prev) => prev.map(() => true));
  }

  if (!state) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6 text-sm text-slate-300">
        {errorMessage ?? "Cargando sobres desde Supabase..."}
      </main>
    );
  }

  const ownedQuantityMap = new Map(
    state.inventory.map((entry) => [entry.partId, entry.quantity])
  );
  const canOpen =
    state.profile.freePacks > 0 || state.profile.coins >= PACK_COST_COINS;

  return (
    <div className="min-h-screen">
      <Navbar
        displayName={state.profile.displayName}
        coins={state.profile.coins}
        freePacks={state.profile.freePacks}
      />

      <main className="mx-auto max-w-6xl space-y-8 px-4 py-8">
        {/* Pack opening stage */}
        <section className="rounded-2xl border border-amber-400/30 bg-gradient-to-b from-slate-900 via-slate-900/95 to-slate-950 p-6 shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-amber-300">
                Sobres Coleccionables · 3 Cartas por Sobre
              </span>
              <h1 className="mt-1 text-2xl font-black text-white">
                Gacha del Laboratorio
              </h1>
              <p className="mt-1 text-xs text-slate-300">
                Probabilidades: <strong>70% Normal</strong> ·{" "}
                <strong className="text-sky-300">24% Rara</strong> ·{" "}
                <strong className="text-amber-300">6% Unica</strong>. Las cartas
                repetidas otorgan FrankenCoins automaticamente.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {canOpen ? (
                <button
                  type="button"
                  disabled={opening}
                  onClick={handleOpenPack}
                  className="rounded-xl bg-amber-400 px-6 py-3 text-sm font-black text-slate-950 shadow-lg shadow-amber-400/20 transition hover:bg-amber-300 disabled:opacity-60"
                >
                  {opening
                    ? "Abriendo sobre..."
                    : state.profile.freePacks > 0
                      ? `Abrir Sobre Gratis (${state.profile.freePacks})`
                      : `Comprar Sobre (${PACK_COST_COINS} FC)`}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleClaimRefill}
                  className="rounded-xl border border-emerald-400/60 bg-emerald-500/15 px-5 py-3 text-sm font-bold text-emerald-200 transition hover:bg-emerald-500/25"
                >
                  Recargar 1 Sobre de Prueba Gratis
                </button>
              )}

              {pulls.length > 0 && revealedFlags.some((flag) => !flag) && (
                <button
                  type="button"
                  onClick={flipAllCards}
                  className="rounded-xl border border-slate-700 px-4 py-3 text-xs font-bold text-slate-200 hover:border-slate-500"
                >
                  Voltear Todas
                </button>
              )}
            </div>
          </div>

          {errorMessage && (
            <div className="mt-4 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
              {errorMessage}
            </div>
          )}

          {pulls.length > 0 ? (
            <div className="mt-6 space-y-4">
              <div className="grid gap-5 sm:grid-cols-3">
                {pulls.map((pull, index) => (
                  <TcgPartCard
                    key={`${pull.part.id}-${index}`}
                    part={pull.part}
                    cardBackUrl={state.cardBackUrl}
                    revealed={revealedFlags[index] ?? false}
                    onFlip={() => flipCard(index)}
                    isNew={pull.isNew}
                    duplicateCoins={pull.duplicateCoins}
                  />
                ))}
              </div>
              {revealedFlags.every(Boolean) && lastBonusCoins > 0 && (
                <p className="text-center text-xs font-semibold text-amber-300">
                  Recibiste +{lastBonusCoins} FrankenCoins por cartas repetidas.
                </p>
              )}
            </div>
          ) : (
            <div className="mt-6 rounded-xl border border-dashed border-slate-700 bg-slate-950/60 p-10 text-center">
              <p className="text-sm font-semibold text-slate-200">
                Pulsa el boton superior para rasgar un sobre y descubrir 3
                piezas de criatura.
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Cada tarjeta consulta tu inventario en Supabase y descarga su
                arte directamente del bucket <code>parts-assets</code>.
              </p>
            </div>
          )}
        </section>

        {/* Full catalog collection */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">
              Coleccion Completa ({state.inventory.length}/{state.catalog.length})
            </h2>
            <span className="text-xs text-slate-400">
              Fuente en vivo: <code>public.parts_catalog</code> + bucket{" "}
              <code>parts-assets</code>
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {state.catalog.map((part) => {
              const quantity = ownedQuantityMap.get(part.id) ?? 0;
              return (
                <TcgPartCard
                  key={part.id}
                  part={part}
                  cardBackUrl={state.cardBackUrl}
                  revealed={true}
                  ownedQuantity={quantity > 0 ? quantity : undefined}
                  locked={quantity === 0}
                />
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
