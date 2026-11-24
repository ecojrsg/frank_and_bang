// @Author: Jonathan Serna
// @Date:   2026-11-23 23:32:00
// @Last Modified by:   Jonathan Serna
// @Last Modified time: 2026-11-23 23:32:00

/**
 * Pure TypeScript isometric 3D-to-2D projection and solid extrusion primitives
 * derived from the anatomy iso-kit geometry engine (zero external deps, zero any).
 */

export type Point2D = readonly [number, number];
export type Point3D = readonly [number, number, number];

export interface IsoProjection {
  origin: Point2D;
  scale: number;
  azimuth?: number;
  elevation?: number;
}

export interface PlanRect {
  x: number;
  y: number;
  w: number;
  d: number;
  r: number;
}

export interface ExtrudedSolid {
  fill: string;
  outline: string;
  crease: string;
  top: string;
  shades: string[];
  bevel?: string;
}

const DEFAULT_AZIMUTH = 45;
const DEFAULT_ELEVATION = 30;
const SHADES = 4;
const RADIANS = Math.PI / 180;
const UNIT = Math.sqrt(1.6);

function cameraOf(projection: IsoProjection) {
  const a = (projection.azimuth ?? DEFAULT_AZIMUTH) * RADIANS;
  const e = (projection.elevation ?? DEFAULT_ELEVATION) * RADIANS;
  return {
    sinA: Math.sin(a),
    cosA: Math.cos(a),
    sinE: Math.sin(e),
    cosE: Math.cos(e),
    k: projection.scale * UNIT,
  };
}

function formatCoord(value: number): string {
  const rounded = (Math.round(value * 10) / 10).toFixed(1).replace(/\.0$/, "");
  return rounded === "-0" ? "0" : rounded;
}

/**
 * Project a 3D world point [x, y, z] onto 2D SVG coordinates.
 */
export function iso(point: Point3D, projection: IsoProjection): Point2D {
  const [x, y, z] = point;
  const { origin } = projection;
  const { sinA, cosA, sinE, cosE, k } = cameraOf(projection);
  return [
    origin[0] + (x * sinA - y * cosA) * k,
    origin[1] + ((x * cosA + y * sinA) * sinE - z * cosE) * k,
  ];
}

function towardViewer(projection: IsoProjection): Point2D {
  const { sinA, cosA } = cameraOf(projection);
  return [cosA, sinA];
}

/**
 * Serialize 2D points into an SVG path string.
 */
export function pathOf(points: readonly Point2D[], closed = false): string {
  if (points.length === 0) {
    return "";
  }
  const cmds = points
    .map(([x, y], idx) => `${idx ? "L" : "M"}${formatCoord(x)} ${formatCoord(y)}`)
    .join("");
  return closed ? `${cmds}Z` : cmds;
}

/**
 * Build a closed 2D rounded-corner rectangle plan ring.
 */
export function roundedPlan(plan: PlanRect, steps = 6): Point2D[] {
  const radius = Math.max(0, Math.min(plan.r, plan.w / 2, plan.d / 2));
  const corners: readonly [number, number, number][] = [
    [plan.x + plan.w - radius, plan.y + radius, -90],
    [plan.x + plan.w - radius, plan.y + plan.d - radius, 0],
    [plan.x + radius, plan.y + plan.d - radius, 90],
    [plan.x + radius, plan.y + plan.r, 180],
  ];
  const out: Point2D[] = [];
  for (const [cx, cy, startDeg] of corners) {
    const count = radius > 0 ? steps : 0;
    for (let step = 0; step <= count; step++) {
      const angle = (startDeg + (count ? (90 * step) / count : 45)) * RADIANS;
      out.push([cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)]);
    }
  }
  return out;
}

/**
 * Inset a rounded plan rectangle evenly on all sides.
 */
export function insetPlan(plan: PlanRect, by: number): PlanRect {
  return {
    x: plan.x + by,
    y: plan.y + by,
    w: plan.w - by * 2,
    d: plan.d - by * 2,
    r: Math.max(0, plan.r - by),
  };
}

/**
 * Return the 4 inset corner anchor points on a rectangular plan.
 */
export function planCorners(
  plan: Pick<PlanRect, "x" | "y" | "w" | "d">,
  inset = 0
): Point2D[] {
  return [
    [plan.x + inset, plan.y + inset],
    [plan.x + plan.w - inset, plan.y + inset],
    [plan.x + inset, plan.y + plan.d - inset],
    [plan.x + plan.w - inset, plan.y + plan.d - inset],
  ];
}

function signedArea(points: readonly Point2D[]): number {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const [ax, ay] = points[i];
    const [bx, by] = points[(i + 1) % points.length];
    area += ax * by - bx * ay;
  }
  return area / 2;
}

function oriented(points: Point2D[]): Point2D[] {
  return signedArea(points) < 0 ? [...points].reverse() : points;
}

function convexHull(points: readonly Point2D[]): Point2D[] {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (sorted.length < 3) {
    return sorted;
  }
  const cross = (o: Point2D, a: Point2D, b: Point2D) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: Point2D[] = [];
  for (const pt of sorted) {
    while (
      lower.length >= 2 &&
      cross(lower[lower.length - 2], lower[lower.length - 1], pt) <= 0
    ) {
      lower.pop();
    }
    lower.push(pt);
  }
  const upper: Point2D[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const pt = sorted[i];
    while (
      upper.length >= 2 &&
      cross(upper[upper.length - 2], upper[upper.length - 1], pt) <= 0
    ) {
      upper.pop();
    }
    upper.push(pt);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

function runsOf(flags: readonly boolean[], want: boolean): number[][] {
  const count = flags.length;
  const runs: number[][] = [];
  const start = flags.findIndex(
    (flag, idx) => flag !== flags[(idx + count - 1) % count]
  );
  if (start < 0) {
    return flags[0] === want
      ? [Array.from({ length: count + 1 }, (_, i) => i % count)]
      : [];
  }
  let run: number[] | null = null;
  for (let step = 0; step < count; step++) {
    const idx = (start + step) % count;
    if (flags[idx] === want) {
      if (!run) {
        run = [idx];
      }
      run.push((idx + 1) % count);
    } else if (run) {
      runs.push(run);
      run = null;
    }
  }
  if (run) {
    runs.push(run);
  }
  return runs;
}

/**
 * Extrude any 2D ring into a shaded 4-tone isometric solid with crisp outline/crease.
 */
export function extrudeRing(
  ring: readonly Point2D[],
  z: number,
  height: number,
  projection: IsoProjection,
  options: { convex?: boolean; bevel?: number } = {}
): ExtrudedSolid {
  const convex = options.convex ?? true;
  const count = ring.length;
  const counter = signedArea(ring) > 0;
  const [vx, vy] = towardViewer(projection);
  const { sinA, cosA } = cameraOf(projection);

  const normals: Point2D[] = ring.map(([ax, ay], idx) => {
    const [bx, by] = ring[(idx + 1) % count];
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;
    return counter ? [dy / len, -dx / len] : [-dy / len, dx / len];
  });

  const facing = normals.map(([nx, ny]) => nx * vx + ny * vy > 1e-9);
  const top = ring.map(([x, y]) => iso([x, y, z + height], projection));
  const bottom = ring.map(([x, y]) => iso([x, y, z], projection));
  const outline: string[] = [];
  const crease: string[] = [];

  for (const run of runsOf(facing, false)) {
    outline.push(pathOf(run.map((idx) => top[idx])));
  }
  for (const run of runsOf(facing, true)) {
    crease.push(pathOf(run.map((idx) => top[idx])));
    if (height > 0) {
      outline.push(pathOf(run.map((idx) => bottom[idx])));
    }
  }
  if (height > 0) {
    for (let idx = 0; idx < count; idx++) {
      if (facing[(idx + count - 1) % count] !== facing[idx]) {
        outline.push(pathOf([top[idx], bottom[idx]]));
      }
    }
  }

  let fill: string;
  if (convex) {
    fill = pathOf(convexHull([...top, ...bottom]), true);
  } else {
    const parts = [pathOf(oriented(top), true), pathOf(oriented(bottom), true)];
    for (let idx = 0; idx < count; idx++) {
      if (!facing[idx]) continue;
      const next = (idx + 1) % count;
      parts.push(
        pathOf(
          oriented([top[idx], top[next], bottom[next], bottom[idx]]),
          true
        )
      );
    }
    fill = parts.join("");
  }

  const buckets: string[][] = Array.from({ length: SHADES }, () => []);
  if (height > 0) {
    const [lx, ly] = [-sinA, cosA];
    for (let idx = 0; idx < count; idx++) {
      if (!facing[idx]) continue;
      const [nx, ny] = normals[idx];
      const lit = (nx * lx + ny * ly + 1) / 2;
      const shade = Math.min(SHADES - 1, Math.max(0, Math.floor(lit * SHADES)));
      const next = (idx + 1) % count;
      buckets[shade].push(
        pathOf(
          oriented([top[idx], top[next], bottom[next], bottom[idx]]),
          true
        )
      );
    }
  }

  let bevel: string | undefined;
  if (options.bevel && options.bevel > 0) {
    const by = options.bevel;
    const inset = ring.map(([x, y], idx) => {
      const [ax, ay] = normals[(idx + count - 1) % count];
      const [bx, by2] = normals[idx];
      const mx = ax + bx;
      const my = ay + by2;
      const len = Math.hypot(mx, my) || 1;
      return [x - (mx / len) * by, y - (my / len) * by] as Point2D;
    });
    const insetTop = inset.map(([x, y]) => iso([x, y, z + height], projection));
    bevel = runsOf(facing, true)
      .map((run) =>
        pathOf([
          top[run[0]],
          ...run.slice(1, -1).map((idx) => insetTop[idx]),
          top[run[run.length - 1]],
        ])
      )
      .join("");
  }

  return {
    fill,
    outline: outline.join(""),
    crease: crease.join(""),
    top: pathOf(oriented(top), true),
    shades: buckets.map((paths) => paths.join("")),
    bevel,
  };
}

/**
 * Extrude a rectangular plan slab with optional rounded corners and bevel.
 */
export function slabOf(
  plan: PlanRect,
  z: number,
  height: number,
  projection: IsoProjection,
  steps = 6,
  bevel = 0
): ExtrudedSolid {
  return extrudeRing(roundedPlan(plan, steps), z, height, projection, {
    convex: true,
    bevel,
  });
}

/**
 * Build a circular 2D ring for cylindrical solids and dials.
 */
export function circleRing(
  cx: number,
  cy: number,
  radius: number,
  steps = 32
): Point2D[] {
  return Array.from({ length: steps }, (_, step) => {
    const angle = (step / steps) * Math.PI * 2;
    return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)];
  });
}

/**
 * Extrude an upright isometric cylinder.
 */
export function cylinderOf(
  cx: number,
  cy: number,
  radius: number,
  z: number,
  height: number,
  projection: IsoProjection,
  steps = 28,
  bevel = 0
): ExtrudedSolid {
  return extrudeRing(circleRing(cx, cy, radius, steps), z, height, projection, {
    convex: true,
    bevel,
  });
}

/**
 * Project a 3D line segment between two points.
 */
export function segmentOf(
  from: Point3D,
  to: Point3D,
  projection: IsoProjection
): string {
  return pathOf([iso(from, projection), iso(to, projection)]);
}

/**
 * Project a line lying flat on top of plane z.
 */
export function lineOnTop(
  from: Point2D,
  to: Point2D,
  z: number,
  projection: IsoProjection
): string {
  return pathOf([
    iso([from[0], from[1], z], projection),
    iso([to[0], to[1], z], projection),
  ]);
}

/**
 * Project a vertical knurl grip pattern on the front-facing arc of a cylinder.
 */
export function knurlOf(
  cx: number,
  cy: number,
  radius: number,
  z0: number,
  z1: number,
  count: number,
  projection: IsoProjection,
  inset = 0.4
): string {
  const [vx, vy] = towardViewer(projection);
  const lines: string[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const nx = Math.cos(angle);
    const ny = Math.sin(angle);
    if (nx * vx + ny * vy < 0.15) continue;
    lines.push(
      segmentOf(
        [cx + radius * nx, cy + radius * ny, z0 + inset],
        [cx + radius * nx, cy + radius * ny, z1 - inset],
        projection
      )
    );
  }
  return lines.join("");
}

/**
 * Generate graduated measurement ticks along an isometric top edge.
 */
export function topTicksOf(
  from: number,
  to: number,
  step: number,
  every: number,
  edge: number,
  z: number,
  lengths: readonly [number, number],
  projection: IsoProjection,
  axis: "x" | "y" = "x"
): { minor: string; major: string } {
  const minor: string[] = [];
  const major: string[] = [];
  const first = Math.ceil(from / step) * step;
  for (
    let at = first, idx = Math.round(first / step);
    at <= to + 1e-9;
    at += step, idx++
  ) {
    const big = idx % every === 0;
    const len = big ? lengths[1] : lengths[0];
    const a: Point2D = axis === "x" ? [at, edge] : [edge, at];
    const b: Point2D = axis === "x" ? [at, edge + len] : [edge + len, at];
    (big ? major : minor).push(lineOnTop(a, b, z, projection));
  }
  return { minor: minor.join(""), major: major.join("") };
}

/**
 * Generate radial graduation ticks on top of a circular dial plate.
 */
export function radialTicksOf(
  cx: number,
  cy: number,
  radius: number,
  count: number,
  every: number,
  z: number,
  lengths: readonly [number, number],
  projection: IsoProjection
): { minor: string; major: string } {
  const minor: string[] = [];
  const major: string[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const big = i % every === 0;
    const inner = radius - (big ? lengths[1] : lengths[0]);
    const sx = Math.sin(angle);
    const sy = -Math.cos(angle);
    (big ? major : minor).push(
      lineOnTop(
        [cx + sx * inner, cy + sy * inner],
        [cx + sx * radius, cy + sy * radius],
        z,
        projection
      )
    );
  }
  return { minor: minor.join(""), major: major.join("") };
}

/**
 * Compute an isometric text matrix lying flat on the top plane z.
 */
export function topMatrix(
  at: Point2D,
  z: number,
  projection: IsoProjection,
  along: "x" | "y" = "x"
): string {
  const origin = iso([at[0], at[1], z], projection);
  const ux = iso([at[0] + 1, at[1], z], projection);
  const uy = iso([at[0], at[1] + 1, z], projection);
  const xVec: Point2D = [ux[0] - origin[0], ux[1] - origin[1]];
  const yVec: Point2D = [uy[0] - origin[0], uy[1] - origin[1]];
  const u = along === "x" ? xVec : ([-yVec[0], -yVec[1]] as Point2D);
  const v = along === "x" ? yVec : xVec;
  const r = (n: number) => Math.round(n * 1000) / 1000;
  return `matrix(${r(u[0])} ${r(u[1])} ${r(v[0])} ${r(v[1])} ${r(origin[0])} ${r(origin[1])})`;
}

/**
 * Compute an axis translation vector in 2D SVG pixels for interactive travel.
 */
export function axisVector(
  projection: IsoProjection,
  delta: Point3D
): Point2D {
  const o = iso([0, 0, 0], projection);
  const p = iso(delta, projection);
  return [p[0] - o[0], p[1] - o[1]];
}
