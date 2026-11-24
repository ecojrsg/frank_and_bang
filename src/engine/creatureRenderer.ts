// @Author: Jonathan Serna
// @Date:   2026-11-23 22:00:00
// @Last Modified by:   Jonathan Serna
// @Last Modified time: 2026-11-23 22:00:00

/**
 * Shared modular 2D Canvas creature renderer used in Victor's Laboratory,
 * the Main Menu, Match Lobbies, and the 2D Battlefield Arena.
 */

import type { CreatureAppearance, Loadout, PartRarity } from "@/domain/types";

export interface DrawCreatureOptions {
  x: number;
  y: number;
  facing: 1 | -1;
  aimAngleDeg: number;
  appearance: CreatureAppearance;
  teamColor: string;
  scale?: number;
  timeSec?: number;
  isAlive?: boolean;
  isActiveTurn?: boolean;
  displayName?: string;
  hp?: number;
  maxHp?: number;
}

const RARITY_ACCENT: Record<PartRarity, string> = {
  normal: "#94a3b8",
  rare: "#38bdf8",
  unique: "#fbbf24",
};

/**
 * Build a compact serializable CreatureAppearance from a 4-part Loadout.
 */
export function buildAppearanceFromLoadout(loadout: Loadout): CreatureAppearance {
  return {
    headId: loadout.head.id,
    torsoId: loadout.torso.id,
    armsId: loadout.arms.id,
    legsId: loadout.legs.id,
    headRarity: loadout.head.rarity,
    torsoRarity: loadout.torso.rarity,
    armsRarity: loadout.arms.rarity,
    legsRarity: loadout.legs.rarity,
  };
}

/**
 * Draw the selected legs module anchored at ground (0, 0) up to hip y = -16.
 */
function drawLegsModule(
  ctx: CanvasRenderingContext2D,
  legsId: string,
  rarity: PartRarity,
  timeSec: number
) {
  const accent = RARITY_ACCENT[rarity];
  ctx.lineCap = "round";

  if (legsId === "legs_coil_springs") {
    for (const side of [-7, 7]) {
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(side, -16);
      ctx.lineTo(side - 3, -12);
      ctx.lineTo(side + 3, -8);
      ctx.lineTo(side - 3, -4);
      ctx.lineTo(side, -1);
      ctx.stroke();

      ctx.fillStyle = "#1e293b";
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.6;
      ctx.fillRect(side - 5, -3, 10, 3.5);
      ctx.strokeRect(side - 5, -3, 10, 3.5);
    }
    return;
  }

  if (legsId === "legs_hydraulic_walkers") {
    const pistonPulse = Math.sin(timeSec * 3.5) * 0.7;
    for (const side of [-8, 8]) {
      ctx.fillStyle = "#1e293b";
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2;
      ctx.fillRect(side - 4, -16, 8, 12);
      ctx.strokeRect(side - 4, -16, 8, 12);
      // Anchor claw boot.
      ctx.fillStyle = accent;
      ctx.fillRect(side - 6, -4 + pistonPulse * 0.3, 12, 4);
    }
    return;
  }

  // Default / legs_peg_struts & future catalog legs fallback.
  ctx.strokeStyle = accent;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-4, -16);
  ctx.lineTo(-7, -2);
  ctx.moveTo(4, -16);
  ctx.lineTo(7, -2);
  ctx.stroke();

  ctx.fillStyle = "#78350f";
  ctx.strokeStyle = accent;
  ctx.lineWidth = 1.5;
  ctx.fillRect(-10, -3.5, 7, 3.5);
  ctx.fillRect(3, -3.5, 7, 3.5);
}

/**
 * Draw the torso module from hip y = -15 up to shoulder y = -33.
 */
function drawTorsoModule(
  ctx: CanvasRenderingContext2D,
  torsoId: string,
  rarity: PartRarity,
  teamColor: string,
  timeSec: number
) {
  const accent = RARITY_ACCENT[rarity];

  if (torsoId === "torso_boiler_plate") {
    ctx.fillStyle = "#334155";
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.roundRect(-11, -34, 22, 19, 4);
    ctx.fill();
    ctx.stroke();

    // Exhaust chimney & boiler gauge.
    ctx.fillStyle = "#475569";
    ctx.fillRect(-10, -39, 4, 6);
    ctx.beginPath();
    ctx.arc(0, -24, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = "#f97316";
    ctx.fill();
    ctx.strokeStyle = "#fde68a";
    ctx.lineWidth = 1.3;
    ctx.stroke();
    return;
  }

  if (torsoId === "torso_reactor_core") {
    const glow = 0.65 + Math.sin(timeSec * 5) * 0.25;
    ctx.fillStyle = "#1e293b";
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(-12, -33);
    ctx.lineTo(12, -33);
    ctx.lineTo(9, -15);
    ctx.lineTo(-9, -15);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, -24, 5.2, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(251, 191, 36, ${glow.toFixed(2)})`;
    ctx.fill();
    ctx.strokeStyle = "#fef08a";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    return;
  }

  // Default / torso_canvas_ribcage & future catalog torsos fallback.
  ctx.fillStyle = "#1e293b";
  ctx.strokeStyle = rarity === "normal" ? teamColor : accent;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(-9, -33, 18, 18, 4);
  ctx.fill();
  ctx.stroke();

  // Stitched rib lines.
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 1.4;
  for (const ry of [-28, -24, -20]) {
    ctx.beginPath();
    ctx.moveTo(-5, ry);
    ctx.lineTo(5, ry);
    ctx.stroke();
  }
}

/**
 * Draw the head module centered above neck y = -35.
 */
function drawHeadModule(
  ctx: CanvasRenderingContext2D,
  headId: string,
  rarity: PartRarity,
  timeSec: number
) {
  const accent = RARITY_ACCENT[rarity];

  if (headId === "head_brass_visor") {
    ctx.fillStyle = "#1e293b";
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.roundRect(-9, -50, 18, 15, 5);
    ctx.fill();
    ctx.stroke();

    // Telescopic brass visor band facing right (+1).
    ctx.fillStyle = "#38bdf8";
    ctx.fillRect(-1, -46, 11, 5);
    ctx.strokeStyle = "#bae6fd";
    ctx.lineWidth = 1.2;
    ctx.strokeRect(-1, -46, 11, 5);
    return;
  }

  if (headId === "head_voltaic_crown") {
    ctx.fillStyle = "#0f172a";
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.roundRect(-9, -49, 18, 14, 4);
    ctx.fill();
    ctx.stroke();

    // Twin voltaic spires & pulsing arc.
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-5, -49);
    ctx.lineTo(-6, -57);
    ctx.moveTo(5, -49);
    ctx.lineTo(6, -57);
    ctx.stroke();

    const pulse = 0.65 + Math.sin(timeSec * 8) * 0.35;
    ctx.fillStyle = `rgba(251, 191, 36, ${pulse.toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(-6, -58, 2.5, 0, Math.PI * 2);
    ctx.arc(6, -58, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Glowing eyes.
    ctx.fillStyle = "#fbbf24";
    ctx.fillRect(1, -44, 5, 3);
    return;
  }

  // Default / head_stitch_skull & future catalog heads fallback.
  ctx.fillStyle = "#0f172a";
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.roundRect(-8.5, -49, 17, 14, 4);
  ctx.fill();
  ctx.stroke();

  // Frankenstein neck bolts + eyes + stitch scar.
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-11.5, -41);
  ctx.lineTo(-8.5, -41);
  ctx.moveTo(8.5, -41);
  ctx.lineTo(11.5, -41);
  ctx.stroke();

  ctx.fillStyle = "#34d399";
  ctx.fillRect(1, -44, 3, 3);
  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-4, -46);
  ctx.lineTo(2, -46);
  ctx.stroke();
}

/**
 * Draw the rear and front aiming arm modules (shoulder anchored at (0, -29)).
 */
function drawArmModules(
  ctx: CanvasRenderingContext2D,
  armsId: string,
  rarity: PartRarity,
  aimAngleDeg: number,
  timeSec: number
) {
  const accent = RARITY_ACCENT[rarity];
  const rad = (-aimAngleDeg * Math.PI) / 180;

  // Rear stabilizing arm.
  ctx.strokeStyle = "#64748b";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-6, -29);
  ctx.lineTo(-14, -21);
  ctx.stroke();

  // Front articulated aiming arm rotated toward aimAngleDeg.
  ctx.save();
  ctx.translate(4, -29);
  ctx.rotate(rad);

  if (armsId === "arms_pneumatic_piston") {
    ctx.fillStyle = "#334155";
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.fillRect(0, -3.5, 13, 7);
    ctx.strokeRect(0, -3.5, 13, 7);
    ctx.fillStyle = "#bae6fd";
    ctx.fillRect(13, -2, 6, 4);
    // Grenade held in piston clamp.
    ctx.beginPath();
    ctx.arc(21, 0, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#f97316";
    ctx.fill();
  } else if (armsId === "arms_tesla_catapult") {
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(0, -3.5);
    ctx.lineTo(18, -3.5);
    ctx.moveTo(0, 3.5);
    ctx.lineTo(18, 3.5);
    ctx.stroke();
    // Charged plasma coil ring & grenade.
    const spark = 0.6 + Math.sin(timeSec * 9) * 0.35;
    ctx.strokeStyle = `rgba(251, 191, 36, ${spark.toFixed(2)})`;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(19, 0, 5.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(19, 0, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = "#fbbf24";
    ctx.fill();
  } else {
    // Default / arms_copper_hook & future catalog arms fallback.
    ctx.strokeStyle = "#d97706";
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(14, 0);
    ctx.stroke();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(17, 0, 4, -Math.PI * 0.6, Math.PI * 0.6);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(18, 0, 3.3, 0, Math.PI * 2);
    ctx.fillStyle = "#f97316";
    ctx.fill();
  }

  ctx.restore();
}

/**
 * Render an assembled 4-part Frankenstein creature at world/canvas coordinates
 * (x, y) where y is ground contact at the feet.
 */
export function drawAssembledCreature(
  ctx: CanvasRenderingContext2D,
  options: DrawCreatureOptions
) {
  const {
    x,
    y,
    facing,
    aimAngleDeg,
    appearance,
    teamColor,
    scale = 1,
    timeSec = 0,
    isAlive = true,
    isActiveTurn = false,
    displayName,
    hp,
    maxHp,
  } = options;

  if (!isAlive) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.fillStyle = "#475569";
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.roundRect(-12, -22, 24, 22, [8, 8, 2, 2]);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 10px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("KO", 0, -7);
    ctx.restore();
    return;
  }

  const breatheY = Math.sin(timeSec * 3.2) * 0.9;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  // Soft ground shadow beneath feet.
  ctx.fillStyle = "rgba(2, 6, 23, 0.45)";
  ctx.beginPath();
  ctx.ellipse(0, 0, 14, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Active turn indicator arrow above head.
  if (isActiveTurn) {
    const bob = Math.sin(timeSec * 5) * 3;
    ctx.fillStyle = "#fbbf24";
    ctx.beginPath();
    ctx.moveTo(0, -64 + bob);
    ctx.lineTo(-6, -73 + bob);
    ctx.lineTo(6, -73 + bob);
    ctx.closePath();
    ctx.fill();
  }

  // Flip horizontally to match facing (+1 right, -1 left).
  ctx.save();
  ctx.scale(facing, 1);

  drawLegsModule(ctx, appearance.legsId, appearance.legsRarity, timeSec);

  ctx.save();
  ctx.translate(0, breatheY);
  drawTorsoModule(
    ctx,
    appearance.torsoId,
    appearance.torsoRarity,
    teamColor,
    timeSec
  );
  drawHeadModule(ctx, appearance.headId, appearance.headRarity, timeSec);
  drawArmModules(
    ctx,
    appearance.armsId,
    appearance.armsRarity,
    aimAngleDeg,
    timeSec
  );
  ctx.restore();

  ctx.restore();

  // Floating HUD bar & player name when HP is supplied.
  if (displayName !== undefined && hp !== undefined && maxHp !== undefined) {
    const barWidth = 52;
    const hpRatio = Math.max(0, Math.min(1, hp / maxHp));
    ctx.fillStyle = "rgba(15, 23, 42, 0.88)";
    ctx.fillRect(-barWidth / 2, -62, barWidth, 6);
    ctx.fillStyle = hpRatio > 0.35 ? teamColor : "#f43f5e";
    ctx.fillRect(-barWidth / 2, -62, barWidth * hpRatio, 6);

    ctx.fillStyle = "#f8fafc";
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${displayName} (${hp})`, 0, -66);
  }

  ctx.restore();
}
