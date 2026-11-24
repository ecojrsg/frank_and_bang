"use client";

// @Author: Jonathan Serna
// @Date:   2026-11-23 21:06:00
// @Last Modified by:   Jonathan Serna
// @Last Modified time: 2026-11-23 23:38:00

/**
 * Full-viewport HTML5 Canvas 2D engine for dynamically sized destructible Worms
 * battlefields featuring responsive 2K/ultrawide zoom, mouse-wheel zoom out/in,
 * dynamic Camera2D tracking, assembled 4-part creatures, VFX, and minimap.
 */

import { useEffect, useRef, useState } from "react";

import {
  applyCameraZoomDelta,
  createInitialCamera,
  focusCameraOnPoint,
  getEffectiveViewport,
  panCameraManual,
  recenterCamera,
  stepCamera,
  type CameraState,
} from "@/domain/cameraEngine";
import { GRAVITY_PX_PER_SEC2, MAX_LAUNCH_SPEED, MIN_LAUNCH_SPEED } from "@/domain/physicsEngine";
import { getTraitBonus } from "@/domain/statsCalculator";
import type { FighterState, MatchSnapshot } from "@/domain/types";

import { drawAssembledCreature } from "./creatureRenderer";
import { soundEngine } from "./soundEngine";
import {
  createVfxState,
  drawVfx,
  spawnExplosionVfx,
  spawnProjectileTrail,
  stepVfx,
} from "./vfxEngine";

interface ArenaCanvasProps {
  snapshot: MatchSnapshot;
  localPlayerId: string;
  chargePower: number;
  recenterNonce: number;
  resetViewNonce: number;
}

const MINIMAP_WIDTH = 220;
const MINIMAP_HEIGHT = 90;

/**
 * Draw layered parallax night sky, moon, stars, and distant lab silhouettes.
 */
function drawParallaxBackdrop(
  ctx: CanvasRenderingContext2D,
  viewW: number,
  viewH: number,
  camX: number,
  camY: number
) {
  const sky = ctx.createLinearGradient(0, 0, 0, viewH);
  sky.addColorStop(0, "#0F1015");
  sky.addColorStop(0.58, "#181A22");
  sky.addColorStop(1, "#241E1A");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, viewW, viewH);

  // Subtle parallax bio-green moon & copper-tinted atmospheric particles.
  const moonX = viewW * 0.78 - camX * 0.06;
  const moonY = Math.max(70, viewH * 0.18 - camY * 0.04);
  ctx.fillStyle = "rgba(82, 255, 46, 0.1)";
  ctx.beginPath();
  ctx.arc(moonX, moonY, 46, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(236, 234, 228, 0.74)";
  ctx.beginPath();
  ctx.arc(moonX, moonY, 26, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(212, 126, 63, 0.36)";
  for (let i = 0; i < 60; i++) {
    const sx = ((i * 157 + 41) % 2400) - camX * 0.12;
    const sy = ((i * 89 + 29) % 520) - camY * 0.08;
    if (sx >= 0 && sx <= viewW && sy >= 0 && sy <= viewH) {
      ctx.fillRect(sx, sy, i % 4 === 0 ? 2.2 : 1.4, i % 4 === 0 ? 2.2 : 1.4);
    }
  }

  // Distant industrial lab spire silhouettes with subtle copper edge trim.
  ctx.fillStyle = "rgba(20, 21, 27, 0.82)";
  ctx.strokeStyle = "rgba(212, 126, 63, 0.22)";
  ctx.lineWidth = 1;
  for (let idx = 0; idx < 10; idx++) {
    const towerX = idx * 320 - (camX * 0.25) % 320;
    const towerH = 110 + ((idx * 47) % 85);
    ctx.fillRect(towerX, viewH - towerH, 86, towerH);
    ctx.strokeRect(towerX, viewH - towerH, 86, towerH);
    ctx.beginPath();
    ctx.moveTo(towerX - 6, viewH - towerH);
    ctx.lineTo(towerX + 43, viewH - towerH - 34);
    ctx.lineTo(towerX + 92, viewH - towerH);
    ctx.closePath();
    ctx.fill();
  }
}

/**
 * Draw the visible slice of the destructible terrain polygon.
 */
function drawWorldTerrain(
  ctx: CanvasRenderingContext2D,
  heightMap: number[],
  worldW: number,
  worldH: number,
  camX: number,
  camY: number,
  viewW: number,
  viewH: number
) {
  if (heightMap.length === 0) {
    return;
  }

  const startX = Math.max(0, Math.floor(camX) - 4);
  const endX = Math.min(worldW - 1, Math.ceil(camX + viewW) + 4);
  const bottomY = Math.max(worldH, camY + viewH + 140);

  ctx.beginPath();
  ctx.moveTo(startX, bottomY);
  for (let x = startX; x <= endX; x++) {
    ctx.lineTo(x, heightMap[x]);
  }
  ctx.lineTo(endX, bottomY);
  ctx.closePath();

  const soil = ctx.createLinearGradient(0, worldH * 0.35, 0, worldH);
  soil.addColorStop(0, "#2E313B");
  soil.addColorStop(0.45, "#1E2027");
  soil.addColorStop(1, "#131419");
  ctx.fillStyle = soil;
  ctx.fill();

  // Radioactive bio-green crust highlights carved explosion craters sharply.
  ctx.beginPath();
  ctx.moveTo(startX, heightMap[startX]);
  for (let x = startX + 1; x <= endX; x++) {
    ctx.lineTo(x, heightMap[x]);
  }
  ctx.strokeStyle = "#52FF2E";
  ctx.lineWidth = 4.5;
  ctx.stroke();
}

/**
 * Draw dotted parabolic trajectory preview from the active aiming arm.
 */
function drawAimPreview(
  ctx: CanvasRenderingContext2D,
  fighter: FighterState,
  chargePower: number
) {
  const effectivePower = Math.max(0.2, chargePower || 0.52);
  const speedBonusPct = getTraitBonus(fighter.activeTraits, "launch_speed_pct");
  const speed =
    (MIN_LAUNCH_SPEED + (MAX_LAUNCH_SPEED - MIN_LAUNCH_SPEED) * effectivePower) *
    (1 + speedBonusPct / 100);
  const radians = (fighter.aimAngleDeg * Math.PI) / 180;
  const vx = Math.cos(radians) * speed * fighter.facing;
  const vy = -Math.sin(radians) * speed;
  const startX = fighter.x + fighter.facing * 18;
  const startY = fighter.y - 32;

  ctx.fillStyle = chargePower > 0 ? "#EB9C5C" : "rgba(236, 234, 228, 0.72)";
  for (let step = 1; step <= 10; step++) {
    const t = step * 0.065;
    const px = startX + vx * t;
    const py = startY + vy * t + 0.5 * GRAVITY_PX_PER_SEC2 * t * t;
    ctx.beginPath();
    ctx.arc(px, py, Math.max(1.8, 3.6 - step * 0.18), 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Draw the tactical minimap corner overlay showing terrain, fighters, and camera.
 */
function drawMinimap(
  ctx: CanvasRenderingContext2D,
  snapshot: MatchSnapshot,
  camera: CameraState,
  viewW: number,
  viewH: number
) {
  const scaleX = MINIMAP_WIDTH / snapshot.terrainWidth;
  const scaleY = MINIMAP_HEIGHT / snapshot.terrainHeight;

  ctx.clearRect(0, 0, MINIMAP_WIDTH, MINIMAP_HEIGHT);
  ctx.fillStyle = "rgba(19, 20, 24, 0.92)";
  ctx.fillRect(0, 0, MINIMAP_WIDTH, MINIMAP_HEIGHT);

  ctx.beginPath();
  ctx.moveTo(0, MINIMAP_HEIGHT);
  for (let x = 0; x < snapshot.heightMap.length; x += 12) {
    ctx.lineTo(x * scaleX, snapshot.heightMap[x] * scaleY);
  }
  ctx.lineTo(MINIMAP_WIDTH, MINIMAP_HEIGHT);
  ctx.closePath();
  ctx.fillStyle = "#2E313B";
  ctx.fill();

  for (const fighter of snapshot.fighters) {
    if (fighter.hp <= 0) {
      continue;
    }
    ctx.fillStyle = fighter.teamColor;
    ctx.beginPath();
    ctx.arc(fighter.x * scaleX, (fighter.y - 14) * scaleY, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  if (snapshot.projectile) {
    ctx.fillStyle = "#D47E3F";
    ctx.beginPath();
    ctx.arc(
      snapshot.projectile.x * scaleX,
      snapshot.projectile.y * scaleY,
      3,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }

  ctx.strokeStyle = "#D47E3F";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(
    camera.x * scaleX,
    camera.y * scaleY,
    Math.min(MINIMAP_WIDTH, viewW * scaleX),
    Math.min(MINIMAP_HEIGHT, viewH * scaleY)
  );
}

/**
 * Render the fullscreen 2D Worms battlefield with dynamic Camera2D & minimap.
 */
export function ArenaCanvas({
  snapshot,
  localPlayerId,
  chargePower,
  recenterNonce,
  resetViewNonce,
}: ArenaCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const minimapRef = useRef<HTMLCanvasElement | null>(null);

  const snapshotRef = useRef(snapshot);
  const localIdRef = useRef(localPlayerId);
  const chargeRef = useRef(chargePower);
  const viewportRef = useRef({ width: 1280, height: 720 });
  const cameraRef = useRef<CameraState | null>(null);
  const vfxRef = useRef(createVfxState());
  const dragRef = useRef<{ active: boolean; lastX: number; lastY: number }>({
    active: false,
    lastX: 0,
    lastY: 0,
  });

  const [isScouting, setIsScouting] = useState(false);
  const [zoomPercent, setZoomPercent] = useState(100);

  useEffect(() => {
    snapshotRef.current = snapshot;
    localIdRef.current = localPlayerId;
    chargeRef.current = chargePower;

    // Exit manual scouting automatically when firing.
    if (snapshot.phase === "projectile" && cameraRef.current?.mode === "manual_scout") {
      cameraRef.current = recenterCamera(cameraRef.current, false);
      setIsScouting(false);
    }
  }, [snapshot, localPlayerId, chargePower]);

  useEffect(() => {
    if (recenterNonce > 0 && cameraRef.current) {
      cameraRef.current = recenterCamera(cameraRef.current, false);
      setIsScouting(false);
    }
  }, [recenterNonce]);

  useEffect(() => {
    if (resetViewNonce > 0 && cameraRef.current) {
      cameraRef.current = recenterCamera(cameraRef.current, true);
      setIsScouting(false);
      setZoomPercent(100);
    }
  }, [resetViewNonce]);

  // Attach non-passive wheel listener so scrolling zooms out/in cleanly.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      if (!cameraRef.current) {
        return;
      }

      const snap = snapshotRef.current;
      const { width: screenW, height: screenH } = viewportRef.current;
      const nextCam = applyCameraZoomDelta(
        cameraRef.current,
        event.deltaY,
        screenW,
        screenH,
        snap.terrainWidth,
        snap.terrainHeight
      );
      cameraRef.current = nextCam;
      setZoomPercent(Math.round(nextCam.targetZoomFactor * 100));
    };

    canvas.addEventListener("wheel", handleWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", handleWheel);
  }, []);

  // Keep canvas sized precisely to the fullscreen container via ResizeObserver.
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) {
      return;
    }

    const syncSize = () => {
      const rect = container.getBoundingClientRect();
      const width = Math.max(320, Math.round(rect.width));
      const height = Math.max(320, Math.round(rect.height));
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      viewportRef.current = { width, height };
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    };

    syncSize();
    const observer = new ResizeObserver(syncSize);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Main 60fps animation loop: camera smoothing, VFX envelopes, and rendering.
  useEffect(() => {
    let frameId = 0;
    let lastTimeMs = performance.now();
    let trailTimer = 0;

    const tick = (nowMs: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (nowMs - lastTimeMs) / 1000));
      lastTimeMs = nowMs;

      const snap = snapshotRef.current;
      const { width: screenW, height: screenH } = viewportRef.current;

      if (!cameraRef.current) {
        const initialVp = getEffectiveViewport(
          screenW,
          screenH,
          1,
          snap.terrainWidth,
          snap.terrainHeight
        );
        const focusFighter =
          snap.fighters.find((f) => f.playerId === snap.activePlayerId) ??
          snap.fighters[0];
        cameraRef.current = createInitialCamera(
          focusFighter?.x ?? snap.terrainWidth / 2,
          focusFighter?.y ?? snap.terrainHeight / 2,
          initialVp.viewW,
          initialVp.viewH,
          snap.terrainWidth,
          snap.terrainHeight,
          snap.turnNumber
        );
      }

      // Detect newly resolved explosion once to trigger VFX & audio.
      const explosion = snap.lastExplosion;
      if (explosion && explosion.explosionId > vfxRef.current.lastExplosionId) {
        spawnExplosionVfx(vfxRef.current, explosion);
        const directHit = explosion.damages.some((d) => d.directHit);
        soundEngine.playExplosion(directHit);
      }

      if (snap.phase === "projectile" && snap.projectile) {
        trailTimer += dt;
        if (trailTimer >= 0.03) {
          trailTimer = 0;
          spawnProjectileTrail(
            vfxRef.current,
            snap.projectile.x,
            snap.projectile.y
          );
        }
      }

      cameraRef.current = stepCamera(
        cameraRef.current,
        snap,
        dt,
        screenW,
        screenH
      );
      const { zoom, viewW: effW, viewH: effH } = getEffectiveViewport(
        screenW,
        screenH,
        cameraRef.current.zoomFactor,
        snap.terrainWidth,
        snap.terrainHeight
      );
      stepVfx(vfxRef.current, dt);

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (canvas && ctx) {
        const dpr = canvas.width / screenW;
        const cam = cameraRef.current;
        const shakeX =
          cam.shakeIntensity > 0.2
            ? (Math.random() - 0.5) * cam.shakeIntensity * 2
            : 0;
        const shakeY =
          cam.shakeIntensity > 0.2
            ? (Math.random() - 0.5) * cam.shakeIntensity * 2
            : 0;

        ctx.save();
        ctx.scale(dpr, dpr);

        drawParallaxBackdrop(ctx, screenW, screenH, cam.x, cam.y);

        // Enter zoomed world-space camera transform for ultrawide/2K support.
        ctx.save();
        ctx.scale(zoom, zoom);
        ctx.translate(-cam.x + shakeX, -cam.y + shakeY);

        drawWorldTerrain(
          ctx,
          snap.heightMap,
          snap.terrainWidth,
          snap.terrainHeight,
          cam.x,
          cam.y,
          effW,
          effH
        );

        const timeSec = nowMs / 1000;
        for (const fighter of snap.fighters) {
          const isTurn =
            snap.phase === "aiming" && snap.activePlayerId === fighter.playerId;

          drawAssembledCreature(ctx, {
            x: fighter.x,
            y: fighter.y,
            facing: fighter.facing,
            aimAngleDeg: fighter.aimAngleDeg,
            appearance: fighter.appearance,
            teamColor: fighter.teamColor,
            scale: 1,
            timeSec,
            isAlive: fighter.hp > 0,
            isActiveTurn: isTurn,
            displayName: fighter.displayName,
            hp: fighter.hp,
            maxHp: fighter.maxHp,
          });

          if (isTurn && fighter.playerId === localIdRef.current) {
            drawAimPreview(ctx, fighter, chargeRef.current);
          }
        }

        if (snap.projectile) {
          const { x, y } = snap.projectile;
          ctx.beginPath();
          ctx.arc(x, y, 7, 0, Math.PI * 2);
          ctx.fillStyle = "#f97316";
          ctx.fill();
          ctx.strokeStyle = "#fef08a";
          ctx.lineWidth = 2.2;
          ctx.stroke();
        }

        drawVfx(ctx, vfxRef.current);
        ctx.restore();
        ctx.restore();

        const miniCtx = minimapRef.current?.getContext("2d");
        if (miniCtx) {
          drawMinimap(miniCtx, snap, cam, effW, effH);
        }
      }

      frameId = window.requestAnimationFrame(tick);
    };

    frameId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frameId);
  }, []);

  function handlePointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    dragRef.current = {
      active: true,
      lastX: event.clientX,
      lastY: event.clientY,
    };
  }

  function handlePointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!dragRef.current.active || !cameraRef.current) {
      return;
    }
    const dx = dragRef.current.lastX - event.clientX;
    const dy = dragRef.current.lastY - event.clientY;
    dragRef.current.lastX = event.clientX;
    dragRef.current.lastY = event.clientY;

    if (Math.abs(dx) + Math.abs(dy) < 1) {
      return;
    }

    const snap = snapshotRef.current;
    const { width: screenW, height: screenH } = viewportRef.current;
    const { zoom, viewW: effW, viewH: effH } = getEffectiveViewport(
      screenW,
      screenH,
      cameraRef.current.zoomFactor,
      snap.terrainWidth,
      snap.terrainHeight
    );
    cameraRef.current = panCameraManual(
      cameraRef.current,
      dx / zoom,
      dy / zoom,
      effW,
      effH,
      snap.terrainWidth,
      snap.terrainHeight
    );
    setIsScouting(true);
  }

  function handlePointerUp() {
    dragRef.current.active = false;
  }

  function handleMinimapClick(event: React.MouseEvent<HTMLCanvasElement>) {
    if (!cameraRef.current || !minimapRef.current) {
      return;
    }
    const rect = minimapRef.current.getBoundingClientRect();
    const relX = (event.clientX - rect.left) / rect.width;
    const relY = (event.clientY - rect.top) / rect.height;
    const snap = snapshotRef.current;
    const { width: screenW, height: screenH } = viewportRef.current;
    const { viewW: effW, viewH: effH } = getEffectiveViewport(
      screenW,
      screenH,
      cameraRef.current.zoomFactor,
      snap.terrainWidth,
      snap.terrainHeight
    );

    cameraRef.current = focusCameraOnPoint(
      cameraRef.current,
      relX * snap.terrainWidth,
      relY * snap.terrainHeight,
      effW,
      effH,
      snap.terrainWidth,
      snap.terrainHeight
    );
    setIsScouting(true);
  }

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden">
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        className="h-full w-full cursor-grab active:cursor-grabbing"
      />

      {/* Tactical Minimap, Wheel Zoom indicator & Scouting hint */}
      <div className="pointer-events-auto absolute right-4 bottom-24 z-20 flex flex-col items-end gap-1.5 sm:bottom-28">
        <div className="flex flex-wrap justify-end gap-1.5">
          {zoomPercent !== 100 && (
            <button
              type="button"
              onClick={() => {
                if (cameraRef.current) {
                  cameraRef.current = recenterCamera(cameraRef.current, true);
                  setZoomPercent(100);
                }
              }}
              className="border border-[#52FF2E]/60 bg-[#15151A]/90 px-3 py-1 font-mono text-[11px] font-bold text-[#52FF2E] shadow-lg hover:bg-[#52FF2E]/15"
            >
              Zoom {zoomPercent}% · Restablecer
            </button>
          )}
          {isScouting && (
            <button
              type="button"
              onClick={() => {
                if (cameraRef.current) {
                  cameraRef.current = recenterCamera(cameraRef.current, false);
                  setIsScouting(false);
                }
              }}
              className="border border-[#D47E3F]/60 bg-[#15151A]/90 px-3 py-1 font-mono text-[11px] font-bold text-[#EB9C5C] shadow-lg hover:bg-[#D47E3F]/15"
            >
              Camara libre · Volver al atacante
            </button>
          )}
        </div>
        <div className="overflow-hidden border border-[#D47E3F]/40 bg-[#15151A]/90 p-1 shadow-2xl backdrop-blur">
          <canvas
            ref={minimapRef}
            width={MINIMAP_WIDTH}
            height={MINIMAP_HEIGHT}
            onClick={handleMinimapClick}
            title="Haz clic en el minimapa o usa la rueda del raton para hacer zoom"
            className="h-[74px] w-[180px] cursor-pointer sm:h-[90px] sm:w-[220px]"
          />
          <div className="mt-0.5 text-center font-mono text-[9px] font-semibold tracking-wider text-[#8E8D86]">
            MINIMAPA · RUEDA: ZOOM · ARRASTRA PARA EXPLORAR
          </div>
        </div>
      </div>
    </div>
  );
}
