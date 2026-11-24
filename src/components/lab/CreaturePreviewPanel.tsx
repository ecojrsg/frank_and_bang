"use client";

// @Author: Jonathan Serna
// @Date:   2026-11-23 22:00:00
// @Last Modified by:   Jonathan Serna
// @Last Modified time: 2026-11-23 22:00:00

/**
 * Interactive dual live Canvas preview of the player's assembled creature
 * showing both the detailed Laboratory assembly and how it looks in 2D combat.
 */

import { useEffect, useRef, useState } from "react";

import { getHighestLoadoutRarity } from "@/domain/statsCalculator";
import type { Loadout } from "@/domain/types";
import {
  buildAppearanceFromLoadout,
  drawAssembledCreature,
} from "@/engine/creatureRenderer";

interface CreaturePreviewPanelProps {
  loadout: Loadout;
  displayName: string;
}

/**
 * Render an animated dual preview (Lab pedestal + In-Game 2D Arena slice).
 */
export function CreaturePreviewPanel({
  loadout,
  displayName,
}: CreaturePreviewPanelProps) {
  const labCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [facing, setFacing] = useState<1 | -1>(1);
  const [previewAngle, setPreviewAngle] = useState(42);

  useEffect(() => {
    let frameId = 0;
    const appearance = buildAppearanceFromLoadout(loadout);
    const highest = getHighestLoadoutRarity(loadout);
    const teamColor =
      highest === "unique"
        ? "#fbbf24"
        : highest === "rare"
          ? "#38bdf8"
          : "#34d399";

    const renderFrame = (nowMs: number) => {
      const timeSec = nowMs / 1000;

      // 1. Laboratory pedestal canvas (zoomed assembled view).
      const labCanvas = labCanvasRef.current;
      if (labCanvas) {
        const ctx = labCanvas.getContext("2d");
        if (ctx) {
          const w = labCanvas.width;
          const h = labCanvas.height;
          ctx.clearRect(0, 0, w, h);

          const bg = ctx.createRadialGradient(w / 2, h * 0.48, 12, w / 2, h * 0.5, 160);
          bg.addColorStop(0, "#1e293b");
          bg.addColorStop(1, "#090d16");
          ctx.fillStyle = bg;
          ctx.fillRect(0, 0, w, h);

          // Blueprint grid lines.
          ctx.strokeStyle = "rgba(148, 163, 184, 0.08)";
          ctx.lineWidth = 1;
          for (let gx = 20; gx < w; gx += 24) {
            ctx.beginPath();
            ctx.moveTo(gx, 0);
            ctx.lineTo(gx, h);
            ctx.stroke();
          }
          for (let gy = 20; gy < h; gy += 24) {
            ctx.beginPath();
            ctx.moveTo(0, gy);
            ctx.lineTo(w, gy);
            ctx.stroke();
          }

          // Illuminated metallic pedestal.
          ctx.fillStyle = "#1e293b";
          ctx.strokeStyle = "#475569";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.ellipse(w / 2, h * 0.84, 84, 16, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          drawAssembledCreature(ctx, {
            x: w / 2,
            y: h * 0.82,
            facing,
            aimAngleDeg: previewAngle,
            appearance,
            teamColor,
            scale: 2.05,
            timeSec,
            isAlive: true,
          });
        }
      }

      // 2. Mini in-game 2D Arena slice preview.
      const gameCanvas = gameCanvasRef.current;
      if (gameCanvas) {
        const ctx = gameCanvas.getContext("2d");
        if (ctx) {
          const w = gameCanvas.width;
          const h = gameCanvas.height;
          ctx.clearRect(0, 0, w, h);

          const sky = ctx.createLinearGradient(0, 0, 0, h);
          sky.addColorStop(0, "#0b1120");
          sky.addColorStop(1, "#1e293b");
          ctx.fillStyle = sky;
          ctx.fillRect(0, 0, w, h);

          // Rolling mini terrain hill.
          ctx.beginPath();
          ctx.moveTo(0, h);
          for (let px = 0; px <= w; px += 6) {
            const groundY = h * 0.78 + Math.sin(px * 0.02) * 8;
            ctx.lineTo(px, groundY);
          }
          ctx.lineTo(w, h);
          ctx.closePath();
          ctx.fillStyle = "#1e293b";
          ctx.fill();

          ctx.beginPath();
          for (let px = 0; px <= w; px += 6) {
            const groundY = h * 0.78 + Math.sin(px * 0.02) * 8;
            if (px === 0) ctx.moveTo(px, groundY);
            else ctx.lineTo(px, groundY);
          }
          ctx.strokeStyle = "#34d399";
          ctx.lineWidth = 3;
          ctx.stroke();

          const fighterX = w * 0.42;
          const fighterY = h * 0.78 + Math.sin(fighterX * 0.02) * 8;

          drawAssembledCreature(ctx, {
            x: fighterX,
            y: fighterY,
            facing,
            aimAngleDeg: previewAngle,
            appearance,
            teamColor: "#34d399",
            scale: 1,
            timeSec,
            isAlive: true,
            isActiveTurn: true,
            displayName,
            hp: 100,
            maxHp: 100,
          });

          // Animated aiming trajectory preview dots.
          const rad = (previewAngle * Math.PI) / 180;
          const speed = 390;
          const vx = Math.cos(rad) * speed * facing;
          const vy = -Math.sin(rad) * speed;
          ctx.fillStyle = "rgba(251, 191, 36, 0.75)";
          for (let step = 1; step <= 6; step++) {
            const t = step * 0.065;
            const dotX = fighterX + facing * 18 + vx * t;
            const dotY = fighterY - 32 + vy * t + 0.5 * 520 * t * t;
            ctx.beginPath();
            ctx.arc(dotX, dotY, 2.4, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      frameId = window.requestAnimationFrame(renderFrame);
    };

    frameId = window.requestAnimationFrame(renderFrame);
    return () => window.cancelAnimationFrame(frameId);
  }, [loadout, displayName, facing, previewAngle]);

  return (
    <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/85 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-300">
          Vista Ensamblada en Vivo
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setFacing((prev) => (prev === 1 ? -1 : 1))}
            className="rounded-lg border border-slate-700 px-2 py-1 text-[10px] font-bold text-slate-200 hover:border-emerald-400"
          >
            Voltear
          </button>
          <button
            type="button"
            onClick={() =>
              setPreviewAngle((prev) => (prev >= 70 ? 25 : prev + 15))
            }
            className="rounded-lg border border-slate-700 px-2 py-1 text-[10px] font-bold text-slate-200 hover:border-sky-400"
          >
            Mira {previewAngle}°
          </button>
        </div>
      </div>

      <canvas
        ref={labCanvasRef}
        width={340}
        height={210}
        className="w-full rounded-lg border border-slate-800"
      />

      <div>
        <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-sky-300">
          Asi se vera en el Juego (Arena 2D)
        </div>
        <canvas
          ref={gameCanvasRef}
          width={340}
          height={136}
          className="w-full rounded-lg border border-slate-800"
        />
      </div>
    </div>
  );
}
