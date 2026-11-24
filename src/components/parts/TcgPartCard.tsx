"use client";

// @Author: Jonathan Serna
// @Date:   2026-11-23 21:03:00
// @Last Modified by:   Jonathan Serna
// @Last Modified time: 2026-11-23 21:03:00

/**
 * Collectible TCG-style part card with 3D flip reveal, rarity glow,
 * ownership status badge, and visual artwork loaded from parts-assets.
 */

import { useState } from "react";

import type { Part, PartRarity, PartSlot } from "@/domain/types";

import { PartArtwork } from "./PartArtwork";

interface TcgPartCardProps {
  part: Part;
  cardBackUrl: string | null;
  revealed: boolean;
  onFlip?: () => void;
  isNew?: boolean;
  duplicateCoins?: number;
  ownedQuantity?: number;
  locked?: boolean;
}

const RARITY_STYLES: Record<
  PartRarity,
  { border: string; badge: string; label: string; glow: string }
> = {
  normal: {
    border: "border-slate-600/80",
    badge: "bg-slate-700/80 text-slate-200",
    label: "Normal",
    glow: "shadow-slate-900/50",
  },
  rare: {
    border: "border-sky-400/80",
    badge: "bg-sky-500/20 text-sky-200 ring-1 ring-sky-400/50",
    label: "Rara",
    glow: "shadow-sky-500/25",
  },
  unique: {
    border: "border-amber-400/90",
    badge: "bg-amber-500/25 text-amber-200 ring-1 ring-amber-400/60",
    label: "Unica",
    glow: "shadow-amber-400/30",
  },
};

const SLOT_NAMES: Record<PartSlot, string> = {
  head: "Cabeza",
  torso: "Torso",
  arms: "Brazos",
  legs: "Piernas",
};

/**
 * Format a numeric stat delta with explicit sign.
 */
function formatDelta(label: string, value: number, scale: number = 1): string {
  const scaled = value * scale;
  const sign = scaled > 0 ? "+" : "";
  return `${label} ${sign}${scaled}`;
}

/**
 * Render one interactive TCG card for Gacha pulls or collection inspection.
 */
export function TcgPartCard({
  part,
  cardBackUrl,
  revealed,
  onFlip,
  isNew,
  duplicateCoins,
  ownedQuantity,
  locked = false,
}: TcgPartCardProps) {
  const [backFailed, setBackFailed] = useState(false);
  const style = RARITY_STYLES[part.rarity];

  return (
    <div className="tcg-perspective w-full">
      <div
        role={onFlip && !revealed ? "button" : undefined}
        tabIndex={onFlip && !revealed ? 0 : undefined}
        onClick={() => {
          if (onFlip && !revealed) {
            onFlip();
          }
        }}
        onKeyDown={(event) => {
          if (onFlip && !revealed && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            onFlip();
          }
        }}
        className={`tcg-card-inner relative min-h-[345px] w-full ${
          revealed ? "is-flipped" : "cursor-pointer"
        }`}
      >
        {/* Card Back */}
        <div className="tcg-card-face absolute inset-0 flex flex-col items-center justify-between rounded-2xl border-2 border-emerald-400/60 bg-gradient-to-b from-slate-900 via-slate-950 to-emerald-950/50 p-4 shadow-xl transition hover:border-emerald-300">
          <span className="text-[11px] font-bold tracking-[0.22em] text-emerald-300/80">
            FRANK &amp; BANG TCG
          </span>
          {cardBackUrl && !backFailed ? (
            <img
              src={cardBackUrl}
              alt="Reverso de tarjeta Frank and Bang"
              className="h-48 w-40 object-contain"
              onError={() => setBackFailed(true)}
            />
          ) : (
            <div className="flex h-40 w-32 flex-col items-center justify-center rounded-xl border border-emerald-400/40 bg-emerald-500/10">
              <span className="text-3xl font-black text-emerald-300">F&amp;B</span>
              <span className="mt-1 text-[10px] tracking-widest text-emerald-200/70">
                LAB PACK
              </span>
            </div>
          )}
          <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-200">
            Toca para revelar
          </span>
        </div>

        {/* Card Front */}
        <div
          className={`tcg-card-face tcg-card-front absolute inset-0 flex flex-col justify-between rounded-2xl border-2 bg-slate-900/95 p-3.5 shadow-xl ${
            style.border
          } ${style.glow} ${locked ? "opacity-55 grayscale-[45%]" : ""}`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              {SLOT_NAMES[part.slot]}
            </span>
            <div className="flex items-center gap-1.5">
              {isNew === true && (
                <span className="rounded-full bg-emerald-500/25 px-2 py-0.5 text-[10px] font-bold text-emerald-200">
                  NUEVA
                </span>
              )}
              {duplicateCoins !== undefined && duplicateCoins > 0 && (
                <span className="rounded-full bg-amber-500/25 px-2 py-0.5 text-[10px] font-bold text-amber-200">
                  +{duplicateCoins} FC
                </span>
              )}
              {ownedQuantity !== undefined && ownedQuantity > 0 && (
                <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-300">
                  x{ownedQuantity}
                </span>
              )}
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${style.badge}`}>
                {style.label}
              </span>
            </div>
          </div>

          <h3 className="mt-1.5 truncate text-sm font-bold text-white">
            {part.name}
          </h3>

          <div className="mt-2">
            <PartArtwork
              imageUrl={part.cardAssetUrl ?? part.assetUrl}
              alt={part.name}
              slot={part.slot}
              rarity={part.rarity}
              className="h-32 w-full"
            />
          </div>

          <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-slate-300">
            {part.description}
          </p>

          <div className="mt-2 grid grid-cols-2 gap-1.5 text-[11px] font-semibold">
            <span className="rounded-md bg-slate-800/90 px-2 py-1 text-emerald-300">
              {formatDelta("HP", part.modifiers.hpDelta, 5)}
            </span>
            <span className="rounded-md bg-slate-800/90 px-2 py-1 text-rose-300">
              {formatDelta("ATK", part.modifiers.atkDelta)}
            </span>
            <span className="rounded-md bg-slate-800/90 px-2 py-1 text-sky-300">
              {formatDelta("DEF", part.modifiers.defDelta)}
            </span>
            <span className="rounded-md bg-slate-800/90 px-2 py-1 text-violet-300">
              {formatDelta("MOV", part.modifiers.movDelta, 5)}
            </span>
          </div>

          {part.trait && (
            <div className="mt-2 rounded-lg border border-amber-400/40 bg-amber-500/10 px-2 py-1 text-[10px] text-amber-200">
              <strong>{part.trait.name}:</strong> {part.trait.description}
            </div>
          )}

          {locked && (
            <div className="mt-2 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Bloqueada · Abre sobres para obtenerla
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
