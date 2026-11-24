// @Author: Jonathan Serna
// @Date:   2026-11-23 21:58:00
// @Last Modified by:   Jonathan Serna
// @Last Modified time: 2026-11-23 23:06:30

/**
 * Pure 2D cinematic camera controller for large destructible battlefields.
 * Includes responsive zoom for ultrawide/2K/4K displays plus smooth mouse-wheel
 * zoom out/in bounded strictly inside world dimensions so edges never clip.
 */

import type { MatchSnapshot } from "./types";

export const MAX_VISIBLE_WORLD_W = 1120;
export const MAX_VISIBLE_WORLD_H = 620;
export const MAX_USER_ZOOM_FACTOR = 1.2;

export type CameraMode =
  | "follow_attacker"
  | "follow_projectile"
  | "impact_hold"
  | "manual_scout";

export interface CameraState {
  x: number;
  y: number;
  mode: CameraMode;
  holdSecondsLeft: number;
  shakeIntensity: number;
  holdX: number;
  holdY: number;
  lastExplosionId: number;
  zoomFactor: number;
  targetZoomFactor: number;
  lastTurnNumber: number;
}

const IMPACT_HOLD_SECONDS = 0.95;
const INITIAL_SHAKE_PX = 14;
const SHAKE_DECAY_PER_SEC = 24;
const ATTACKER_EASE_SPEED = 5.5;
const PROJECTILE_EASE_SPEED = 11.0;
const ZOOM_EASE_SPEED = 10.0;
const WHEEL_ZOOM_STEP = 0.1;

/**
 * Compute responsive default zoom so high-resolution or ultrawide 2K screens
 * never reveal more than MAX_VISIBLE_WORLD_W x MAX_VISIBLE_WORLD_H units.
 */
export function computeResponsiveZoom(screenW: number, screenH: number): number {
  const safeW = Math.max(320, screenW);
  const safeH = Math.max(320, screenH);
  return Math.max(safeW / MAX_VISIBLE_WORLD_W, safeH / MAX_VISIBLE_WORLD_H, 1);
}

/**
 * Compute the lowest zoomFactor allowed for a screen & world size so zooming
 * out never reveals space outside [0..worldW, 0..worldH].
 */
export function computeMinZoomFactor(
  screenW: number,
  screenH: number,
  worldW: number,
  worldH: number
): number {
  const safeW = Math.max(320, screenW);
  const safeH = Math.max(320, screenH);
  const baseZoom = computeResponsiveZoom(safeW, safeH);
  const fitWorldZoom = Math.max(
    safeW / Math.max(1, worldW),
    safeH / Math.max(1, worldH)
  );
  return Math.min(1, fitWorldZoom / baseZoom);
}

/**
 * Return the zoom factor and effective world-space viewport dimensions.
 */
export function getEffectiveViewport(
  screenW: number,
  screenH: number,
  zoomFactor: number = 1,
  worldW?: number,
  worldH?: number
): { zoom: number; viewW: number; viewH: number } {
  const baseZoom = computeResponsiveZoom(screenW, screenH);
  const minFactor =
    worldW !== undefined && worldH !== undefined
      ? computeMinZoomFactor(screenW, screenH, worldW, worldH)
      : 0.35;
  const safeFactor = Math.max(
    minFactor,
    Math.min(MAX_USER_ZOOM_FACTOR, zoomFactor)
  );
  const zoom = baseZoom * safeFactor;

  return {
    zoom,
    viewW: screenW / zoom,
    viewH: screenH / zoom,
  };
}

/**
 * Clamp camera top-left coordinates within valid world boundaries.
 */
export function clampCameraPosition(
  x: number,
  y: number,
  viewportW: number,
  viewportH: number,
  worldW: number,
  worldH: number
): { x: number; y: number } {
  const maxX = Math.max(0, worldW - viewportW);
  const maxY = Math.max(0, worldH - viewportH);
  return {
    x: Math.max(0, Math.min(maxX, x)),
    y: Math.max(0, Math.min(maxY, y)),
  };
}

/**
 * Create an initial camera centered on the given world coordinates.
 */
export function createInitialCamera(
  focusX: number,
  focusY: number,
  viewportW: number,
  viewportH: number,
  worldW: number,
  worldH: number,
  turnNumber: number = 1
): CameraState {
  const clamped = clampCameraPosition(
    focusX - viewportW / 2,
    focusY - viewportH * 0.68,
    viewportW,
    viewportH,
    worldW,
    worldH
  );

  return {
    x: clamped.x,
    y: clamped.y,
    mode: "follow_attacker",
    holdSecondsLeft: 0,
    shakeIntensity: 0,
    holdX: focusX,
    holdY: focusY,
    lastExplosionId: 0,
    zoomFactor: 1,
    targetZoomFactor: 1,
    lastTurnNumber: turnNumber,
  };
}

/**
 * Adjust target camera zoom from mouse wheel deltaY (down = zoom out, up = zoom in),
 * bounded strictly to keep the entire screen inside the battlefield.
 */
export function applyCameraZoomDelta(
  camera: CameraState,
  wheelDeltaY: number,
  screenW: number,
  screenH: number,
  worldW: number,
  worldH: number
): CameraState {
  if (wheelDeltaY === 0) {
    return camera;
  }

  const minFactor = computeMinZoomFactor(screenW, screenH, worldW, worldH);
  const step = wheelDeltaY > 0 ? -WHEEL_ZOOM_STEP : WHEEL_ZOOM_STEP;
  const nextTarget = Math.max(
    minFactor,
    Math.min(
      MAX_USER_ZOOM_FACTOR,
      Math.round((camera.targetZoomFactor + step) * 100) / 100
    )
  );

  return {
    ...camera,
    targetZoomFactor: nextTarget,
  };
}

/**
 * Pan the camera manually from mouse-drag deltas and enter manual_scout mode.
 */
export function panCameraManual(
  camera: CameraState,
  deltaX: number,
  deltaY: number,
  viewportW: number,
  viewportH: number,
  worldW: number,
  worldH: number
): CameraState {
  const clamped = clampCameraPosition(
    camera.x + deltaX,
    camera.y + deltaY,
    viewportW,
    viewportH,
    worldW,
    worldH
  );

  return {
    ...camera,
    x: clamped.x,
    y: clamped.y,
    mode: "manual_scout",
  };
}

/**
 * Jump the camera immediately to center on a world coordinate (e.g. minimap click).
 */
export function focusCameraOnPoint(
  camera: CameraState,
  worldX: number,
  worldY: number,
  viewportW: number,
  viewportH: number,
  worldW: number,
  worldH: number
): CameraState {
  const clamped = clampCameraPosition(
    worldX - viewportW / 2,
    worldY - viewportH / 2,
    viewportW,
    viewportH,
    worldW,
    worldH
  );

  return {
    ...camera,
    x: clamped.x,
    y: clamped.y,
    mode: "manual_scout",
  };
}

/**
 * Exit manual scouting and optionally reset user zoom back to 1.0.
 */
export function recenterCamera(
  camera: CameraState,
  resetZoom: boolean = false
): CameraState {
  return {
    ...camera,
    mode: camera.mode === "manual_scout" ? "follow_attacker" : camera.mode,
    targetZoomFactor: resetZoom ? 1 : camera.targetZoomFactor,
  };
}

/**
 * Advance the dynamic camera (position + smooth wheel zoom) against MatchSnapshot.
 */
export function stepCamera(
  camera: CameraState,
  snapshot: MatchSnapshot,
  dtSeconds: number,
  screenW: number,
  screenH: number
): CameraState {
  const safeDt = Math.max(0, Math.min(0.1, dtSeconds));
  const nextShake = Math.max(0, camera.shakeIntensity - SHAKE_DECAY_PER_SEC * safeDt);

  const minFactor = computeMinZoomFactor(
    screenW,
    screenH,
    snapshot.terrainWidth,
    snapshot.terrainHeight
  );
  const turnAdvanced =
    camera.lastTurnNumber > 0 && snapshot.turnNumber > camera.lastTurnNumber;
  const nextTargetZoom = turnAdvanced
    ? 1
    : Math.max(minFactor, Math.min(MAX_USER_ZOOM_FACTOR, camera.targetZoomFactor));

  const zoomEase = 1 - Math.exp(-ZOOM_EASE_SPEED * safeDt);
  const nextZoomFactor =
    camera.zoomFactor + (nextTargetZoom - camera.zoomFactor) * zoomEase;

  const prevVp = getEffectiveViewport(
    screenW,
    screenH,
    camera.zoomFactor,
    snapshot.terrainWidth,
    snapshot.terrainHeight
  );
  const nextVp = getEffectiveViewport(
    screenW,
    screenH,
    nextZoomFactor,
    snapshot.terrainWidth,
    snapshot.terrainHeight
  );

  const zoomFields = {
    zoomFactor: nextZoomFactor,
    targetZoomFactor: nextTargetZoom,
    lastTurnNumber: snapshot.turnNumber,
  };

  // Trigger dramatic impact hold & shake once per unique explosionId.
  const explosion = snapshot.lastExplosion;
  if (explosion && explosion.explosionId > camera.lastExplosionId) {
    const target = clampCameraPosition(
      explosion.x - nextVp.viewW / 2,
      explosion.y - nextVp.viewH * 0.55,
      nextVp.viewW,
      nextVp.viewH,
      snapshot.terrainWidth,
      snapshot.terrainHeight
    );
    const factor = 1 - Math.exp(-PROJECTILE_EASE_SPEED * safeDt);
    return {
      ...zoomFields,
      x: camera.x + (target.x - camera.x) * factor,
      y: camera.y + (target.y - camera.y) * factor,
      mode: "impact_hold",
      holdSecondsLeft: IMPACT_HOLD_SECONDS,
      shakeIntensity: INITIAL_SHAKE_PX,
      holdX: explosion.x,
      holdY: explosion.y,
      lastExplosionId: explosion.explosionId,
    };
  }

  // Track flying grenade above manual scouting.
  if (snapshot.phase === "projectile" && snapshot.projectile) {
    const target = clampCameraPosition(
      snapshot.projectile.x - nextVp.viewW / 2,
      snapshot.projectile.y - nextVp.viewH * 0.5,
      nextVp.viewW,
      nextVp.viewH,
      snapshot.terrainWidth,
      snapshot.terrainHeight
    );
    const factor = 1 - Math.exp(-PROJECTILE_EASE_SPEED * safeDt);
    return {
      ...camera,
      ...zoomFields,
      x: camera.x + (target.x - camera.x) * factor,
      y: camera.y + (target.y - camera.y) * factor,
      mode: "follow_projectile",
      shakeIntensity: nextShake,
    };
  }

  // Hold briefly on the crater before gliding to the next turn's attacker.
  if (camera.mode === "impact_hold") {
    const remaining = camera.holdSecondsLeft - safeDt;
    const target = clampCameraPosition(
      camera.holdX - nextVp.viewW / 2,
      camera.holdY - nextVp.viewH * 0.55,
      nextVp.viewW,
      nextVp.viewH,
      snapshot.terrainWidth,
      snapshot.terrainHeight
    );
    const factor = 1 - Math.exp(-ATTACKER_EASE_SPEED * safeDt);
    return {
      ...camera,
      ...zoomFields,
      x: camera.x + (target.x - camera.x) * factor,
      y: camera.y + (target.y - camera.y) * factor,
      mode: remaining > 0 ? "impact_hold" : "follow_attacker",
      holdSecondsLeft: Math.max(0, remaining),
      shakeIntensity: nextShake,
    };
  }

  // Keep visual center anchored cleanly while zooming in manual_scout.
  if (camera.mode === "manual_scout") {
    const centerX = camera.x + prevVp.viewW / 2;
    const centerY = camera.y + prevVp.viewH / 2;
    const clamped = clampCameraPosition(
      centerX - nextVp.viewW / 2,
      centerY - nextVp.viewH / 2,
      nextVp.viewW,
      nextVp.viewH,
      snapshot.terrainWidth,
      snapshot.terrainHeight
    );
    return {
      ...camera,
      ...zoomFields,
      x: clamped.x,
      y: clamped.y,
      shakeIntensity: nextShake,
    };
  }

  const activeFighter =
    snapshot.fighters.find((f) => f.playerId === snapshot.activePlayerId) ??
    snapshot.fighters[0];
  if (!activeFighter) {
    return { ...camera, ...zoomFields, shakeIntensity: nextShake };
  }

  const target = clampCameraPosition(
    activeFighter.x - nextVp.viewW / 2,
    activeFighter.y - nextVp.viewH * 0.68,
    nextVp.viewW,
    nextVp.viewH,
    snapshot.terrainWidth,
    snapshot.terrainHeight
  );
  const factor = 1 - Math.exp(-ATTACKER_EASE_SPEED * safeDt);

  return {
    ...camera,
    ...zoomFields,
    x: camera.x + (target.x - camera.x) * factor,
    y: camera.y + (target.y - camera.y) * factor,
    mode: "follow_attacker",
    shakeIntensity: nextShake,
  };
}
