"use client";

// @Author: Jonathan Serna
// @Date:   2026-11-23 21:03:00
// @Last Modified by:   Jonathan Serna
// @Last Modified time: 2026-11-23 23:36:00

/**
 * Victor's Laboratory: modular 4-slot creature assembler styled as a sharp
 * bio-industrial technical sheet with live dual canvas preview and stats.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { CreaturePreviewPanel } from "@/components/lab/CreaturePreviewPanel";
import { Navbar } from "@/components/layout/Navbar";
import { PartArtwork } from "@/components/parts/PartArtwork";
import { computeCreatureStats } from "@/domain/statsCalculator";
import type { Loadout, Part, PartSlot } from "@/domain/types";
import { soundEngine } from "@/engine/soundEngine";
import type { PlayerFullState } from "@/infrastructure/supabase/partsRepository";

const SLOT_TABS: { slot: PartSlot; label: string }[] = [
  { slot: "head", label: "Cabeza" },
  { slot: "torso", label: "Torso" },
  { slot: "arms", label: "Brazos" },
  { slot: "legs", label: "Piernas" },
];

export default function LabPage() {
  const router = useRouter();
  const [state, setState] = useState<PlayerFullState | null>(null);
  const [draft, setDraft] = useState<Loadout | null>(null);
  const [activeSlot, setActiveSlot] = useState<PartSlot>("arms");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    async function loadLab() {
      const res = await fetch("/api/profile");
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      const data = (await res.json()) as PlayerFullState;
      if (res.ok) {
        setState(data);
        setDraft(data.loadout);
      }
    }

    loadLab();
  }, [router]);

  const liveStats = useMemo(() => {
    if (!draft) {
      return null;
    }
    return computeCreatureStats(draft);
  }, [draft]);

  async function handleSaveLoadout() {
    if (!draft) {
      return;
    }

    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/loadout", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          headPartId: draft.head.id,
          torsoPartId: draft.torso.id,
          armsPartId: draft.arms.id,
          legsPartId: draft.legs.id,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "No se pudo guardar tu criatura.");
      }
      setFeedback("Criatura guardada en Supabase y lista para combatir.");
    } catch (error) {
      setFeedback(
        error instanceof Error ? error.message : "Error al guardar."
      );
    } finally {
      setSaving(false);
    }
  }

  if (!state || !draft || !liveStats) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#141418] p-6 font-mono text-xs text-[#B0AEA6]">
        Cargando Laboratorio de Victor...
      </main>
    );
  }

  const ownedSet = new Set(state.inventory.map((item) => item.partId));
  const partsForSlot = state.catalog.filter((part) => part.slot === activeSlot);

  function selectPart(part: Part) {
    if (!ownedSet.has(part.id)) {
      return;
    }
    soundEngine.playPartEquip();
    setFeedback(null);
    setDraft((prev) => (prev ? { ...prev, [part.slot]: part } : prev));
  }

  return (
    <div className="min-h-screen bg-[#141418]">
      <Navbar
        displayName={state.profile.displayName}
        coins={state.profile.coins}
        freePacks={state.profile.freePacks}
      />

      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="bg-[#16161B]">
          <div className="sheet-rule-h" />

          <div className="grid grid-cols-1 lg:grid-cols-12">
            {/* Left 5 cols: Assembly Preview & Telemetry */}
            <section className="sheet-cell-edge-b sheet-cell-edge-r space-y-5 p-6 lg:col-span-5">
              <div>
                <h1 className="text-2xl font-bold text-[#ECEAE4] sm:text-3xl">
                  Laboratorio de Ensamblaje
                </h1>
                <p className="mt-1 font-mono text-xs text-[#8E8D86]">
                  Selecciona cada ranura para calibrar atributos y rasgos únicos.
                </p>
              </div>

              <CreaturePreviewPanel
                loadout={draft}
                displayName={state.profile.displayName}
              />

              <div className="grid grid-cols-2 gap-px bg-[#2B2D38]">
                {SLOT_TABS.map(({ slot, label }) => {
                  const equipped = draft[slot];
                  const isSelected = activeSlot === slot;
                  return (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setActiveSlot(slot)}
                      className={`p-2.5 text-left transition ${
                        isSelected
                          ? "bg-[#1B1C22] ring-1 ring-inset ring-[#52FF2E]"
                          : "bg-[#15151A] hover:bg-[#1B1C22]"
                      }`}
                    >
                      <PartArtwork
                        imageUrl={equipped.assetUrl}
                        alt={equipped.name}
                        slot={slot}
                        rarity={equipped.rarity}
                        className="h-24 w-full"
                      />
                      <div className="mt-1.5 font-mono text-[10px] font-bold text-[#8E8D86] uppercase">
                        {label}
                      </div>
                      <div className="truncate font-display text-xs font-bold text-[#ECEAE4]">
                        {equipped.name}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Real-time Stat Meters */}
              <div className="space-y-3 border border-[#2B2D38] bg-[#15151A] p-4">
                <StatBar
                  label="Vida (Base 100)"
                  value={liveStats.maxHp}
                  max={160}
                  barClass="bg-[#52FF2E]"
                />
                <StatBar
                  label="Ataque (Base 20)"
                  value={liveStats.attack}
                  max={34}
                  barClass="bg-[#D47E3F]"
                />
                <StatBar
                  label="Defensa (Base 5)"
                  value={liveStats.defense}
                  max={15}
                  barClass="bg-[#EB9C5C]"
                />
                <StatBar
                  label="Movilidad (Base 100)"
                  value={liveStats.mobility}
                  max={160}
                  barClass="bg-[#88D498]"
                />
                <p className="pt-1 font-mono text-[11px] text-[#8E8D86]">
                  Impacto directo: <code>max(1, ATK - DEF rival)</code> · Daño
                  base:{" "}
                  <strong className="text-[#52FF2E]">
                    {Math.max(1, liveStats.attack - 5)} DMG
                  </strong>
                </p>
              </div>

              {liveStats.activeTraits.length > 0 && (
                <div className="space-y-1.5 border border-[#D47E3F]/50 bg-[#D47E3F]/10 p-3 font-mono text-xs text-[#ECEAE4]">
                  <div className="font-bold text-[#EB9C5C]">
                    RASGOS ÚNICOS ACTIVOS
                  </div>
                  {liveStats.activeTraits.map((trait) => (
                    <div key={trait.id}>
                      <strong>{trait.name}:</strong> {trait.description}
                    </div>
                  ))}
                </div>
              )}

              {feedback && (
                <div className="border border-[#52FF2E]/60 bg-[#52FF2E]/10 px-3 py-2 font-mono text-xs text-[#52FF2E]">
                  {feedback}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSaveLoadout}
                  className="flex-1 bg-[#52FF2E] py-3 font-mono text-xs font-bold tracking-widest text-[#121216] uppercase transition hover:bg-[#32C81E] disabled:opacity-60"
                >
                  {saving ? "Guardando..." : "Guardar Criatura"}
                </button>
                <Link
                  href="/gacha"
                  className="border border-[#D47E3F] bg-[#1B1C22] px-4 py-3 font-mono text-xs font-bold tracking-wider text-[#EB9C5C] uppercase transition hover:bg-[#D47E3F]/15"
                >
                  Más Sobres
                </Link>
              </div>
            </section>

            {/* Right 7 cols: Slot Picker */}
            <section className="sheet-cell-edge-b space-y-5 p-6 lg:col-span-7">
              <div className="flex flex-wrap border border-[#2E313D] bg-[#141418] font-mono text-xs font-bold uppercase">
                {SLOT_TABS.map(({ slot, label }) => (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => setActiveSlot(slot)}
                    className={`flex-1 px-4 py-2.5 transition ${
                      activeSlot === slot
                        ? "bg-[#52FF2E] text-[#121216]"
                        : "text-[#B0AEA6] hover:bg-[#1B1C22] hover:text-[#ECEAE4]"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {partsForSlot.map((part) => {
                  const owned = ownedSet.has(part.id);
                  const equipped = draft[part.slot].id === part.id;
                  return (
                    <button
                      key={part.id}
                      type="button"
                      disabled={!owned}
                      onClick={() => selectPart(part)}
                      className={`flex flex-col border p-3.5 text-left transition ${
                        equipped
                          ? "border-[#52FF2E] bg-[#1B1C22]"
                          : owned
                            ? "border-[#2E313D] bg-[#15151A] hover:border-[#D47E3F]"
                            : "cursor-not-allowed border-[#252731] bg-[#141418] opacity-50"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-display text-sm font-bold text-[#ECEAE4]">
                          {part.name}
                        </span>
                        <span className="border border-[#3A3D4A] bg-[#141418] px-2 py-0.5 font-mono text-[10px] font-bold text-[#EB9C5C] uppercase">
                          {part.rarity}
                        </span>
                      </div>

                      <div className="mt-2 w-full">
                        <PartArtwork
                          imageUrl={part.assetUrl}
                          alt={part.name}
                          slot={part.slot}
                          rarity={part.rarity}
                          className="h-32 w-full"
                        />
                      </div>

                      <p className="mt-2 text-xs text-[#B0AEA6]">
                        {part.description}
                      </p>

                      <div className="mt-2.5 grid w-full grid-cols-2 gap-px bg-[#2B2D38] font-mono text-[11px] font-bold tabular-nums">
                        <span className="bg-[#141418] px-2 py-0.5 text-[#52FF2E]">
                          HP {part.modifiers.hpDelta >= 0 ? "+" : ""}
                          {part.modifiers.hpDelta * 5}
                        </span>
                        <span className="bg-[#141418] px-2 py-0.5 text-[#EB9C5C]">
                          ATK {part.modifiers.atkDelta >= 0 ? "+" : ""}
                          {part.modifiers.atkDelta}
                        </span>
                        <span className="bg-[#141418] px-2 py-0.5 text-[#ECEAE4]">
                          DEF {part.modifiers.defDelta >= 0 ? "+" : ""}
                          {part.modifiers.defDelta}
                        </span>
                        <span className="bg-[#141418] px-2 py-0.5 text-[#8E8D86]">
                          MOV {part.modifiers.movDelta >= 0 ? "+" : ""}
                          {part.modifiers.movDelta * 5}
                        </span>
                      </div>

                      <div className="mt-2.5 font-mono text-[11px] font-bold uppercase">
                        {equipped ? (
                          <span className="text-[#52FF2E]">Equipada</span>
                        ) : owned ? (
                          <span className="text-[#D47E3F]">Clic para equipar</span>
                        ) : (
                          <span className="text-[#8E8D86]">
                            Bloqueada · Consíguela en Sobres TCG
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}

interface StatBarProps {
  label: string;
  value: number;
  max: number;
  barClass: string;
}

/**
 * Render one labeled horizontal stat meter inside the Laboratory.
 */
function StatBar({ label, value, max, barClass }: StatBarProps) {
  const pct = Math.max(5, Math.min(100, Math.round((value / max) * 100)));
  return (
    <div>
      <div className="mb-1 flex justify-between font-mono text-xs font-bold tabular-nums">
        <span className="text-[#B0AEA6]">{label}</span>
        <span className="text-[#ECEAE4]">{value}</span>
      </div>
      <div className="h-2 overflow-hidden bg-[#22242C]">
        <div
          className={`h-full transition-all ${barClass}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
