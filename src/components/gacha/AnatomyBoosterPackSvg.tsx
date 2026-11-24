"use client";

// @Author: Jonathan Serna
// @Date:   2026-11-23 23:34:00
// @Last Modified by:   Jonathan Serna
// @Last Modified time: 2026-11-23 23:34:00

/**
 * Solid isometric TCG bio-containment booster pack generated with the anatomy
 * projection engine and animated with motion/react for pack tearing.
 */

import { motion } from "motion/react";
import { useMemo } from "react";

import {
  cylinderOf,
  iso,
  lineOnTop,
  planCorners,
  slabOf,
  topMatrix,
  topTicksOf,
  type IsoProjection,
} from "@/components/iso/isoGeometry";

interface AnatomyBoosterPackSvgProps {
  tearing: boolean;
  onTear: () => void;
  disabled?: boolean;
  compact?: boolean;
}

const PACK_PROJECTION: IsoProjection = {
  origin: [170, 158],
  scale: 1.55,
  azimuth: 45,
  elevation: 30,
};

const SHADES = ["#181920", "#1E2028", "#252731", "#2E313D"] as const;

/**
 * Render an isometric metallic-copper and radioactive bio-green TCG booster pack.
 */
export function AnatomyBoosterPackSvg({
  tearing,
  onTear,
  disabled = false,
  compact = false,
}: AnatomyBoosterPackSvgProps) {
  const geo = useMemo(() => {
    const p = PACK_PROJECTION;
    const pouchPlan = { x: -46, y: -62, w: 92, d: 112, r: 5 };
    const lidPlan = { x: -46, y: -62, w: 92, d: 24, r: 4 };
    const coreBandPlan = { x: -34, y: -26, w: 68, d: 52, r: 3 };

    const lowerBody = slabOf(pouchPlan, 0, 11, p, 5, 1.1);
    const coreInset = slabOf(coreBandPlan, 11, 4, p, 4, 0.7);
    const greenSeal = slabOf({ x: -45, y: -38, w: 90, d: 6, r: 1 }, 11, 3, p, 3);
    const upperCap = slabOf(lidPlan, 2, 12, p, 4, 0.9);
    const rivets = planCorners(pouchPlan, 7).map(([rx, ry]) =>
      cylinderOf(rx, ry, 2.6, 11, 1.8, p, 12)
    );
    const seamTicks = topTicksOf(-42, 42, 6, 2, -37, 13.5, [2, 3.5], p, "x");
    const faceMatrix = topMatrix([-28, 8], 15.2, p, "x");
    const subMatrix = topMatrix([-28, 22], 15.2, p, "x");
    const glowCenter = iso([0, -10, 15], p);
    return {
      lowerBody,
      coreInset,
      greenSeal,
      upperCap,
      rivets,
      seamTicks,
      faceMatrix,
      subMatrix,
      glowCenter,
      tearLine: lineOnTop([-46, -38], [46, -38], 13.5, p),
    };
  }, []);

  return (
    <motion.div
      drag={!tearing && !disabled ? "x" : false}
      dragConstraints={{ left: -40, right: 40 }}
      dragElastic={0.2}
      onDragEnd={(_, info) => {
        if (!tearing && !disabled && Math.abs(info.offset.x) > 32) {
          onTear();
        }
      }}
      whileHover={disabled || tearing ? undefined : { scale: 1.03, y: -3 }}
      whileTap={disabled || tearing ? undefined : { scale: 0.98 }}
      onClick={() => {
        if (!disabled && !tearing) {
          onTear();
        }
      }}
      role="button"
      tabIndex={disabled ? -1 : 0}
      onKeyDown={(e) => {
        if (!disabled && !tearing && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onTear();
        }
      }}
      aria-label="Rasgar sobre coleccionable Frank and Bang"
      className={`relative flex select-none items-center justify-center ${
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
      } ${compact ? "h-44 w-56" : "h-72 w-full max-w-[360px]"}`}
    >
      <svg
        viewBox="0 0 340 280"
        className="h-full w-full overflow-visible"
        role="img"
        aria-label="Sobre isométrico bio-industrial"
      >
        {/* Subtle radioactive glow behind torn seam */}
        {tearing && (
          <motion.circle
            cx={geo.glowCenter[0]}
            cy={geo.glowCenter[1]}
            r={62}
            fill="#52FF2E"
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: [0.1, 0.55, 0], scale: [0.5, 1.4, 1.8] }}
            transition={{ duration: 0.55, ease: "easeOut" }}
          />
        )}

        {/* Lower metallic pouch body */}
        <g>
          <path d={geo.lowerBody.fill} fill="#15151A" />
          {geo.lowerBody.shades.map((d, idx) =>
            d ? <path key={idx} d={d} fill={SHADES[idx]} /> : null
          )}
          <path d={geo.lowerBody.top} fill="#252731" />
          {geo.lowerBody.crease && (
            <path
              d={geo.lowerBody.crease}
              fill="none"
              stroke="#3D404F"
              strokeWidth={0.8}
              vectorEffect="non-scaling-stroke"
            />
          )}
          <path
            d={geo.lowerBody.outline}
            fill="none"
            stroke="#D47E3F"
            strokeWidth={1.15}
            vectorEffect="non-scaling-stroke"
          />
        </g>

        {/* Recessed copper specimen plaque */}
        <g>
          <path d={geo.coreInset.fill} fill="#2A1A10" />
          {geo.coreInset.shades.map((d, idx) =>
            d ? <path key={idx} d={d} fill="#5B3318" /> : null
          )}
          <path d={geo.coreInset.top} fill="#2E1E14" />
          <path
            d={geo.coreInset.outline}
            fill="none"
            stroke="#D47E3F"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
          <text
            transform={geo.faceMatrix}
            fill="#ECEAE4"
            fontSize="6.5"
            fontWeight="700"
            className="font-mono"
          >
            F&amp;B // LAB
          </text>
          <text
            transform={geo.subMatrix}
            fill="#EB9C5C"
            fontSize="4.6"
            className="font-mono"
          >
            3 SPECIMENES
          </text>
        </g>

        {/* Copper corner rivets */}
        {geo.rivets.map((rivet, idx) => (
          <g key={idx}>
            <path d={rivet.top} fill="#D47E3F" />
            <path
              d={rivet.outline}
              fill="none"
              stroke="#EB9C5C"
              strokeWidth={0.7}
              vectorEffect="non-scaling-stroke"
            />
          </g>
        ))}

        {/* Micro-perforation line */}
        <path
          d={geo.tearLine}
          stroke="#52FF2E"
          strokeDasharray="3 3"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={geo.seamTicks.major}
          stroke="#52FF2E"
          strokeWidth={0.9}
          vectorEffect="non-scaling-stroke"
        />

        {/* Upper rip-off containment cap + radioactive bio-green band */}
        <motion.g
          animate={
            tearing
              ? { x: 54, y: -46, rotate: -14, opacity: 0 }
              : { x: 0, y: 0, rotate: 0, opacity: 1 }
          }
          transition={{ duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
        >
          <path d={geo.upperCap.fill} fill="#15151A" />
          {geo.upperCap.shades.map((d, idx) =>
            d ? <path key={idx} d={d} fill={SHADES[idx]} /> : null
          )}
          <path d={geo.upperCap.top} fill="#2B2E3A" />
          <path
            d={geo.upperCap.outline}
            fill="none"
            stroke="#EB9C5C"
            strokeWidth={1.1}
            vectorEffect="non-scaling-stroke"
          />

          {/* Single lit radioactive bio-green tear band */}
          <path d={geo.greenSeal.fill} fill="#1B3C1A" />
          <path d={geo.greenSeal.top} fill="#32C81E" />
          <path
            d={geo.greenSeal.outline}
            fill="none"
            stroke="#52FF2E"
            strokeWidth={1.15}
            vectorEffect="non-scaling-stroke"
          />
        </motion.g>
      </svg>
    </motion.div>
  );
}
