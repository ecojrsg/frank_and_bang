"use client";

// @Author: Jonathan Serna
// @Date:   2026-11-23 22:00:00
// @Last Modified by:   Jonathan Serna
// @Last Modified time: 2026-11-23 23:38:00

/**
 * Compact isometric telemetry dial gauge crafted with the anatomy skill's
 * instrument aesthetic: dark charcoal plinth, copper ticks, lit needle,
 * and compressed radioactive power indicator.
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
    <div className="flex items-center gap-2 border border-[#D47E3F]/45 bg-[#15151A]/95 px-2.5 py-1.5 shadow-lg">
      <svg
        viewBox="0 0 154 88"
        className="h-14 w-24"
        role="img"
        aria-label={`Dial de punteria ${clampedAngle} grados`}
      >
        {/* Dark isometric instrument base plate with copper corner screws */}
        <polygon
          points="12,72 34,58 140,58 118,72"
          fill="#22242C"
          stroke="#494C5C"
          strokeWidth="1"
        />
        <polygon
          points="12,72 118,72 118,79 12,79"
          fill="#16171D"
          stroke="#494C5C"
          strokeWidth="1"
        />
        <polygon
          points="118,72 140,58 140,65 118,79"
          fill="#1C1E26"
          stroke="#494C5C"
          strokeWidth="1"
        />
        <circle cx="24" cy="70" r="1.4" fill="#D47E3F" />
        <circle cx="114" cy="70" r="1.4" fill="#D47E3F" />

        {/* Dial quadrant arc */}
        <path
          d={`M ${DIAL_CENTER_X} ${DIAL_CENTER_Y} L ${DIAL_CENTER_X + DIAL_RADIUS} ${DIAL_CENTER_Y} A ${DIAL_RADIUS} ${DIAL_RADIUS} 0 0 0 ${DIAL_CENTER_X} ${DIAL_CENTER_Y - DIAL_RADIUS} Z`}
          fill="#1B1C22"
          stroke="#D47E3F"
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
              stroke={major ? "#EB9C5C" : "#8E8D86"}
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
          stroke="#ECEAE4"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <circle
          cx={DIAL_CENTER_X}
          cy={DIAL_CENTER_Y}
          r="3.2"
          fill="#262832"
          stroke="#52FF2E"
          strokeWidth="1.2"
        />

        {/* Power spring compression tower on the left */}
        <rect
          x="19"
          y="18"
          width="11"
          height="46"
          fill="#141418"
          stroke="#494C5C"
          strokeWidth="1"
        />
        <rect
          x="21"
          y={62 - chargeHeight}
          width="7"
          height={Math.max(3, chargeHeight)}
          fill={chargePower > 0.7 ? "#D47E3F" : "#52FF2E"}
        />
      </svg>

      <div className="font-mono text-[11px] leading-tight tabular-nums">
        <div className="text-[9px] font-bold tracking-widest text-[#8E8D86]">
          MIRA
        </div>
        <div className="text-sm font-bold text-[#ECEAE4]">{clampedAngle}°</div>
        <div className="text-[10px] font-bold text-[#EB9C5C]">
          {Math.round(chargePower * 100)}% PWR
        </div>
      </div>
    </div>
  );
}
