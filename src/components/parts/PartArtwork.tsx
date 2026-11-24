"use client";

// @Author: Jonathan Serna
// @Date:   2026-11-23 21:03:00
// @Last Modified by:   Jonathan Serna
// @Last Modified time: 2026-11-23 21:03:00

/**
 * Render a part or TCG card visual directly from the Supabase Storage
 * "parts-assets" bucket (PNG or SVG), falling back gracefully to a geometric
 * technical blueprint when assetUrl is null or unavailable.
 */

import { useState } from "react";

import type { PartRarity, PartSlot } from "@/domain/types";

interface PartArtworkProps {
  imageUrl: string | null;
  alt: string;
  slot: PartSlot;
  rarity: PartRarity;
  className?: string;
}

const SLOT_LABELS: Record<PartSlot, string> = {
  head: "CABEZA",
  torso: "TORSO",
  arms: "BRAZOS",
  legs: "PIERNAS",
};

const RARITY_STROKE: Record<PartRarity, string> = {
  normal: "#94a3b8",
  rare: "#38bdf8",
  unique: "#fbbf24",
};

/**
 * Render an SVG/PNG image from Supabase Storage or a clean blueprint fallback.
 */
export function PartArtwork({
  imageUrl,
  alt,
  slot,
  rarity,
  className = "h-36 w-full",
}: PartArtworkProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const canShowImage = Boolean(imageUrl) && failedUrl !== imageUrl;

  if (canShowImage && imageUrl) {
    return (
      <div
        className={`relative flex items-center justify-center overflow-hidden rounded-xl border border-slate-800 bg-[#11151d] p-2 ${className}`}
      >
        <img
          src={imageUrl}
          alt={alt}
          className="h-full w-full object-contain"
          onError={() => setFailedUrl(imageUrl)}
        />
      </div>
    );
  }

  const accent = RARITY_STROKE[rarity];
  return (
    <div
      className={`relative flex flex-col items-center justify-center overflow-hidden rounded-xl border border-slate-800 bg-[#11151d] p-3 ${className}`}
    >
      <svg
        viewBox="0 0 120 90"
        className="h-24 w-28"
        role="img"
        aria-label={alt}
      >
        <rect
          x="8"
          y="8"
          width="104"
          height="74"
          rx="8"
          fill="#151c29"
          stroke="#273247"
          strokeDasharray="3 3"
        />
        {slot === "head" && (
          <g stroke={accent} strokeWidth="2.4" fill="#1e293b">
            <rect x="40" y="20" width="40" height="44" rx="8" />
            <line x1="30" y1="42" x2="40" y2="42" />
            <line x1="80" y1="42" x2="90" y2="42" />
            <circle cx="52" cy="38" r="3.5" fill={accent} />
            <circle cx="68" cy="38" r="3.5" fill={accent} />
            <line x1="48" y1="53" x2="72" y2="53" />
          </g>
        )}
        {slot === "torso" && (
          <g stroke={accent} strokeWidth="2.4" fill="#1e293b">
            <polygon points="36,20 84,20 76,68 44,68" />
            <circle cx="60" cy="42" r="9" fill="#0f172a" />
            <line x1="44" y1="30" x2="76" y2="30" />
            <line x1="47" y1="56" x2="73" y2="56" />
          </g>
        )}
        {slot === "arms" && (
          <g stroke={accent} strokeWidth="2.4" fill="#1e293b">
            <rect x="20" y="34" width="32" height="14" rx="4" />
            <rect x="52" y="37" width="34" height="10" rx="3" />
            <circle cx="52" cy="41" r="6" />
            <path d="M86 32 L100 32 L100 38 M86 52 L100 52 L100 46" fill="none" />
          </g>
        )}
        {slot === "legs" && (
          <g stroke={accent} strokeWidth="2.4" fill="#1e293b">
            <rect x="34" y="20" width="52" height="12" rx="4" />
            <rect x="40" y="32" width="12" height="32" rx="3" />
            <rect x="68" y="32" width="12" height="32" rx="3" />
            <rect x="34" y="64" width="22" height="8" rx="3" />
            <rect x="64" y="64" width="22" height="8" rx="3" />
          </g>
        )}
      </svg>
      <span className="mt-1 text-[10px] font-semibold tracking-widest text-slate-400">
        PLANO TECNICO · {SLOT_LABELS[slot]}
      </span>
    </div>
  );
}
