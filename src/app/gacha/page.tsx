"use client";

// @Author: Jonathan Serna
// @Date:   2026-11-23 21:03:00
// @Last Modified by:   Jonathan Serna
// @Last Modified time: 2026-11-23 23:36:00

/**
 * Pokémon TCG Pocket-inspired Gacha pack station and catalog collection
 * hydrated from public.parts_catalog and Supabase Storage "parts-assets",
 * launching an immersive isometric tear + swipeable card popout modal.
 */

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { AnatomyBoosterPackSvg } from "@/components/gacha/AnatomyBoosterPackSvg";
import { PackOpeningModal } from "@/components/gacha/PackOpeningModal";
import { Navbar } from "@/components/layout/Navbar";
import { TcgPartCard } from "@/components/parts/TcgPartCard";
import { PACK_COST_COINS } from "@/domain/gachaEngine";
import type { GachaPullResult } from "@/domain/types";
import type { PlayerFullState } from "@/infrastructure/supabase/partsRepository";

export default function GachaPage() {
  const router = useRouter();
  const [state, setState] = useState<PlayerFullState | null>(null);
  const [pulls, setPulls] = useState<GachaPullResult[]>([]);
  const [lastBonusCoins, setLastBonusCoins] = useState(0);
  const [opening, setOpening] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
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
      setErrorMessage(data.error ?? "Error al cargar el catálogo.");
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
      setLastBonusCoins(data.totalDuplicateCoins ?? 0);
      setModalOpen(true);
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

  if (!state) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#141418] p-6 font-mono text-xs text-[#B0AEA6]">
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
    <div className="min-h-screen bg-[#141418]">
      <Navbar
        displayName={state.profile.displayName}
        coins={state.profile.coins}
        freePacks={state.profile.freePacks}
      />

      <main className="mx-auto max-w-6xl space-y-10 px-4 py-8">
        {/* Pack Opening Chamber Sheet */}
        <section className="bg-[#16161B]">
          <div className="sheet-rule-h" />

          <div className="grid grid-cols-1 lg:grid-cols-5">
            <div className="sheet-cell-edge-b sheet-cell-edge-r flex flex-col justify-between p-6 sm:p-8 lg:col-span-3">
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-[#ECEAE4] sm:text-4xl">
                  Cámara de Sobres TCG
                </h1>
                <p className="mt-3 max-w-[52ch] font-mono text-xs leading-relaxed text-[#B0AEA6]">
                  Cada sobre contiene 3 piezas de criatura con probabilidad de{" "}
                  <strong className="text-[#ECEAE4]">70% Normal</strong> ·{" "}
                  <strong className="text-[#EB9C5C]">24% Rara</strong> ·{" "}
                  <strong className="text-[#52FF2E]">6% Única</strong>. Las
                  repetidas otorgan FrankenCoins automáticamente.
                </p>
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                {canOpen ? (
                  <button
                    type="button"
                    disabled={opening}
                    onClick={handleOpenPack}
                    className="bg-[#D47E3F] px-6 py-3 font-mono text-xs font-bold tracking-widest text-[#121216] uppercase transition hover:bg-[#EB9C5C] disabled:opacity-60"
                  >
                    {opening
                      ? "Despresurizando..."
                      : state.profile.freePacks > 0
                        ? `Abrir Sobre Gratis (${state.profile.freePacks})`
                        : `Comprar Sobre (${PACK_COST_COINS} FC)`}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleClaimRefill}
                    className="border border-[#52FF2E] bg-[#52FF2E]/15 px-5 py-3 font-mono text-xs font-bold tracking-wider text-[#52FF2E] uppercase transition hover:bg-[#52FF2E]/25"
                  >
                    Recargar 1 Sobre de Prueba Gratis
                  </button>
                )}

                {pulls.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setModalOpen(true)}
                    className="border border-[#3A3D4A] bg-[#1B1C22] px-4 py-3 font-mono text-xs font-bold text-[#ECEAE4] uppercase transition hover:border-[#D47E3F]"
                  >
                    Reabrir Último Sobre
                  </button>
                )}
              </div>

              {errorMessage && (
                <div className="mt-4 border border-[#E84A5F]/60 bg-[#E84A5F]/15 px-3 py-2 font-mono text-xs text-[#ECEAE4]">
                  {errorMessage}
                </div>
              )}
            </div>

            {/* Right 2 cols: Interactive Isometric Booster Pack Trigger */}
            <div className="blueprint-dots sheet-cell-edge-b flex flex-col items-center justify-between p-6 lg:col-span-2">
              <div className="flex w-full justify-between font-mono text-[10px] tracking-[0.12em] text-[#8E8D86]">
                <span>FIG_PACK</span>
                <span className="text-[#52FF2E]">
                  {canOpen ? "CLIC PARA RASGAR" : "SIN SOBRES"}
                </span>
              </div>

              <AnatomyBoosterPackSvg
                tearing={false}
                disabled={!canOpen || opening}
                compact
                onTear={() => {
                  if (canOpen && !opening) {
                    void handleOpenPack();
                  }
                }}
              />

              <div className="flex w-full justify-between font-mono text-[10px] text-[#8E8D86] tabular-nums">
                <span>DISPONIBLES: {state.profile.freePacks}</span>
                <span className="text-[#EB9C5C]">{state.profile.coins} FC</span>
              </div>
            </div>
          </div>

          {pulls.length > 0 && (
            <div className="sheet-cell-edge-b p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2 font-mono text-xs">
                <span className="font-bold text-[#52FF2E]">
                  ÚLTIMA APERTURA ({pulls.length} CARTAS)
                </span>
                {lastBonusCoins > 0 && (
                  <span className="text-[#EB9C5C] tabular-nums">
                    +{lastBonusCoins} FC por repetidas
                  </span>
                )}
              </div>
              <div className="grid gap-5 sm:grid-cols-3">
                {pulls.map((pull, idx) => (
                  <TcgPartCard
                    key={`${pull.part.id}-${idx}`}
                    part={pull.part}
                    cardBackUrl={state.cardBackUrl}
                    revealed={true}
                    isNew={pull.isNew}
                    duplicateCoins={pull.duplicateCoins}
                  />
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Full Catalog Collection */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#D47E3F]/25 pb-3">
            <h2 className="text-2xl font-bold text-[#ECEAE4]">
              Colección Completa ({state.inventory.length}/{state.catalog.length})
            </h2>
            <span className="font-mono text-xs text-[#8E8D86]">
              public.parts_catalog · parts-assets
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

      <PackOpeningModal
        isOpen={modalOpen}
        pulls={pulls}
        totalDuplicateCoins={lastBonusCoins}
        cardBackUrl={state.cardBackUrl}
        freePacksRemaining={state.profile.freePacks}
        coinsRemaining={state.profile.coins}
        openingAnother={opening}
        onOpenAnother={() => void handleOpenPack()}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}
