"use client";

// @Author: Jonathan Serna
// @Date:   2026-11-23 22:00:00
// @Last Modified by:   Jonathan Serna
// @Last Modified time: 2026-11-23 23:36:00

/**
 * Interactive dual live Canvas preview of the player's assembled creature
 * showing both the detailed Laboratory pedestal and the live 2D combat slice
 * in charcoal graphite, radioactive bio-green, and cyberpunk copper.
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
        ? "#52FF2E"
        : highest === "rare"
          ? "#D47E3F"
          : "#B0AEA6";

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

          const bg = ctx.createRadialGradient(w / 2, h * 0.48, 12, w / 2, h * 0.5, 165);
          bg.addColorStop(0, "#1E2028");
          bg.addColorStop(1, "#141418");
          ctx.fillStyle = bg;
          ctx.fillRect(0, 0, w, h);

          // Technical blueprint dot matrix.
          ctx.fillStyle = "rgba(236, 234, 228, 0.14)";
          for (let gx = 16; gx < w; gx += 18) {
            for (let gy = 16; gy < h; gy += 18) {
              ctx.fillRect(gx, gy, 1.2, 1.2);
            }
          }

          // Copper-rimmed graphite pedestal.
          ctx.fillStyle = "#1B1C22";
          ctx.strokeStyle = "#D47E3F";
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

      // 2. Mini in-game 2D Arena slice preview matching the updated Arena palette.
      const gameCanvas = gameCanvasRef.current;
      if (gameCanvas) {
        const ctx = gameCanvas.getContext("2d");
        if (ctx) {
          const w = gameCanvas.width;
          const h = gameCanvas.height;
          ctx.clearRect(0, 0, w, h);

          const sky = ctx.createLinearGradient(0, 0, 0, h);
          sky.addColorStop(0, "#0F1015");
          sky.addColorStop(1, "#1E2028");
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
          ctx.fillStyle = "#252731";
          ctx.fill();

          ctx.beginPath();
          for (let px = 0; px <= w; px += 6) {
            const groundY = h * 0.78 + Math.sin(px * 0.02) * 8;
            if (px === 0) ctx.moveTo(px, groundY);
            else ctx.lineTo(px, groundY);
          }
          ctx.strokeStyle = "#52FF2E";
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
            teamColor: "#52FF2E",
            scale: 1,
            timeSec,
            isAlive: true,
            isActiveTurn: true,
            displayName,
            hp: 100,
            maxHp: 100,
          });

          // Animated copper aiming trajectory preview dots.
          const rad = (previewAngle * Math.PI) / 180;
          const speed = 390;
          const vx = Math.cos(rad) * speed * facing;
          const vy = -Math.sin(rad) * speed;
          ctx.fillStyle = "#EB9C5C";
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
    <div className="space-y-3 border border-[#2B2D38] bg-[#15151A] p-3">
      <div className="flex items-center justify-between gap-2 font-mono">
        <span className="text-[11px] font-bold tracking-wider text-[#52FF2E] uppercase">
          FIG_LAB · Vista en Vivo
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setFacing((prev) => (prev === 1 ? -1 : 1))}
            className="border border-[#3A3D4A] bg-[#1B1C22] px-2 py-1 text-[10px] font-bold text-[#ECEAE4] hover:border-[#52FF2E]"
          >
            Voltear
          </button>
          <button
            type="button"
            onClick={() =>
              setPreviewAngle((prev) => (prev >= 70 ? 25 : prev + 15))
            }
            className="border border-[#3A3D4A] bg-[#1B1C22] px-2 py-1 text-[10px] font-bold text-[#EB9C5C] hover:border-[#D47E3F]"
          >
            Mira {previewAngle}°
          </button>
        </div>
      </div>

      <canvas
        ref={labCanvasRef}
        width={340}
        height={210}
        className="w-full border border-[#2B2D38]"
      />

      <div>
        <div className="mb-1 font-mono text-[10px] font-bold tracking-wider text-[#D47E3F] uppercase">
          Simulación Arena 2D
        </div>
        <canvas
          ref={gameCanvasRef}
          width={340}
          height={136}
          className="w-full border border-[#2B2D38]"
        />
      </div>
    </div>
  );
}
