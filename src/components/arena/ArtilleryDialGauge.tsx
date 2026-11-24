"use client";

// @Author: Jonathan Serna
// @Date:   2026-11-23 22:00:00
// @Last Modified by:   Jonathan Serna
// @Last Modified time: 2026-11-23 22:00:00

/**
 * Compact isometric telemetry dial gauge crafted with the anatomy skill's
 * instrument aesthetic: dark chamfered plinth, radial scale ticks, live lit
 * aiming needle, and compressed power spring indicator.
 */

interface ArtilleryDialGaugeProps {
  aimAngleDeg: number;
  chargePower: number;
}

const DIAL_CENTER_X = 76;
const DIAL_CENTER_Y = 66;
const DIAL_RADIUS = 38;

/**
 * Render an isometric-style SVG artillery angle & charge gauge for the HUD.
 */
export function ArtilleryDialGauge({
  aimAngleDeg,
  chargePower,
}: ArtilleryDialGaugeProps) {
  const clampedAngle = Math.max(10, Math.min(85, aimAngleDeg));
  const rad = (clampedAngle * Math.PI) / 180;
  const needleX = DIAL_CENTER_X + Math.cos(rad) * (DIAL_RADIUS - 7);
  const needleY = DIAL_CENTER_Y - Math.sin(rad) * (DIAL_RADIUS - 7);
  const chargeHeight = Math.round(Math.max(0, Math.min(1, chargePower)) * 44);

  const ticks = [10, 25, 40, 55, 70, 85];

  return (
    <div className="flex items-center gap-2 rounded-xl border border-slate-700/80 bg-[#131313]/95 px-2.5 py-1.5 shadow-lg">
      <svg
        viewBox="0 0 154 88"
        className="h-14 w-24"
        role="img"
        aria-label={`Dial de punteria ${clampedAngle} grados`}
      >
        {/* Dark isometric instrument base plate with corner screws */}
        <polygon
          points="12,72 34,58 140,58 118,72"
          fill="#1b1b1b"
          stroke="#3e3e3e"
          strokeWidth="1"
        />
        <polygon
          points="12,72 118,72 118,79 12,79"
          fill="#0f0f0f"
          stroke="#3e3e3e"
          strokeWidth="1"
        />
        <polygon
          points="118,72 140,58 140,65 118,79"
          fill="#151515"
          stroke="#3e3e3e"
          strokeWidth="1"
        />
        <circle cx="24" cy="70" r="1.3" fill="#6a6a6a" />
        <circle cx="114" cy="70" r="1.3" fill="#6a6a6a" />

        {/* Dial quadrant arc */}
        <path
          d={`M ${DIAL_CENTER_X} ${DIAL_CENTER_Y} L ${DIAL_CENTER_X + DIAL_RADIUS} ${DIAL_CENTER_Y} A ${DIAL_RADIUS} ${DIAL_RADIUS} 0 0 0 ${DIAL_CENTER_X} ${DIAL_CENTER_Y - DIAL_RADIUS} Z`}
          fill="#181818"
          stroke="#6a6a6a"
          strokeWidth="1"
        />

        {/* Radial ticks from 10 to 85 deg */}
        {ticks.map((deg) => {
          const r = (deg * Math.PI) / 180;
          const x1 = DIAL_CENTER_X + Math.cos(r) * (DIAL_RADIUS - 5);
          const y1 = DIAL_CENTER_Y - Math.sin(r) * (DIAL_RADIUS - 5);
          const x2 = DIAL_CENTER_X + Math.cos(r) * DIAL_RADIUS;
          const y2 = DIAL_CENTER_Y - Math.sin(r) * DIAL_RADIUS;
          const major = deg === 40 || deg === 70 || deg === 10 || deg === 85;
          return (
            <line
              key={deg}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={major ? "#d4d4d4" : "#6a6a6a"}
              strokeWidth={major ? "1.3" : "0.8"}
            />
          );
        })}

        {/* Lit live needle */}
        <line
          x1={DIAL_CENTER_X}
          y1={DIAL_CENTER_Y}
          x2={needleX}
          y2={needleY}
          stroke="#ffffff"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <circle
          cx={DIAL_CENTER_X}
          cy={DIAL_CENTER_Y}
          r="3.2"
          fill="#262626"
          stroke="#ffffff"
          strokeWidth="1.2"
        />

        {/* Power spring compression tower on the left */}
        <rect
          x="19"
          y="18"
          width="11"
          height="46"
          rx="2"
          fill="#121212"
          stroke="#3e3e3e"
          strokeWidth="1"
        />
        <rect
          x="21"
          y={62 - chargeHeight}
          width="7"
          height={Math.max(3, chargeHeight)}
          rx="1"
          fill={chargePower > 0.7 ? "#fbbf24" : "#34d399"}
        />
      </svg>

      <div className="font-mono text-[11px] leading-tight">
        <div className="text-[9px] font-bold tracking-widest text-slate-400">
          MIRA
        </div>
        <div className="text-sm font-black text-white">{clampedAngle}°</div>
        <div className="text-[10px] font-bold text-amber-300">
          {Math.round(chargePower * 100)}% PWR
        </div>
      </div>
    </div>
  );
}
