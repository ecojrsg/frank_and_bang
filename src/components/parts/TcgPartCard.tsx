"use client";

// @Author: Jonathan Serna
// @Date:   2026-11-23 21:03:00
// @Last Modified by:   Jonathan Serna
// @Last Modified time: 2026-11-23 23:36:00

/**
 * Collectible bio-industrial TCG specimen card with 3D flip reveal, sharp
 * 0px blueprint geometry, copper/radioactive rarity tiers, and parts-assets art.
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
  { border: string; badge: string; label: string }
> = {
  normal: {
    border: "border-[#3A3D4A]",
    badge: "border border-[#3A3D4A] bg-[#22242C] text-[#B0AEA6]",
    label: "Normal",
  },
  rare: {
    border: "border-[#D47E3F]",
    badge: "border border-[#D47E3F] bg-[#D47E3F]/15 text-[#EB9C5C]",
    label: "Rara",
  },
  unique: {
    border: "border-[#52FF2E]",
    badge: "border border-[#52FF2E] bg-[#52FF2E]/15 text-[#52FF2E]",
    label: "Única",
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
        className={`tcg-card-inner relative min-h-[356px] w-full ${
          revealed ? "is-flipped" : "cursor-pointer"
        }`}
      >
        {/* Card Back */}
        <div className="tcg-card-face blueprint-dots absolute inset-0 flex flex-col items-center justify-between border border-[#D47E3F] p-4 transition hover:border-[#52FF2E]">
          <div className="flex w-full items-center justify-between font-mono text-[10px] tracking-[0.18em] text-[#EB9C5C]">
            <span>F&amp;B // TCG</span>
            <span>SELLADO</span>
          </div>

          {cardBackUrl && !backFailed ? (
            <img
              src={cardBackUrl}
              alt="Reverso de tarjeta Frank and Bang"
              className="h-48 w-40 object-contain"
              onError={() => setBackFailed(true)}
            />
          ) : (
            <div className="flex h-44 w-32 flex-col items-center justify-center border border-[#52FF2E]/50 bg-[#181920]">
              <span className="font-display text-3xl font-bold text-[#52FF2E]">
                F&amp;B
              </span>
              <span className="mt-1 font-mono text-[10px] tracking-widest text-[#EB9C5C]">
                SPECIMEN
              </span>
            </div>
          )}

          <span className="border border-[#52FF2E]/60 bg-[#52FF2E]/15 px-3 py-1 font-mono text-[11px] font-bold tracking-wider text-[#52FF2E] uppercase">
            Toca para revelar
          </span>
        </div>

        {/* Card Front */}
        <div
          className={`tcg-card-face tcg-card-front absolute inset-0 flex flex-col justify-between border bg-[#1B1C22] p-3.5 ${
            style.border
          } ${locked ? "opacity-55 grayscale-[45%]" : ""}`}
        >
          <div className="flex items-center justify-between gap-2 font-mono text-[10px]">
            <span className="font-bold tracking-widest text-[#8E8D86] uppercase">
              {SLOT_NAMES[part.slot]}
            </span>
            <div className="flex items-center gap-1.5">
              {isNew === true && (
                <span className="bg-[#52FF2E] px-1.5 py-0.5 font-bold text-[#121216]">
                  NUEVA
                </span>
              )}
              {duplicateCoins !== undefined && duplicateCoins > 0 && (
                <span className="border border-[#D47E3F] bg-[#D47E3F]/20 px-1.5 py-0.5 font-bold text-[#EB9C5C] tabular-nums">
                  +{duplicateCoins} FC
                </span>
              )}
              {ownedQuantity !== undefined && ownedQuantity > 0 && (
                <span className="border border-[#3A3D4A] bg-[#15151A] px-1.5 py-0.5 font-bold text-[#ECEAE4] tabular-nums">
                  x{ownedQuantity}
                </span>
              )}
              <span className={`px-2 py-0.5 font-bold uppercase ${style.badge}`}>
                {style.label}
              </span>
            </div>
          </div>

          <h3 className="mt-1.5 truncate font-display text-base font-bold text-[#ECEAE4]">
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

          <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-[#B0AEA6]">
            {part.description}
          </p>

          <div className="mt-2 grid grid-cols-2 gap-px bg-[#2B2D38] font-mono text-[11px] font-bold tabular-nums">
            <span className="bg-[#15151A] px-2 py-1 text-[#52FF2E]">
              {formatDelta("HP", part.modifiers.hpDelta, 5)}
            </span>
            <span className="bg-[#15151A] px-2 py-1 text-[#EB9C5C]">
              {formatDelta("ATK", part.modifiers.atkDelta)}
            </span>
            <span className="bg-[#15151A] px-2 py-1 text-[#ECEAE4]">
              {formatDelta("DEF", part.modifiers.defDelta)}
            </span>
            <span className="bg-[#15151A] px-2 py-1 text-[#8E8D86]">
              {formatDelta("MOV", part.modifiers.movDelta, 5)}
            </span>
          </div>

          {part.trait && (
            <div className="mt-2 border border-[#D47E3F]/50 bg-[#D47E3F]/10 px-2 py-1 font-mono text-[10px] text-[#EB9C5C]">
              <strong>{part.trait.name}:</strong> {part.trait.description}
            </div>
          )}

          {locked && (
            <div className="mt-2 text-center font-mono text-[10px] font-bold tracking-wider text-[#8E8D86] uppercase">
              Bloqueada · Abre sobres para desbloquear
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
