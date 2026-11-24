// @Author: Jonathan Serna
// @Date:   2026-11-23 22:00:00
// @Last Modified by:   Jonathan Serna
// @Last Modified time: 2026-11-23 22:00:00

/**
 * Procedural Web Audio API synthesizer for Frank and Bang combat, Gacha TCG,
 * and Laboratory feedback with zero external audio files.
 */

import type { PartRarity } from "@/domain/types";

const MUTE_STORAGE_KEY = "frank_bang_muted";

class FrankSoundEngine {
  private ctx: AudioContext | null = null;
  private muted: boolean = false;
  private initializedMute = false;

  private loadMuteState(): boolean {
    if (this.initializedMute || typeof window === "undefined") {
      return this.muted;
    }
    this.initializedMute = true;
    try {
      this.muted = window.localStorage.getItem(MUTE_STORAGE_KEY) === "true";
    } catch {
      this.muted = false;
    }
    return this.muted;
  }

  private getContext(): AudioContext | null {
    if (typeof window === "undefined" || this.loadMuteState()) {
      return null;
    }
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) {
        return null;
      }
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {
        // Ignore autoplay restrictions before user gesture.
      });
    }
    return this.ctx;
  }

  /**
   * Return whether audio output is currently muted.
   */
  public isMuted(): boolean {
    return this.loadMuteState();
  }

  /**
   * Toggle mute state and persist preference in localStorage.
   */
  public toggleMute(): boolean {
    const next = !this.loadMuteState();
    this.muted = next;
    this.initializedMute = true;
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(MUTE_STORAGE_KEY, String(next));
      } catch {
        // Ignore storage quota errors.
      }
    }
    return next;
  }

  private playTone(
    freqStart: number,
    freqEnd: number,
    durationSec: number,
    type: OscillatorType,
    volume: number,
    delaySec: number = 0
  ) {
    const ctx = this.getContext();
    if (!ctx) {
      return;
    }
    const startAt = ctx.currentTime + delaySec;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(40, freqStart), startAt);
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(40, freqEnd),
      startAt + durationSec
    );

    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.linearRampToValueAtTime(volume, startAt + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + durationSec);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startAt);
    osc.stop(startAt + durationSec + 0.02);
  }

  private playNoiseBurst(durationSec: number, filterHz: number, volume: number) {
    const ctx = this.getContext();
    if (!ctx) {
      return;
    }
    const sampleCount = Math.max(1, Math.floor(ctx.sampleRate * durationSec));
    const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < sampleCount; i++) {
      channel[i] = (Math.random() * 2 - 1) * (1 - i / sampleCount);
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(filterHz, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + durationSec);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationSec);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start();
  }

  /** Play subtle footstep click when moving across terrain. */
  public playStep() {
    this.playTone(130, 75, 0.06, "triangle", 0.08);
  }

  /** Play springy rising sweep when jumping across terrain. */
  public playJump() {
    this.playTone(180, 440, 0.14, "triangle", 0.1);
  }

  /** Play crisp mechanical ratchet click when adjusting aim angle. */
  public playAimTick() {
    this.playTone(520, 620, 0.035, "sine", 0.05);
  }

  /** Play rising pitch tick while charging grenade throw power. */
  public playChargeTick(powerRatio: number) {
    const freq = 240 + Math.max(0, Math.min(1, powerRatio)) * 420;
    this.playTone(freq, freq * 1.08, 0.045, "triangle", 0.05);
  }

  /** Play compressed spring/whoosh launch sound on grenade throw. */
  public playGrenadeLaunch() {
    this.playTone(380, 140, 0.18, "sawtooth", 0.12);
    this.playTone(540, 260, 0.12, "sine", 0.08, 0.02);
  }

  /** Play multi-layered grenade explosion blast. */
  public playExplosion(isDirectHit: boolean) {
    this.playNoiseBurst(0.52, isDirectHit ? 1400 : 950, 0.28);
    this.playTone(125, 38, 0.42, "sawtooth", 0.2);
    if (isDirectHit) {
      this.playTone(680, 320, 0.16, "square", 0.08, 0.05);
    }
  }

  /** Play a chime signaling whose turn started. */
  public playTurnAlert(isMyTurn: boolean) {
    if (isMyTurn) {
      this.playTone(440, 440, 0.11, "triangle", 0.1);
      this.playTone(660, 660, 0.16, "triangle", 0.11, 0.09);
    } else {
      this.playTone(360, 280, 0.14, "sine", 0.07);
    }
  }

  /** Play victory fanfare. */
  public playVictory() {
    this.playTone(523, 523, 0.14, "triangle", 0.12, 0);
    this.playTone(659, 659, 0.14, "triangle", 0.12, 0.12);
    this.playTone(784, 784, 0.18, "triangle", 0.13, 0.24);
    this.playTone(1046, 1046, 0.34, "triangle", 0.14, 0.38);
  }

  /** Play defeat descending chord. */
  public playDefeat() {
    this.playTone(330, 294, 0.18, "sawtooth", 0.09, 0);
    this.playTone(262, 196, 0.35, "sawtooth", 0.1, 0.18);
  }

  /** Play booster pack tear & shimmer sound in Gacha. */
  public playPackOpen() {
    this.playNoiseBurst(0.18, 2400, 0.14);
    this.playTone(320, 640, 0.22, "sine", 0.1, 0.06);
  }

  /** Play TCG card reveal chime scaled to card rarity. */
  public playCardFlip(rarity: PartRarity) {
    if (rarity === "unique") {
      this.playTone(587, 587, 0.12, "triangle", 0.12, 0);
      this.playTone(880, 880, 0.14, "triangle", 0.12, 0.09);
      this.playTone(1174, 1174, 0.28, "sine", 0.13, 0.18);
      return;
    }
    if (rarity === "rare") {
      this.playTone(523, 523, 0.1, "triangle", 0.1, 0);
      this.playTone(784, 784, 0.18, "sine", 0.11, 0.08);
      return;
    }
    this.playTone(420, 520, 0.1, "sine", 0.08);
  }

  /** Play metallic socket click when equipping a part in Victor's Lab. */
  public playPartEquip() {
    this.playTone(260, 420, 0.07, "square", 0.06);
    this.playTone(520, 640, 0.08, "triangle", 0.08, 0.05);
  }
}

export const soundEngine = new FrankSoundEngine();
