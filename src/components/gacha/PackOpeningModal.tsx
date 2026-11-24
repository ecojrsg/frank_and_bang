"use client";

// @Author: Jonathan Serna
// @Date:   2026-11-23 23:34:00
// @Last Modified by:   Jonathan Serna
// @Last Modified time: 2026-11-23 23:34:00

/**
 * Full-screen TCG booster pack opening modal combining an anatomy isometric
 * tear animation and a swipeable motion/react card-by-card reveal stack.
 */

import {
  AnimatePresence,
  motion,
  useMotionValue,
  useTransform,
  type PanInfo,
} from "motion/react";
import { useCallback, useEffect, useState } from "react";

import { TcgPartCard } from "@/components/parts/TcgPartCard";
import { PACK_COST_COINS } from "@/domain/gachaEngine";
import type { GachaPullResult } from "@/domain/types";
import { soundEngine } from "@/engine/soundEngine";

import { AnatomyBoosterPackSvg } from "./AnatomyBoosterPackSvg";

type ModalStage = "sealed" | "stack" | "summary";

interface PackOpeningModalProps {
  isOpen: boolean;
  pulls: GachaPullResult[];
  totalDuplicateCoins: number;
  cardBackUrl: string | null;
  freePacksRemaining: number;
  coinsRemaining: number;
  openingAnother: boolean;
  onOpenAnother: () => void;
  onClose: () => void;
}

interface SwipeableCardSlotProps {
  pull: GachaPullResult;
  cardBackUrl: string | null;
  revealed: boolean;
  onReveal: () => void;
  onDismiss: (direction: -1 | 1) => void;
}

/**
 * Single draggable/swipeable top card in the reveal stack using motion physics.
 */
function SwipeableCardSlot({
  pull,
  cardBackUrl,
  revealed,
  onReveal,
  onDismiss,
}: SwipeableCardSlotProps) {
  const dragX = useMotionValue(0);
  const rotateDeg = useTransform(dragX, [-220, 0, 220], [-14, 0, 14]);
  const cardOpacity = useTransform(dragX, [-280, -140, 0, 140, 280], [0.35, 0.9, 1, 0.9, 0.35]);

  function handleDragEnd(
    _: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo
  ) {
    if (!revealed) {
      return;
    }
    if (Math.abs(info.offset.x) > 95 || Math.abs(info.velocity.x) > 450) {
      onDismiss(info.offset.x >= 0 ? 1 : -1);
    }
  }

  return (
    <motion.div
      style={{ x: dragX, rotate: rotateDeg, opacity: cardOpacity }}
      drag={revealed ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.7}
      onDragEnd={handleDragEnd}
      initial={{ scale: 0.9, y: 24, opacity: 0 }}
      animate={{ scale: 1, y: 0, opacity: 1 }}
      exit={{ x: 340, opacity: 0, rotate: 12, transition: { duration: 0.24 } }}
      transition={{ type: "spring", stiffness: 280, damping: 24 }}
      className={`relative z-20 w-full max-w-[300px] ${
        revealed ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
      }`}
    >
      {/* Subtle aura behind rare / unique revealed card */}
      {revealed && pull.part.rarity !== "normal" && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-3 -z-10 blur-xl"
          style={{
            background:
              pull.part.rarity === "unique"
                ? "radial-gradient(circle, rgba(82,255,46,0.28) 0%, transparent 70%)"
                : "radial-gradient(circle, rgba(212,126,63,0.28) 0%, transparent 70%)",
          }}
        />
      )}

      <TcgPartCard
        part={pull.part}
        cardBackUrl={cardBackUrl}
        revealed={revealed}
        onFlip={onReveal}
        isNew={pull.isNew}
        duplicateCoins={pull.duplicateCoins}
      />
    </motion.div>
  );
}

/**
 * Render an immersive popout modal for ripping sealed booster packs and sliding cards.
 */
export function PackOpeningModal({
  isOpen,
  pulls,
  totalDuplicateCoins,
  cardBackUrl,
  freePacksRemaining,
  coinsRemaining,
  openingAnother,
  onOpenAnother,
  onClose,
}: PackOpeningModalProps) {
  const [stage, setStage] = useState<ModalStage>("sealed");
  const [tearing, setTearing] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [revealedCards, setRevealedCards] = useState<boolean[]>([]);

  // Reset modal choreography whenever a fresh pull batch arrives.
  useEffect(() => {
    if (isOpen && pulls.length > 0) {
      setStage("sealed");
      setTearing(false);
      setActiveIndex(0);
      setRevealedCards(pulls.map(() => false));
    }
  }, [isOpen, pulls]);

  const handleTearPack = useCallback(() => {
    if (tearing || stage !== "sealed") {
      return;
    }
    setTearing(true);
    soundEngine.playPackOpen();
    window.setTimeout(() => {
      setStage("stack");
    }, 540);
  }, [tearing, stage]);

  const handleRevealCurrent = useCallback(() => {
    const target = pulls[activeIndex];
    if (!target) {
      return;
    }
    setRevealedCards((prev) => {
      if (prev[activeIndex]) {
        return prev;
      }
      soundEngine.playCardFlip(target.part.rarity);
      return prev.map((flag, idx) => (idx === activeIndex ? true : flag));
    });
  }, [pulls, activeIndex]);

  const handleAdvanceCard = useCallback(() => {
    if (stage !== "stack") {
      return;
    }
    if (!revealedCards[activeIndex]) {
      handleRevealCurrent();
      return;
    }
    if (activeIndex + 1 < pulls.length) {
      setActiveIndex((prev) => prev + 1);
    } else {
      setStage("summary");
    }
  }, [stage, revealedCards, activeIndex, pulls.length, handleRevealCurrent]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      } else if (stage === "sealed" && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        handleTearPack();
      } else if (stage === "stack") {
        if (event.key === " " || event.key === "Enter") {
          event.preventDefault();
          handleRevealCurrent();
        } else if (event.key === "ArrowRight") {
          event.preventDefault();
          handleAdvanceCard();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, stage, onClose, handleTearPack, handleRevealCurrent, handleAdvanceCard]);

  if (!isOpen || pulls.length === 0) {
    return null;
  }

  const currentPull = pulls[activeIndex];
  const isCurrentRevealed = revealedCards[activeIndex] ?? false;
  const remainingCount = pulls.length - activeIndex;
  const canOpenMore = freePacksRemaining > 0 || coinsRemaining >= PACK_COST_COINS;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Apertura de sobre coleccionable"
      className="blueprint-dots fixed inset-0 z-50 flex flex-col justify-between overflow-y-auto bg-[#121216]/95 p-4 sm:p-8"
    >
      {/* Top Blueprint Header Strip */}
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between border-b border-[#D47E3F]/30 pb-3">
        <div className="font-mono text-xs tracking-[0.12em] text-[#ECEAE4]">
          <span className="font-bold text-[#52FF2E]">PACK_OPEN</span>{" "}
          <span className="text-[#8E8D86]">
            ·{" "}
            {stage === "sealed"
              ? "SELLO HERMETICO ACTIVO"
              : stage === "stack"
                ? `ESPECIMEN ${activeIndex + 1} / ${pulls.length}`
                : `RESUMEN · ${pulls.length} CARTAS`}
          </span>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="border border-[#3A3D4A] bg-[#1B1C22] px-3 py-1 font-mono text-xs font-bold text-[#ECEAE4] transition hover:border-[#D47E3F] hover:text-[#EB9C5C]"
        >
          Cerrar [ESC]
        </button>
      </div>

      {/* Stage Body */}
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center py-6">
        {stage === "sealed" && (
          <div className="flex flex-col items-center text-center">
            <AnatomyBoosterPackSvg tearing={tearing} onTear={handleTearPack} />
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-[#ECEAE4] sm:text-3xl">
              {tearing ? "Despresurizando cápsula..." : "Sobre de Especímenes Sellado"}
            </h2>
            <p className="mt-2 font-mono text-xs text-[#B0AEA6]">
              Haz clic sobre el sobre o deslízalo horizontalmente para rasgar el
              sello radioactivo.
            </p>
            <button
              type="button"
              disabled={tearing}
              onClick={handleTearPack}
              className="mt-6 bg-[#52FF2E] px-6 py-3 font-mono text-xs font-bold tracking-widest text-[#121216] uppercase transition hover:bg-[#32C81E] disabled:opacity-50"
            >
              {tearing ? "Abriendo..." : "Rasgar Sello del Sobre"}
            </button>
          </div>
        )}

        {stage === "stack" && currentPull && (
          <div className="flex w-full flex-col items-center">
            {/* Stacked Deck Viewport */}
            <div className="relative flex min-h-[385px] w-full max-w-[340px] items-center justify-center">
              {/* Background stacked cards peeking behind */}
              {remainingCount > 2 && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute top-4 h-[350px] w-[280px] border border-[#3A3D4A] bg-[#181920] opacity-55"
                  style={{ transform: "translateY(14px) scale(0.92)" }}
                />
              )}
              {remainingCount > 1 && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute top-2 h-[350px] w-[290px] border border-[#D47E3F]/50 bg-[#1B1C22] opacity-80"
                  style={{ transform: "translateY(7px) scale(0.96)" }}
                />
              )}

              <AnimatePresence mode="popLayout">
                <SwipeableCardSlot
                  key={`${currentPull.part.id}-${activeIndex}`}
                  pull={currentPull}
                  cardBackUrl={cardBackUrl}
                  revealed={isCurrentRevealed}
                  onReveal={handleRevealCurrent}
                  onDismiss={handleAdvanceCard}
                />
              </AnimatePresence>
            </div>

            {/* Interactive Controls Below Deck */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              {!isCurrentRevealed ? (
                <button
                  type="button"
                  onClick={handleRevealCurrent}
                  className="bg-[#52FF2E] px-6 py-2.5 font-mono text-xs font-bold tracking-widest text-[#121216] uppercase transition hover:bg-[#32C81E]"
                >
                  Revelar Carta ({activeIndex + 1}/{pulls.length})
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleAdvanceCard}
                  className="bg-[#D47E3F] px-6 py-2.5 font-mono text-xs font-bold tracking-widest text-[#121216] uppercase transition hover:bg-[#EB9C5C]"
                >
                  {activeIndex + 1 < pulls.length
                    ? "Siguiente Carta →"
                    : "Ver Resumen Completo →"}
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setRevealedCards(pulls.map(() => true));
                  setStage("summary");
                }}
                className="border border-[#3A3D4A] bg-[#1B1C22] px-4 py-2.5 font-mono text-xs font-bold text-[#B0AEA6] transition hover:border-[#ECEAE4] hover:text-[#ECEAE4]"
              >
                Ver Todas ({pulls.length})
              </button>
            </div>

            <p className="mt-3 font-mono text-[11px] text-[#8E8D86]">
              {isCurrentRevealed
                ? "Desliza la tarjeta a izquierda o derecha, o pulsa Siguiente Carta."
                : "Toca la carta o pulsa ESPACIO para revelar el espécimen."}
            </p>
          </div>
        )}

        {stage === "summary" && (
          <div className="w-full space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#D47E3F]/25 pb-3">
              <h2 className="text-2xl font-bold text-[#ECEAE4]">
                Resumen del Sobre Abierto
              </h2>
              {totalDuplicateCoins > 0 && (
                <span className="border border-[#D47E3F]/60 bg-[#D47E3F]/15 px-3 py-1 font-mono text-xs font-bold text-[#EB9C5C] tabular-nums">
                  +{totalDuplicateCoins} FC POR REPETIDAS
                </span>
              )}
            </div>

            <div className="grid gap-5 sm:grid-cols-3">
              {pulls.map((pull, idx) => (
                <motion.div
                  key={`${pull.part.id}-${idx}`}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.08, duration: 0.35 }}
                >
                  <TcgPartCard
                    part={pull.part}
                    cardBackUrl={cardBackUrl}
                    revealed={true}
                    isNew={pull.isNew}
                    duplicateCoins={pull.duplicateCoins}
                  />
                </motion.div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              {canOpenMore && (
                <button
                  type="button"
                  disabled={openingAnother}
                  onClick={onOpenAnother}
                  className="bg-[#52FF2E] px-6 py-3 font-mono text-xs font-bold tracking-widest text-[#121216] uppercase transition hover:bg-[#32C81E] disabled:opacity-50"
                >
                  {openingAnother
                    ? "Cargando siguiente sobre..."
                    : freePacksRemaining > 0
                      ? `Abrir Otro Sobre Gratis (${freePacksRemaining})`
                      : `Comprar Otro Sobre (${PACK_COST_COINS} FC)`}
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="border border-[#D47E3F]/60 bg-[#1B1C22] px-6 py-3 font-mono text-xs font-bold tracking-widest text-[#ECEAE4] uppercase transition hover:border-[#EB9C5C] hover:text-[#EB9C5C]"
              >
                Volver a Colección
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Telemetry Status */}
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between border-t border-[#D47E3F]/20 pt-3 font-mono text-[11px] text-[#8E8D86] tabular-nums">
        <span>SOBRES DISPONIBLES: {freePacksRemaining}</span>
        <span>SALDO: {coinsRemaining} FC</span>
      </div>
    </div>
  );
}
