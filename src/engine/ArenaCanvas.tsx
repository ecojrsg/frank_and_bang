"use client";

// @Author: Jonathan Serna
// @Date:   2026-11-23 21:06:00
// @Last Modified by:   Jonathan Serna
// @Last Modified time: 2026-11-23 21:06:00

/**
 * HTML5 Canvas 2D renderer for the Worms-style destructible battlefield,
 * stylized stickman creatures, grenade trajectory guide, and explosions.
 */

import { useEffect, useRef } from "react";

import { GRAVITY_PX_PER_SEC2 } from "@/domain/physicsEngine";
import { getTraitBonus } from "@/domain/statsCalculator";
import type { FighterState, MatchSnapshot } from "@/domain/types";

interface ArenaCanvasProps {
  snapshot: MatchSnapshot;
  localPlayerId: string;
  chargePower: number;
}

const RARITY_HALO: Record<FighterState["rarityAccent"], string> = {
  normal: "#94a3b8",
  rare: "#38bdf8",
  unique: "#fbbf24",
};

/**
 * Draw the sky gradient and subtle background grid lines.
 */
function drawBackdrop(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, "#0b1120");
  sky.addColorStop(0.65, "#172554");
  sky.addColorStop(1, "#1e293b");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  // Subtle blueprint stars/grid marks.
  ctx.fillStyle = "rgba(148, 163, 184, 0.25)";
  for (let i = 0; i < 36; i++) {
    const sx = (i * 97 + 23) % width;
    const sy = (i * 53 + 17) % Math.round(height * 0.45);
    ctx.fillRect(sx, sy, 2, 2);
  }
}

/**
 * Draw the destructible terrain polygon and green surface crust.
 */
function drawTerrain(
  ctx: CanvasRenderingContext2D,
  heightMap: number[],
  width: number,
  height: number
) {
  if (heightMap.length === 0) {
    return;
  }

  ctx.beginPath();
  ctx.moveTo(0, height);
  for (let x = 0; x < heightMap.length; x++) {
    ctx.lineTo(x, heightMap[x]);
  }
  ctx.lineTo(width, height);
  ctx.closePath();

  const soil = ctx.createLinearGradient(0, height * 0.4, 0, height);
  soil.addColorStop(0, "#334155");
  soil.addColorStop(0.35, "#1e293b");
  soil.addColorStop(1, "#0f172a");
  ctx.fillStyle = soil;
  ctx.fill();

  // Top grass/moss crust highlights carved craters cleanly.
  ctx.beginPath();
  ctx.moveTo(0, heightMap[0]);
  for (let x = 1; x < heightMap.length; x++) {
    ctx.lineTo(x, heightMap[x]);
  }
  ctx.strokeStyle = "#34d399";
  ctx.lineWidth = 4;
  ctx.stroke();
}

/**
 * Draw a stylized Frankenstein stickman fighter with floating HP bar.
 */
function drawFighter(
  ctx: CanvasRenderingContext2D,
  fighter: FighterState,
  isActiveTurn: boolean
) {
  const teamColor = fighter.role === "host" ? "#34d399" : "#38bdf8";
  const haloColor = RARITY_HALO[fighter.rarityAccent];
  const { x, y, facing } = fighter;

  if (fighter.hp <= 0) {
    // Defeated tombstone marker.
    ctx.fillStyle = "#64748b";
    ctx.fillRect(x - 10, y - 16, 20, 16);
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 10px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("KO", x, y - 5);
    return;
  }

  // Active-turn indicator triangle.
  if (isActiveTurn) {
    ctx.fillStyle = "#fbbf24";
    ctx.beginPath();
    ctx.moveTo(x, y - 58);
    ctx.lineTo(x - 6, y - 68);
    ctx.lineTo(x + 6, y - 68);
    ctx.closePath();
    ctx.fill();
  }

  // Stickman body: legs, torso, arms, head + neck bolts.
  ctx.strokeStyle = teamColor;
  ctx.lineWidth = 3;
  ctx.lineCap = "round";

  // Legs
  ctx.beginPath();
  ctx.moveTo(x, y - 13);
  ctx.lineTo(x - 7, y);
  ctx.moveTo(x, y - 13);
  ctx.lineTo(x + 7, y);
  // Torso
  ctx.moveTo(x, y - 13);
  ctx.lineTo(x, y - 28);
  // Aiming arm
  const rad = (fighter.aimAngleDeg * Math.PI) / 180;
  ctx.moveTo(x, y - 24);
  ctx.lineTo(x + Math.cos(rad) * 14 * facing, y - 24 - Math.sin(rad) * 14);
  // Rear arm
  ctx.moveTo(x, y - 24);
  ctx.lineTo(x - 9 * facing, y - 18);
  ctx.stroke();

  // Head circle with rarity ring and Frankenstein bolts.
  ctx.beginPath();
  ctx.arc(x, y - 35, 7.5, 0, Math.PI * 2);
  ctx.fillStyle = "#0f172a";
  ctx.fill();
  ctx.strokeStyle = haloColor;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 10, y - 35);
  ctx.lineTo(x - 7.5, y - 35);
  ctx.moveTo(x + 7.5, y - 35);
  ctx.lineTo(x + 10, y - 35);
  ctx.stroke();

  // Floating name & HP bar.
  const barWidth = 44;
  const hpRatio = Math.max(0, Math.min(1, fighter.hp / fighter.maxHp));
  ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
  ctx.fillRect(x - barWidth / 2, y - 53, barWidth, 6);
  ctx.fillStyle = hpRatio > 0.35 ? teamColor : "#f43f5e";
  ctx.fillRect(x - barWidth / 2, y - 53, barWidth * hpRatio, 6);

  ctx.fillStyle = "#f8fafc";
  ctx.font = "bold 10px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`${fighter.displayName} (${fighter.hp})`, x, y - 56);
}

/**
 * Draw a short dotted aim trajectory arc for the active local player.
 */
function drawAimPreview(
  ctx: CanvasRenderingContext2D,
  fighter: FighterState,
  chargePower: number
) {
  const effectivePower = Math.max(0.25, chargePower || 0.55);
  const speedBonusPct = getTraitBonus(fighter.activeTraits, "launch_speed_pct");
  const speed = (220 + 400 * effectivePower) * (1 + speedBonusPct / 100);
  const radians = (fighter.aimAngleDeg * Math.PI) / 180;
  const vx = Math.cos(radians) * speed * fighter.facing;
  const vy = -Math.sin(radians) * speed;
  const startX = fighter.x + fighter.facing * 14;
  const startY = fighter.y - 24;

  ctx.fillStyle = chargePower > 0 ? "#fbbf24" : "rgba(248, 250, 252, 0.7)";
  for (let step = 1; step <= 8; step++) {
    const t = step * 0.08;
    const px = startX + vx * t;
    const py = startY + vy * t + 0.5 * GRAVITY_PX_PER_SEC2 * t * t;
    ctx.beginPath();
    ctx.arc(px, py, step === 8 ? 2 : 2.8, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Render the 2D Worms-style battlefield canvas synchronized to MatchSnapshot.
 */
export function ArenaCanvas({
  snapshot,
  localPlayerId,
  chargePower,
}: ArenaCanvasProps) {
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

    drawBackdrop(ctx, snapshot.terrainWidth, snapshot.terrainHeight);
    drawTerrain(
      ctx,
      snapshot.heightMap,
      snapshot.terrainWidth,
      snapshot.terrainHeight
    );

    // Draw last explosion ring & floating damage labels briefly.
    if (snapshot.lastExplosion) {
      const { x, y, radius, damages } = snapshot.lastExplosion;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(251, 191, 36, 0.16)";
      ctx.fill();
      ctx.strokeStyle = "rgba(249, 115, 22, 0.7)";
      ctx.lineWidth = 2;
      ctx.stroke();

      damages.forEach((evt, idx) => {
        ctx.fillStyle = "#fde047";
        ctx.font = "bold 13px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(
          `-${evt.damage} HP${evt.directHit ? "!" : ""}`,
          x,
          y - radius * 0.5 - idx * 16
        );
      });
    }

    // Draw fighters and local player's aiming guide.
    for (const fighter of snapshot.fighters) {
      const isTurn =
        snapshot.phase === "aiming" &&
        snapshot.activePlayerId === fighter.playerId;
      drawFighter(ctx, fighter, isTurn);

      if (isTurn && fighter.playerId === localPlayerId) {
        drawAimPreview(ctx, fighter, chargePower);
      }
    }

    // Draw airborne grenade projectile.
    if (snapshot.projectile) {
      const { x, y } = snapshot.projectile;
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fillStyle = "#f97316";
      ctx.fill();
      ctx.strokeStyle = "#fef08a";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }, [snapshot, localPlayerId, chargePower]);

  return (
    <canvas
      ref={canvasRef}
      width={snapshot.terrainWidth}
      height={snapshot.terrainHeight}
      className="w-full rounded-2xl border border-slate-700/80 bg-slate-950 shadow-2xl"
    />
  );
}
