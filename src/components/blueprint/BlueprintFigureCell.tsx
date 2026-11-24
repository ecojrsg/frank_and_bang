"use client";

// @Author: Jonathan Serna
// @Date:   2026-11-23 23:34:00
// @Last Modified by:   Jonathan Serna
// @Last Modified time: 2026-11-23 23:38:00

/**
 * Interactive dotted blueprint cell displaying solid 4-tone isometric graphite
 * mechanical figures with one lit focal element and offscreen animation pause.
 */

import { useEffect, useMemo, useRef, useState } from "react";

import {
  axisVector,
  cylinderOf,
  insetPlan,
  iso,
  knurlOf,
  lineOnTop,
  planCorners,
  radialTicksOf,
  segmentOf,
  slabOf,
  topMatrix,
  topTicksOf,
  type ExtrudedSolid,
  type IsoProjection,
} from "@/components/iso/isoGeometry";

export type BlueprintFigureId = "FIG_01" | "FIG_02" | "FIG_03" | "FIG_04";
export type BlueprintAccent = "green" | "copper";

interface BlueprintFigureCellProps {
  fig: BlueprintFigureId;
  hint: string;
  readout?: string;
  accent: BlueprintAccent;
  className?: string;
}

const PROJECTION: IsoProjection = {
  origin: [210, 175],
  scale: 1.85,
  azimuth: 45,
  elevation: 30,
};

const GRAPHITE_SHADES = ["#181920", "#1E2028", "#252731", "#2E313D"] as const;

interface SolidMeshProps {
  solid: ExtrudedSolid;
  litAccent?: BlueprintAccent | null;
}

/**
 * Render an extruded isometric solid with 4-tone graphite or focal neon/copper lighting.
 */
function SolidMesh({ solid, litAccent = null }: SolidMeshProps) {
  const isGreen = litAccent === "green";
  const isCopper = litAccent === "copper";
  const fill = isGreen ? "#172A18" : isCopper ? "#332014" : "#15151A";
  const topFill = isGreen ? "#2A7A20" : isCopper ? "#8E4B20" : "#262832";
  const litShade = isGreen ? "#1E4D19" : isCopper ? "#5C3116" : null;
  const edgeStroke = isGreen ? "#52FF2E" : isCopper ? "#EB9C5C" : "#6F7282";
  const creaseStroke = isGreen ? "#32C81E" : isCopper ? "#D47E3F" : "#393C49";

  return (
    <g>
      <path d={solid.fill} fill={fill} stroke="none" />
      {solid.shades.map((d, idx) =>
        d ? (
          <path
            key={idx}
            d={d}
            fill={litShade ?? GRAPHITE_SHADES[idx]}
            stroke="none"
          />
        ) : null
      )}
      <path d={solid.top} fill={topFill} stroke="none" />
      {solid.crease && (
        <path
          d={solid.crease}
          fill="none"
          stroke={creaseStroke}
          strokeWidth={0.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      )}
      {solid.bevel && (
        <path
          d={solid.bevel}
          fill="none"
          stroke={creaseStroke}
          strokeWidth={0.7}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      )}
      <path
        d={solid.outline}
        fill="none"
        stroke={edgeStroke}
        strokeWidth={litAccent ? 1.15 : 0.85}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </g>
  );
}

/**
 * Build an upright guide post + cap segment between z0 and z1.
 */
function buildGuideRod(
  x: number,
  y: number,
  z0: number,
  z1: number,
  projection: IsoProjection
) {
  return cylinderOf(x, y, 2.2, z0, z1 - z0, projection, 14);
}

/**
 * Render one solid isometric physical mechanism on a dotted #15151A cell.
 */
export function BlueprintFigureCell({
  fig,
  hint,
  readout,
  accent,
  className = "",
}: BlueprintFigureCellProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(true);
  const [hovered, setHovered] = useState(false);
  const [toggled, setToggled] = useState(false);

  const active = hovered || toggled;

  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]) {
          setInView(entries[0].isIntersecting);
        }
      },
      { threshold: 0.05 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const scene = useMemo(() => {
    const p = PROJECTION;
    if (fig === "FIG_01") {
      const basePlan = { x: -72, y: -44, w: 144, d: 92, r: 8 };
      const platePlan = { x: -50, y: -34, w: 100, d: 62, r: 6 };
      const focalPlan = insetPlan(platePlan, 3);
      const liftZ = axisVector(p, [0, 0, 14]);
      const base = slabOf(basePlan, 0, 10, p, 6, 1.4);
      const lowerDeck = slabOf(platePlan, 14, 7, p, 5, 0.9);
      const focalCore = slabOf(focalPlan, 26, 7, p, 5, 0.8);
      const upperDeck = slabOf(platePlan, 39, 6, p, 5, 0.9);
      const dial = cylinderOf(46, 30, 9.5, 10, 7, p, 24, 0.8);
      const dialKnurl = knurlOf(46, 30, 9.5, 10, 17, 20, p, 0.6);
      const dialTicks = radialTicksOf(46, 30, 8.2, 12, 3, 17, [1.5, 2.8], p);
      const scaleTicks = topTicksOf(-58, 28, 6, 3, 41, 10, [2.2, 4.4], p, "x");
      const upperTicks = topTicksOf(-40, 40, 8, 2, -28, 45, [2.4, 4.8], p, "x");
      const screws = planCorners(basePlan, 7).map(([sx, sy]) =>
        iso([sx, sy, 10], p)
      );
      const rods = planCorners(platePlan, 6).map(([rx, ry]) =>
        buildGuideRod(rx, ry, 10, 50, p)
      );
      const faceMtx = topMatrix([-42, 16], 45, p, "x");
      return {
        kind: "FIG_01" as const,
        base,
        lowerDeck,
        focalCore,
        upperDeck,
        dial,
        dialKnurl,
        dialTicks,
        scaleTicks,
        upperTicks,
        screws,
        rods,
        faceMtx,
        liftZ,
      };
    }

    if (fig === "FIG_02") {
      const basePlan = { x: -76, y: -40, w: 152, d: 80, r: 7 };
      const trackPlan = { x: -64, y: -28, w: 128, d: 56, r: 4 };
      const base = slabOf(basePlan, 0, 10, p, 6, 1.4);
      const bed = slabOf(trackPlan, 10, 4, p, 4, 0.6);
      const railBack = slabOf({ x: -62, y: -24, w: 124, d: 6, r: 2 }, 14, 11, p, 4);
      const railFront = slabOf({ x: -62, y: 18, w: 124, d: 6, r: 2 }, 14, 11, p, 4);
      const gantry = slabOf({ x: -24, y: -26, w: 10, d: 52, r: 2 }, 25, 7, p, 4);
      const focalCarriage = slabOf(
        { x: -12, y: -11, w: 26, d: 22, r: 3 },
        14,
        10,
        p,
        4,
        0.7
      );
      const vernier = topTicksOf(-60, 60, 5, 4, 29, 14, [2.5, 5], p, "x");
      const slideVec = axisVector(p, [26, 0, 0]);
      const targetDot = iso([-1, 0, 24], p);
      return {
        kind: "FIG_02" as const,
        base,
        bed,
        railBack,
        railFront,
        gantry,
        focalCarriage,
        vernier,
        slideVec,
        targetDot,
      };
    }

    if (fig === "FIG_03") {
      const plinth = slabOf({ x: -58, y: -52, w: 116, d: 104, r: 9 }, 0, 10, p, 6, 1.4);
      const collar = cylinderOf(0, 0, 36, 10, 9, p, 28, 0.8);
      const capsule = cylinderOf(0, 0, 23, 19, 22, p, 28, 0.9);
      const capRing = cylinderOf(0, 0, 27, 41, 6, p, 28, 0.6);
      const clamps = planCorners({ x: -34, y: -34, w: 68, d: 68 }, 0).map(
        ([cx, cy]) => buildGuideRod(cx, cy, 10, 48, p)
      );
      const ticks = radialTicksOf(0, 0, 33, 24, 4, 19, [2.2, 4.5], p);
      const liftZ = axisVector(p, [0, 0, 11]);
      return {
        kind: "FIG_03" as const,
        plinth,
        collar,
        capsule,
        capRing,
        clamps,
        ticks,
        liftZ,
      };
    }

    const chassis = slabOf({ x: -66, y: -44, w: 132, d: 88, r: 8 }, 0, 11, p, 6, 1.3);
    const housing = slabOf({ x: -50, y: -30, w: 100, d: 60, r: 5 }, 11, 10, p, 5, 0.8);
    const focalSync = slabOf({ x: -34, y: -20, w: 68, d: 40, r: 4 }, 21, 9, p, 4, 0.8);
    const topCap = slabOf({ x: -46, y: -26, w: 92, d: 52, r: 5 }, 35, 7, p, 4, 0.7);
    const dial = cylinderOf(0, 0, 13, 42, 6, p, 24, 0.6);
    const dialKnurl = knurlOf(0, 0, 13, 42, 48, 18, p, 0.5);
    const dialTicks = radialTicksOf(0, 0, 11, 12, 3, 48, [1.5, 3], p);
    const pinLines = ([-36, -12, 12, 36] as const)
      .map((px) => segmentOf([px, 44, 6], [px, 50, 6], p))
      .join("");
    const busLine = lineOnTop([-42, 34], [42, 34], 11, p);
    const liftZ = axisVector(p, [0, 0, 8]);
    return {
      kind: "FIG_04" as const,
      chassis,
      housing,
      focalSync,
      topCap,
      dial,
      dialKnurl,
      dialTicks,
      pinLines,
      busLine,
      liftZ,
    };
  }, [fig]);

  const accentColor = accent === "green" ? "#52FF2E" : "#D47E3F";

  return (
    <div
      ref={rootRef}
      data-paused={!inView}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => setToggled((prev) => !prev)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setToggled((prev) => !prev);
        }
      }}
      className={`blueprint-dots iso-mech relative flex min-h-[270px] cursor-pointer flex-col justify-between p-5 select-none ${className}`}
    >
      {/* Top monospaced annotations */}
      <div className="flex items-center justify-between gap-2 font-mono text-[11px] tracking-[0.1em]">
        <span className="font-bold text-[#ECEAE4]">{fig}</span>
        <span style={{ color: active ? accentColor : "#8E8D86" }}>
          {hint}
        </span>
      </div>

      {/* Isometric physical mechanism */}
      <div className="my-2 flex flex-1 items-center justify-center">
        <svg
          viewBox="0 0 420 250"
          className="h-52 w-full max-w-[390px] overflow-visible"
          role="img"
          aria-label={`Mecanismo isometrico ${fig}`}
        >
          {scene.kind === "FIG_01" && (
            <g>
              <SolidMesh solid={scene.base} />
              <path
                d={scene.scaleTicks.minor}
                stroke="#5F6372"
                strokeWidth={0.7}
                vectorEffect="non-scaling-stroke"
              />
              <path
                d={scene.scaleTicks.major}
                stroke="#8E8D86"
                strokeWidth={0.95}
                vectorEffect="non-scaling-stroke"
              />
              {scene.screws.map(([cx, cy], idx) => (
                <circle key={idx} cx={cx} cy={cy} r={1.5} fill="#8E8D86" />
              ))}
              <SolidMesh solid={scene.dial} />
              <path
                d={scene.dialKnurl}
                stroke="#454856"
                strokeWidth={0.7}
                vectorEffect="non-scaling-stroke"
              />
              <path
                d={scene.dialTicks.major}
                stroke="#D47E3F"
                strokeWidth={0.9}
                vectorEffect="non-scaling-stroke"
              />
              <SolidMesh solid={scene.lowerDeck} />
              <g
                className="transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
                style={{
                  transform: active
                    ? `translate(${scene.liftZ[0] * 0.4}px, ${scene.liftZ[1] * 0.4}px)`
                    : "translate(0px, 0px)",
                }}
              >
                <g className="iso-calm-breathe">
                  <SolidMesh solid={scene.focalCore} litAccent={accent} />
                </g>
              </g>
              <g
                className="transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
                style={{
                  transform: active
                    ? `translate(${scene.liftZ[0]}px, ${scene.liftZ[1]}px)`
                    : "translate(0px, 0px)",
                }}
              >
                <SolidMesh solid={scene.upperDeck} />
                <path
                  d={scene.upperTicks.minor}
                  stroke="#5F6372"
                  strokeWidth={0.7}
                  vectorEffect="non-scaling-stroke"
                />
                <path
                  d={scene.upperTicks.major}
                  stroke="#8E8D86"
                  strokeWidth={0.95}
                  vectorEffect="non-scaling-stroke"
                />
                <text
                  transform={scene.faceMtx}
                  fill="#8E8D86"
                  fontSize="5"
                  className="font-mono"
                >
                  GRID 1PX · ANATOMY
                </text>
              </g>
              {scene.rods.map((rod, idx) => (
                <SolidMesh key={idx} solid={rod} />
              ))}
            </g>
          )}

          {scene.kind === "FIG_02" && (
            <g>
              <SolidMesh solid={scene.base} />
              <SolidMesh solid={scene.bed} />
              <path
                d={scene.vernier.minor}
                stroke="#5F6372"
                strokeWidth={0.7}
                vectorEffect="non-scaling-stroke"
              />
              <path
                d={scene.vernier.major}
                stroke="#8E8D86"
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
              <SolidMesh solid={scene.railBack} />
              <g
                className="transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
                style={{
                  transform: active
                    ? `translate(${scene.slideVec[0]}px, ${scene.slideVec[1]}px)`
                    : "translate(0px, 0px)",
                }}
              >
                <g className="iso-calm-slide">
                  <SolidMesh solid={scene.focalCarriage} litAccent={accent} />
                  <circle
                    cx={scene.targetDot[0]}
                    cy={scene.targetDot[1]}
                    r={2.5}
                    fill="#ECEAE4"
                  />
                </g>
              </g>
              <SolidMesh solid={scene.gantry} />
              <SolidMesh solid={scene.railFront} />
            </g>
          )}

          {scene.kind === "FIG_03" && (
            <g>
              <SolidMesh solid={scene.plinth} />
              <SolidMesh solid={scene.collar} />
              <path
                d={scene.ticks.minor}
                stroke="#5F6372"
                strokeWidth={0.7}
                vectorEffect="non-scaling-stroke"
              />
              <path
                d={scene.ticks.major}
                stroke="#D47E3F"
                strokeWidth={0.95}
                vectorEffect="non-scaling-stroke"
              />
              <g
                className="transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
                style={{
                  transform: active
                    ? `translate(${scene.liftZ[0]}px, ${scene.liftZ[1]}px)`
                    : "translate(0px, 0px)",
                }}
              >
                <g className="iso-calm-breathe">
                  <SolidMesh solid={scene.capsule} litAccent={accent} />
                  <SolidMesh solid={scene.capRing} />
                </g>
              </g>
              {scene.clamps.map((clamp, idx) => (
                <SolidMesh key={idx} solid={clamp} />
              ))}
            </g>
          )}

          {scene.kind === "FIG_04" && (
            <g>
              <SolidMesh solid={scene.chassis} />
              <path
                d={scene.pinLines}
                stroke="#D47E3F"
                strokeWidth={1.1}
                vectorEffect="non-scaling-stroke"
              />
              <SolidMesh solid={scene.housing} />
              <path
                d={scene.busLine}
                stroke="#52FF2E"
                strokeWidth={0.9}
                vectorEffect="non-scaling-stroke"
              />
              <g
                className="transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
                style={{
                  transform: active
                    ? `translate(${scene.liftZ[0] * 0.5}px, ${scene.liftZ[1] * 0.5}px)`
                    : "translate(0px, 0px)",
                }}
              >
                <g className="iso-calm-breathe">
                  <SolidMesh solid={scene.focalSync} litAccent={accent} />
                </g>
              </g>
              <g
                className="transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
                style={{
                  transform: active
                    ? `translate(${scene.liftZ[0]}px, ${scene.liftZ[1]}px)`
                    : "translate(0px, 0px)",
                }}
              >
                <SolidMesh solid={scene.topCap} />
                <SolidMesh solid={scene.dial} />
                <path
                  d={scene.dialKnurl}
                  stroke="#454856"
                  strokeWidth={0.7}
                  vectorEffect="non-scaling-stroke"
                />
                <path
                  d={scene.dialTicks.major}
                  stroke="#52FF2E"
                  strokeWidth={0.9}
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            </g>
          )}
        </svg>
      </div>

      {/* Bottom monospaced telemetry */}
      <div className="flex items-center justify-between gap-2 font-mono text-[10px] tracking-[0.08em] text-[#8E8D86]">
        <span className="uppercase">
          {toggled ? "ACTIVO · CLIC PARA FIJAR" : "SOLIDO ISOMETRICO 4-TONOS"}
        </span>
        {readout && <span className="tabular-nums text-[#B0AEA6]">{readout}</span>}
      </div>
    </div>
  );
}
