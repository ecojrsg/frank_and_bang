// @Author: Jonathan Serna
// @Date:   2026-11-23 22:00:00
// @Last Modified by:   Jonathan Serna
// @Last Modified time: 2026-11-23 22:00:00

/**
 * Envelope-driven visual effects (explosion fireballs, shockwave rings,
 * rising smoke, gravity embers, projectile trails, and floating damage text).
 */

import type { ExplosionEvent } from "@/domain/types";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  age: number;
  life: number;
  color: string;
  gravity: number;
}

interface Shockwave {
  x: number;
  y: number;
  maxRadius: number;
  age: number;
  life: number;
}

interface DamagePopup {
  x: number;
  y: number;
  text: string;
  age: number;
  life: number;
  directHit: boolean;
}

export interface VfxState {
  particles: Particle[];
  shockwaves: Shockwave[];
  popups: DamagePopup[];
  lastExplosionId: number;
}

/** Smooth burst envelope: fast attack and cubic decay back to 0. */
function burstEnvelope(t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  if (clamped < 0.15) {
    return clamped / 0.15;
  }
  const decay = 1 - (clamped - 0.15) / 0.85;
  return decay * decay;
}

/**
 * Create an empty VFX particle container.
 */
export function createVfxState(): VfxState {
  return {
    particles: [],
    shockwaves: [],
    popups: [],
    lastExplosionId: 0,
  };
}

/**
 * Emit a subtle fuse spark & smoke puff behind an airborne grenade.
 */
export function spawnProjectileTrail(vfx: VfxState, x: number, y: number) {
  vfx.particles.push({
    x: x + (Math.random() - 0.5) * 4,
    y: y + (Math.random() - 0.5) * 4,
    vx: (Math.random() - 0.5) * 28,
    vy: -18 - Math.random() * 24,
    radius: 2.5 + Math.random() * 2.5,
    age: 0,
    life: 0.35 + Math.random() * 0.2,
    color: Math.random() > 0.45 ? "#94a3b8" : "#fbbf24",
    gravity: -15,
  });
}

/**
 * Spawn multi-layered explosion fire, smoke, debris sparks, shockwave, and
 * floating damage popups for a resolved ExplosionEvent.
 */
export function spawnExplosionVfx(vfx: VfxState, explosion: ExplosionEvent) {
  vfx.lastExplosionId = explosion.explosionId;

  vfx.shockwaves.push({
    x: explosion.x,
    y: explosion.y,
    maxRadius: explosion.radius * 1.45,
    age: 0,
    life: 0.48,
  });

  // Inner fireball & rising smoke plumes.
  for (let i = 0; i < 18; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 25 + Math.random() * 95;
    const isSmoke = i >= 10;
    vfx.particles.push({
      x: explosion.x + (Math.random() - 0.5) * 14,
      y: explosion.y + (Math.random() - 0.5) * 14,
      vx: Math.cos(angle) * speed * (isSmoke ? 0.45 : 1),
      vy: Math.sin(angle) * speed * (isSmoke ? 0.35 : 0.9) - (isSmoke ? 40 : 15),
      radius: isSmoke ? 12 + Math.random() * 12 : 8 + Math.random() * 10,
      age: 0,
      life: isSmoke ? 0.85 + Math.random() * 0.4 : 0.38 + Math.random() * 0.2,
      color: isSmoke ? "#475569" : i % 2 === 0 ? "#fef08a" : "#f97316",
      gravity: isSmoke ? -28 : 40,
    });
  }

  // Hot sparks & flying dirt chunks under gravity.
  for (let i = 0; i < 20; i++) {
    const angle = -Math.PI * (0.1 + Math.random() * 0.8);
    const speed = 110 + Math.random() * 210;
    vfx.particles.push({
      x: explosion.x,
      y: explosion.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: 2 + Math.random() * 2.5,
      age: 0,
      life: 0.55 + Math.random() * 0.45,
      color: i % 3 === 0 ? "#fb923c" : "#fde047",
      gravity: 440,
    });
  }

  explosion.damages.forEach((dmg, idx) => {
    vfx.popups.push({
      x: explosion.x,
      y: explosion.y - 26 - idx * 20,
      text: `-${dmg.damage} HP${dmg.directHit ? "!" : ""}`,
      age: 0,
      life: 1.25,
      directHit: dmg.directHit,
    });
  });
}

/**
 * Advance all active VFX lifetimes and positions by dtSeconds.
 */
export function stepVfx(vfx: VfxState, dtSeconds: number) {
  const safeDt = Math.max(0, Math.min(0.08, dtSeconds));

  for (let i = vfx.particles.length - 1; i >= 0; i--) {
    const p = vfx.particles[i];
    p.age += safeDt;
    if (p.age >= p.life) {
      vfx.particles.splice(i, 1);
      continue;
    }
    p.vy += p.gravity * safeDt;
    p.x += p.vx * safeDt;
    p.y += p.vy * safeDt;
  }

  for (let i = vfx.shockwaves.length - 1; i >= 0; i--) {
    const sw = vfx.shockwaves[i];
    sw.age += safeDt;
    if (sw.age >= sw.life) {
      vfx.shockwaves.splice(i, 1);
    }
  }

  for (let i = vfx.popups.length - 1; i >= 0; i--) {
    const pop = vfx.popups[i];
    pop.age += safeDt;
    pop.y -= 26 * safeDt;
    if (pop.age >= pop.life) {
      vfx.popups.splice(i, 1);
    }
  }
}

/**
 * Render active shockwaves, particles, and floating damage popups in world space.
 */
export function drawVfx(ctx: CanvasRenderingContext2D, vfx: VfxState) {
  for (const sw of vfx.shockwaves) {
    const progress = sw.age / sw.life;
    const radius = 12 + (sw.maxRadius - 12) * Math.sqrt(progress);
    const alpha = Math.max(0, 1 - progress);
    ctx.save();
    ctx.beginPath();
    ctx.arc(sw.x, sw.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(251, 191, 36, ${(alpha * 0.22).toFixed(2)})`;
    ctx.fill();
    ctx.strokeStyle = `rgba(249, 115, 22, ${(alpha * 0.85).toFixed(2)})`;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
  }

  for (const p of vfx.particles) {
    const env = burstEnvelope(p.age / p.life);
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, env));
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius * (0.65 + env * 0.55), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  for (const pop of vfx.popups) {
    const alpha = Math.max(0, 1 - pop.age / pop.life);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = pop.directHit ? "900 16px sans-serif" : "bold 14px sans-serif";
    ctx.textAlign = "center";
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#090d16";
    ctx.strokeText(pop.text, pop.x, pop.y);
    ctx.fillStyle = pop.directHit ? "#fde047" : "#fb923c";
    ctx.fillText(pop.text, pop.x, pop.y);
    ctx.restore();
  }
}
