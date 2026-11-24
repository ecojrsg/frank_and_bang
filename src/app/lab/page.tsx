"use client";

// @Author: Jonathan Serna
// @Date:   2026-11-23 21:03:00
// @Last Modified by:   Jonathan Serna
// @Last Modified time: 2026-11-23 21:03:00

/**
 * Victor's Laboratory: modular 4-slot creature assembler with live stat
 * preview and visual assets resolved directly from Supabase parts-assets.
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
      <main className="flex min-h-screen items-center justify-center p-6 text-sm text-slate-300">
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
    <div className="min-h-screen">
      <Navbar
        displayName={state.profile.displayName}
        coins={state.profile.coins}
        freePacks={state.profile.freePacks}
      />

      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-8 lg:grid-cols-12">
        {/* Left: Creature Assembly Preview & Live Stats */}
        <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/90 p-5 lg:col-span-5">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-sky-300">
              Laboratorio de Victor
            </span>
            <h1 className="text-xl font-black text-white">
              Ensamblaje de Criatura
            </h1>
          </div>

          <CreaturePreviewPanel
            loadout={draft}
            displayName={state.profile.displayName}
          />

          <div className="grid grid-cols-2 gap-3">
            {SLOT_TABS.map(({ slot, label }) => {
              const equipped = draft[slot];
              const isSelected = activeSlot === slot;
              return (
                <button
                  key={slot}
                  type="button"
                  onClick={() => setActiveSlot(slot)}
                  className={`rounded-xl border p-2 text-left transition ${
                    isSelected
                      ? "border-emerald-400 bg-emerald-500/10"
                      : "border-slate-800 bg-slate-950/70 hover:border-slate-600"
                  }`}
                >
                  <PartArtwork
                    imageUrl={equipped.assetUrl}
                    alt={equipped.name}
                    slot={slot}
                    rarity={equipped.rarity}
                    className="h-24 w-full"
                  />
                  <div className="mt-1.5 text-[10px] font-bold uppercase text-slate-400">
                    {label}
                  </div>
                  <div className="truncate text-xs font-bold text-white">
                    {equipped.name}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Real-time stat meters */}
          <div className="space-y-2.5 rounded-xl border border-slate-800 bg-slate-950/80 p-4">
            <StatBar
              label="Vida (Base 100)"
              value={liveStats.maxHp}
              max={160}
              barClass="bg-emerald-400"
            />
            <StatBar
              label="Ataque (Base 20)"
              value={liveStats.attack}
              max={34}
              barClass="bg-rose-400"
            />
            <StatBar
              label="Defensa (Base 5)"
              value={liveStats.defense}
              max={15}
              barClass="bg-sky-400"
            />
            <StatBar
              label="Movilidad (Base 100)"
              value={liveStats.mobility}
              max={160}
              barClass="bg-violet-400"
            />
            <p className="pt-1 text-[11px] text-slate-400">
              Formula de impacto directo:{" "}
              <code>max(1, ATK - DEF rival)</code>. Contra defensa base (5)
              haces{" "}
              <strong className="text-emerald-300">
                {Math.max(1, liveStats.attack - 5)} de dano
              </strong>
              .
            </p>
          </div>

          {liveStats.activeTraits.length > 0 && (
            <div className="space-y-1.5 rounded-xl border border-amber-400/40 bg-amber-500/10 p-3 text-xs text-amber-100">
              <div className="font-bold text-amber-300">
                Rasgos Unicos Activos
              </div>
              {liveStats.activeTraits.map((trait) => (
                <div key={trait.id}>
                  <strong>{trait.name}:</strong> {trait.description}
                </div>
              ))}
            </div>
          )}

          {feedback && (
            <div className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
              {feedback}
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={handleSaveLoadout}
              className="flex-1 rounded-xl bg-emerald-500 py-2.5 text-sm font-black text-slate-950 transition hover:bg-emerald-400 disabled:opacity-60"
            >
              {saving ? "Guardando..." : "Guardar Criatura"}
            </button>
            <Link
              href="/gacha"
              className="rounded-xl border border-amber-400/50 px-4 py-2.5 text-sm font-bold text-amber-200 hover:bg-amber-400/10"
            >
              Mas Sobres
            </Link>
          </div>
        </section>

        {/* Right: Slot Picker */}
        <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/90 p-5 lg:col-span-7">
          <div className="flex flex-wrap gap-2">
            {SLOT_TABS.map(({ slot, label }) => (
              <button
                key={slot}
                type="button"
                onClick={() => setActiveSlot(slot)}
                className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
                  activeSlot === slot
                    ? "bg-emerald-500 text-slate-950"
                    : "bg-slate-950 text-slate-300 hover:bg-slate-800"
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
                  className={`flex flex-col rounded-2xl border p-3.5 text-left transition ${
                    equipped
                      ? "border-emerald-400 bg-emerald-500/10 ring-1 ring-emerald-400/50"
                      : owned
                        ? "border-slate-700 bg-slate-950/80 hover:border-sky-400/70"
                        : "cursor-not-allowed border-slate-800 bg-slate-950/40 opacity-50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-white">
                      {part.name}
                    </span>
                    <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-200">
                      {part.rarity}
                    </span>
                  </div>

                  <div className="mt-2">
                    <PartArtwork
                      imageUrl={part.assetUrl}
                      alt={part.name}
                      slot={part.slot}
                      rarity={part.rarity}
                      className="h-32 w-full"
                    />
                  </div>

                  <p className="mt-2 text-xs text-slate-300">
                    {part.description}
                  </p>

                  <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-semibold">
                    <span className="rounded bg-slate-800 px-2 py-0.5 text-emerald-300">
                      HP {part.modifiers.hpDelta >= 0 ? "+" : ""}
                      {part.modifiers.hpDelta * 5}
                    </span>
                    <span className="rounded bg-slate-800 px-2 py-0.5 text-rose-300">
                      ATK {part.modifiers.atkDelta >= 0 ? "+" : ""}
                      {part.modifiers.atkDelta}
                    </span>
                    <span className="rounded bg-slate-800 px-2 py-0.5 text-sky-300">
                      DEF {part.modifiers.defDelta >= 0 ? "+" : ""}
                      {part.modifiers.defDelta}
                    </span>
                    <span className="rounded bg-slate-800 px-2 py-0.5 text-violet-300">
                      MOV {part.modifiers.movDelta >= 0 ? "+" : ""}
                      {part.modifiers.movDelta * 5}
                    </span>
                  </div>

                  <div className="mt-2.5 text-[11px] font-bold">
                    {equipped ? (
                      <span className="text-emerald-300">Equipada</span>
                    ) : owned ? (
                      <span className="text-sky-300">Clic para equipar</span>
                    ) : (
                      <span className="text-slate-400">
                        Bloqueada — Consiguela en Sobres TCG
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
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
      <div className="mb-1 flex justify-between text-xs font-semibold">
        <span className="text-slate-300">{label}</span>
        <span className="text-white">{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-800">
        <div
          className={`h-full rounded-full transition-all ${barClass}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
