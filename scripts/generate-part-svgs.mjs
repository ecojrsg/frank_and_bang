// @Author: Jonathan Serna
// @Date:   2026-11-23 20:57:00
// @Last Modified by:   Jonathan Serna
// @Last Modified time: 2026-11-23 21:56:30

/**
 * Generate standalone isometric SVG assets for all 12 Frank and Bang body parts
 * (heads, torsos, arms, legs) and the TCG card back using anatomy (iso-kit.mjs).
 */

import { mkdirSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

import {
  boxCorners,
  coil,
  corners,
  cylinder,
  dotsSvg,
  figureSvg,
  fitProjection,
  insetPlan,
  iso,
  knurl,
  lineOnTop,
  lineSvg,
  planOutline,
  pointsAt,
  ring,
  segment,
  sideSeam,
  slabOf,
  solidSvg,
  topTicks,
  wireSvg,
} from "./lib/iso-kit.mjs";

const currentDir = dirname(fileURLToPath(import.meta.url));
const OUTPUT_ROOT = join(currentDir, "..", "assets", "parts-assets");
const WIDTH = 320;
const HEIGHT = 260;

/**
 * Create a base instrument plinth shared across all part illustrations.
 */
function buildBasePlinth(plan, projection) {
  const base = slabOf(plan, 0, 8, projection, 8, 0.8);
  const groove = planOutline(insetPlan(plan, 4), 8, projection, 8);
  const screwPoints = corners(plan, 6).map(([x, y]) => [x, y, 8]);
  const inner = lineSvg(groove, { tone: "faint" })
    + lineSvg(sideSeam(plan, 4, projection), { tone: "faint" });

  return [
    solidSvg(base, { tone: "lo", crease: "faint", halo: true, inner }),
    dotsSvg(pointsAt(screwPoints, projection), { size: 0.9, tone: "mid" }),
  ];
}

/**
 * Render Normal Arms: Copper Hook mechanical arm rig.
 */
function buildCopperHookArmsSvg() {
  const basePlan = { x: 0, y: 0, w: 96, d: 68, r: 6 };
  const projection = fitProjection(
    [...boxCorners(basePlan, 0, 62)],
    WIDTH,
    HEIGHT,
    { pad: 24, azimuth: 42, elevation: 30 }
  );
  const body = [...buildBasePlinth(basePlan, projection)];

  // Shoulder mount block and twin articulated bars.
  const mount = { x: 14, y: 18, w: 28, d: 32, r: 4 };
  body.push(solidSvg(slabOf(mount, 8, 22, projection, 6, 0.6), { tone: "mid" }));
  body.push(solidSvg(cylinder(28, 34, 8, 30, 12, projection), { tone: "hi" }));

  // Forearm linkage beam with ruler ticks.
  const beam = { x: 26, y: 26, w: 46, d: 16, r: 3 };
  const ticks = topTicks(32, 66, 4, 5, 28, 42, [2.2, 4], projection, "x");
  body.push(
    solidSvg(slabOf(beam, 34, 8, projection, 6, 0.5), {
      tone: "hi",
      inner: lineSvg(ticks.minor, { tone: "lo" })
        + lineSvg(ticks.major, { tone: "mid" }),
    })
  );

  // Lit copper hook clamp jaw at the wrist end.
  const wrist = cylinder(72, 34, 9, 30, 16, projection);
  const upperJaw = { x: 74, y: 20, w: 16, d: 8, r: 2 };
  const lowerJaw = { x: 74, y: 40, w: 16, d: 8, r: 2 };
  body.push(solidSvg(wrist, { tone: "mid" }));
  body.push(solidSvg(slabOf(upperJaw, 36, 6, projection, 4), { tone: "hi", lit: true }));
  body.push(solidSvg(slabOf(lowerJaw, 36, 6, projection, 4), { tone: "hi", lit: true }));

  // Control cable connecting mount to wrist.
  body.push(
    wireSvg(
      iso([28, 18, 22], projection),
      iso([72, 25, 38], projection),
      { via: [iso([48, 12, 26], projection)], tone: "mid" }
    )
  );

  return figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label: "Brazos de Gancho de Cobre - ilustracion isometrica",
    body,
    standalone: "dark",
  });
}

/**
 * Render Rare Arms: Pneumatic Piston pressurized launcher arm.
 */
function buildPneumaticPistonArmsSvg() {
  const basePlan = { x: 0, y: 0, w: 102, d: 72, r: 6 };
  const projection = fitProjection(
    [...boxCorners(basePlan, 0, 68)],
    WIDTH,
    HEIGHT,
    { pad: 24, azimuth: 44, elevation: 30 }
  );
  const body = [...buildBasePlinth(basePlan, projection)];

  // Dual pressure tanks on the back.
  body.push(
    solidSvg(cylinder(22, 22, 11, 8, 36, projection), {
      tone: "mid",
      inner: lineSvg(ring(22, 22, 9, 44, projection), { tone: "lo" }),
    })
  );
  body.push(
    solidSvg(cylinder(22, 50, 11, 8, 36, projection), {
      tone: "mid",
      inner: lineSvg(knurl(22, 50, 11, 36, 42, 20, projection), { tone: "lo" }),
    })
  );

  // Main pneumatic barrel housing.
  const housing = { x: 30, y: 20, w: 40, d: 32, r: 4 };
  const ticks = topTicks(34, 66, 4, 4, 22, 42, [2.5, 4.5], projection, "x");
  body.push(
    solidSvg(slabOf(housing, 14, 28, projection, 6, 0.7), {
      tone: "hi",
      inner: lineSvg(ticks.minor, { tone: "lo" })
        + lineSvg(ticks.major, { tone: "hi" }),
    })
  );

  // Extended piston rod and lit pneumatic impact head.
  const rod = { x: 68, y: 31, w: 18, d: 10, r: 2 };
  const hammer = { x: 82, y: 22, w: 12, d: 28, r: 3 };
  body.push(solidSvg(slabOf(rod, 24, 10, projection, 4), { tone: "mid" }));
  body.push(solidSvg(slabOf(hammer, 18, 22, projection, 6, 0.6), { tone: "hi", lit: true }));

  // Manifold air line.
  body.push(
    wireSvg(
      iso([22, 22, 44], projection),
      iso([50, 22, 42], projection),
      { via: [iso([34, 14, 48], projection)], tone: "hi" }
    )
  );

  return figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label: "Brazos Piston Neumatico - ilustracion isometrica",
    body,
    standalone: "dark",
  });
}

/**
 * Render Unique Arms: Tesla Catapult electromagnetic launcher.
 */
function buildTeslaCatapultArmsSvg() {
  const basePlan = { x: 0, y: 0, w: 108, d: 76, r: 7 };
  const projection = fitProjection(
    [...boxCorners(basePlan, 0, 74)],
    WIDTH,
    HEIGHT,
    { pad: 22, azimuth: 46, elevation: 31 }
  );
  const body = [...buildBasePlinth(basePlan, projection)];

  // Twin induction coils along the side rails.
  const coilA = coil(20, 68, [20, 28], 6, 6, "x", projection);
  const coilB = coil(20, 68, [56, 28], 6, 6, "x", projection);

  // Rear transformer tower.
  body.push(solidSvg(cylinder(18, 38, 12, 8, 48, projection), { tone: "mid" }));
  body.push(solidSvg(cylinder(18, 38, 15, 52, 6, projection), { tone: "hi" }));

  // Back coil halves behind rails.
  body.push(lineSvg(coilA.back, { tone: "lo" }));
  body.push(lineSvg(coilB.back, { tone: "lo" }));

  // Twin electromagnetic accelerator rails.
  const railA = { x: 18, y: 16, w: 72, d: 8, r: 2 };
  const railB = { x: 18, y: 52, w: 72, d: 8, r: 2 };
  body.push(solidSvg(slabOf(railA, 24, 8, projection, 4), { tone: "hi" }));
  body.push(solidSvg(slabOf(railB, 24, 8, projection, 4), { tone: "hi" }));

  // Front coil halves over rails.
  body.push(lineSvg(coilA.front, { tone: "hi" }));
  body.push(lineSvg(coilB.front, { tone: "hi" }));

  // Lit grenade catapult cradle centered between rails.
  const cradle = { x: 54, y: 28, w: 28, d: 20, r: 4 };
  body.push(solidSvg(slabOf(cradle, 22, 14, projection, 6, 0.7), { tone: "hi", lit: true }));
  body.push(solidSvg(cylinder(68, 38, 7, 36, 10, projection), { tone: "hi", lit: true }));

  // Discharge arc wire from transformer crown to cradle.
  body.push(
    wireSvg(
      iso([18, 38, 58], projection),
      iso([68, 38, 46], projection),
      { via: [iso([42, 38, 66], projection)], tone: "lit", dashed: true }
    )
  );

  return figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label: "Brazos Catapulta Tesla - ilustracion isometrica",
    body,
    standalone: "dark",
  });
}

/**
 * Render Normal Legs: Basic Peg Struts support assembly.
 */
function buildPegStrutsLegsSvg() {
  const basePlan = { x: 0, y: 0, w: 92, d: 68, r: 6 };
  const projection = fitProjection(
    [...boxCorners(basePlan, 0, 66)],
    WIDTH,
    HEIGHT,
    { pad: 24, azimuth: 44, elevation: 30 }
  );
  const body = [...buildBasePlinth(basePlan, projection)];

  // Twin foot pads on the plinth.
  const footL = { x: 16, y: 22, w: 22, d: 24, r: 4 };
  const footR = { x: 54, y: 22, w: 22, d: 24, r: 4 };
  body.push(solidSvg(slabOf(footL, 8, 8, projection, 6), { tone: "mid" }));
  body.push(solidSvg(slabOf(footR, 8, 8, projection, 6), { tone: "mid" }));

  // Vertical wooden/steel peg struts with collar flanges.
  body.push(solidSvg(cylinder(27, 34, 6, 16, 32, projection), { tone: "hi" }));
  body.push(solidSvg(cylinder(65, 34, 6, 16, 32, projection), { tone: "hi" }));
  body.push(solidSvg(cylinder(27, 34, 9, 28, 5, projection), { tone: "mid", lit: true }));
  body.push(solidSvg(cylinder(65, 34, 9, 28, 5, projection), { tone: "mid", lit: true }));

  // Pelvic yoke connecting both legs.
  const yoke = { x: 18, y: 26, w: 56, d: 16, r: 4 };
  body.push(
    solidSvg(slabOf(yoke, 48, 10, projection, 6, 0.6), {
      tone: "hi",
      inner: lineSvg(lineOnTop([27, 34], [65, 34], 58, projection), { tone: "mid" }),
    })
  );

  return figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label: "Piernas de Puntal Basico - ilustracion isometrica",
    body,
    standalone: "dark",
  });
}

/**
 * Render Rare Legs: Helical Coil Spring mobility legs.
 */
function buildCoilSpringsLegsSvg() {
  const basePlan = { x: 0, y: 0, w: 96, d: 70, r: 6 };
  const projection = fitProjection(
    [...boxCorners(basePlan, 0, 72)],
    WIDTH,
    HEIGHT,
    { pad: 24, azimuth: 45, elevation: 30 }
  );
  const body = [...buildBasePlinth(basePlan, projection)];

  // Wide traction feet.
  const footL = { x: 14, y: 20, w: 26, d: 30, r: 5 };
  const footR = { x: 56, y: 20, w: 26, d: 30, r: 5 };
  body.push(solidSvg(slabOf(footL, 8, 9, projection, 6, 0.5), { tone: "mid" }));
  body.push(solidSvg(slabOf(footR, 8, 9, projection, 6, 0.5), { tone: "mid" }));

  // Guide damper rods and stacked helical ring ribs.
  body.push(solidSvg(cylinder(27, 35, 5, 17, 36, projection), { tone: "mid" }));
  body.push(solidSvg(cylinder(69, 35, 5, 17, 36, projection), { tone: "mid" }));

  for (const z of [22, 28, 34, 40, 46]) {
    body.push(lineSvg(ring(27, 35, 10.5, z, projection), { tone: "hi" }));
    body.push(lineSvg(ring(69, 35, 10.5, z, projection), { tone: "hi" }));
  }

  // Lit spring retainer collars and bridge chassis.
  body.push(solidSvg(cylinder(27, 35, 11, 49, 5, projection), { tone: "hi", lit: true }));
  body.push(solidSvg(cylinder(69, 35, 11, 49, 5, projection), { tone: "hi", lit: true }));
  const bridge = { x: 16, y: 25, w: 64, d: 20, r: 5 };
  body.push(solidSvg(slabOf(bridge, 54, 10, projection, 6, 0.6), { tone: "hi" }));

  return figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label: "Piernas de Resorte Helicoidal - ilustracion isometrica",
    body,
    standalone: "dark",
  });
}

/**
 * Render Unique Legs: Hydraulic Assault Walkers with artillery anchors.
 */
function buildHydraulicWalkersLegsSvg() {
  const basePlan = { x: 0, y: 0, w: 106, d: 74, r: 7 };
  const projection = fitProjection(
    [...boxCorners(basePlan, 0, 76)],
    WIDTH,
    HEIGHT,
    { pad: 22, azimuth: 45, elevation: 31 }
  );
  const body = [...buildBasePlinth(basePlan, projection)];

  // Armored anchor pads with front stabilizer claws.
  const footL = { x: 12, y: 18, w: 30, d: 38, r: 4 };
  const footR = { x: 64, y: 18, w: 30, d: 38, r: 4 };
  body.push(solidSvg(slabOf(footL, 8, 10, projection, 6, 0.6), { tone: "mid" }));
  body.push(solidSvg(slabOf(footR, 8, 10, projection, 6, 0.6), { tone: "mid" }));

  // Lit artillery anchor locks at the toes.
  body.push(solidSvg(slabOf({ x: 18, y: 52, w: 18, d: 8, r: 2 }, 8, 12, projection, 4), { tone: "hi", lit: true }));
  body.push(solidSvg(slabOf({ x: 70, y: 52, w: 18, d: 8, r: 2 }, 8, 12, projection, 4), { tone: "hi", lit: true }));

  // Dual hydraulic actuator columns with knurled valves.
  body.push(
    solidSvg(cylinder(27, 36, 10, 18, 36, projection), {
      tone: "hi",
      inner: lineSvg(knurl(27, 36, 10, 44, 52, 22, projection), { tone: "lo" }),
    })
  );
  body.push(
    solidSvg(cylinder(79, 36, 10, 18, 36, projection), {
      tone: "hi",
      inner: lineSvg(knurl(79, 36, 10, 44, 52, 22, projection), { tone: "lo" }),
    })
  );

  // Heavy hip hydraulic manifold block.
  const hip = { x: 16, y: 24, w: 74, d: 24, r: 5 };
  const ticks = topTicks(24, 82, 5, 4, 26, 66, [2.5, 4.5], projection, "x");
  body.push(
    solidSvg(slabOf(hip, 54, 12, projection, 6, 0.7), {
      tone: "hi",
      inner: lineSvg(ticks.minor, { tone: "lo" })
        + lineSvg(ticks.major, { tone: "hi" }),
    })
  );

  // Cross hydraulic pressure line.
  body.push(
    wireSvg(
      iso([27, 26, 36], projection),
      iso([79, 26, 36], projection),
      { via: [iso([53, 18, 44], projection)], tone: "hi" }
    )
  );

  return figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label: "Piernas Hidraulicas de Asalto - ilustracion isometrica",
    body,
    standalone: "dark",
  });
}

/**
 * Render the official Frank and Bang TCG card back emblem.
 */
function buildCardBackSvg() {
  const plate = { x: 0, y: 0, w: 80, d: 80, r: 10 };
  const projection = fitProjection(
    [...boxCorners(plate, 0, 36)],
    280,
    360,
    { pad: 26, azimuth: 45, elevation: 32 }
  );
  const body = [...buildBasePlinth(plate, projection)];

  // Central Frankenstein voltaic dial crest.
  body.push(solidSvg(cylinder(40, 40, 24, 8, 12, projection), { tone: "mid" }));
  body.push(solidSvg(cylinder(40, 40, 14, 20, 10, projection), { tone: "hi", lit: true }));
  body.push(lineSvg(segment([40, 14, 20], [40, 66, 20], projection), { tone: "mid" }));
  body.push(lineSvg(segment([14, 40, 20], [66, 40, 20], projection), { tone: "mid" }));

  return figureSvg({
    width: 280,
    height: 360,
    label: "Reverso de tarjeta coleccionable Frank and Bang",
    body,
    standalone: "dark",
  });
}

/**
 * Render Normal Head: Stitch Skull with lateral steel neck bolts.
 */
function buildStitchSkullHeadSvg() {
  const basePlan = { x: 0, y: 0, w: 92, d: 72, r: 6 };
  const projection = fitProjection(
    [...boxCorners(basePlan, 0, 72)],
    WIDTH,
    HEIGHT,
    { pad: 24, azimuth: 44, elevation: 30 }
  );
  const body = [...buildBasePlinth(basePlan, projection)];

  // Neck collar and main skull cranium block.
  body.push(solidSvg(cylinder(46, 36, 14, 8, 10, projection), { tone: "mid" }));
  const cranium = { x: 24, y: 18, w: 44, d: 36, r: 7 };
  const stitches = topTicks(30, 62, 6, 2, 24, 58, [2.5, 4], projection, "x");
  body.push(
    solidSvg(slabOf(cranium, 18, 40, projection, 8, 0.8), {
      tone: "hi",
      inner:
        lineSvg(stitches.minor, { tone: "lo" }) +
        lineSvg(stitches.major, { tone: "hi" }) +
        lineSvg(lineOnTop([30, 34], [62, 34], 58, projection), { tone: "mid" }),
    })
  );

  // Twin lateral steel Frankenstein bolts.
  body.push(solidSvg(cylinder(20, 36, 5.5, 28, 12, projection), { tone: "hi", lit: true }));
  body.push(solidSvg(cylinder(72, 36, 5.5, 28, 12, projection), { tone: "hi", lit: true }));

  return figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label: "Craneo Cosido - ilustracion isometrica",
    body,
    standalone: "dark",
  });
}

/**
 * Render Rare Head: Brass Visor with calibrated telescopic optics.
 */
function buildBrassVisorHeadSvg() {
  const basePlan = { x: 0, y: 0, w: 96, d: 74, r: 6 };
  const projection = fitProjection(
    [...boxCorners(basePlan, 0, 74)],
    WIDTH,
    HEIGHT,
    { pad: 24, azimuth: 43, elevation: 30 }
  );
  const body = [...buildBasePlinth(basePlan, projection)];

  // Helmet shell with side dial housing.
  const helm = { x: 22, y: 18, w: 48, d: 38, r: 8 };
  body.push(solidSvg(slabOf(helm, 14, 42, projection, 8, 0.8), { tone: "mid" }));
  body.push(
    solidSvg(cylinder(46, 37, 19, 56, 8, projection), {
      tone: "hi",
      inner: lineSvg(ring(46, 37, 15, 64, projection), { tone: "lo" }),
    })
  );

  // Lit telescopic brass visor bar across front face.
  const visor = { x: 34, y: 50, w: 38, d: 14, r: 4 };
  body.push(solidSvg(slabOf(visor, 30, 14, projection, 6, 0.6), { tone: "hi", lit: true }));
  body.push(solidSvg(cylinder(66, 57, 7, 32, 12, projection), { tone: "hi", lit: true }));

  // Calibrated side antenna wire.
  body.push(
    wireSvg(iso([24, 24, 54], projection), iso([66, 57, 44], projection), {
      via: [iso([44, 16, 62], projection)],
      tone: "hi",
    })
  );

  return figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label: "Visor de Laton - ilustracion isometrica",
    body,
    standalone: "dark",
  });
}

/**
 * Render Unique Head: Voltaic Crown with dual induction spires.
 */
function buildVoltaicCrownHeadSvg() {
  const basePlan = { x: 0, y: 0, w: 100, d: 76, r: 7 };
  const projection = fitProjection(
    [...boxCorners(basePlan, 0, 78)],
    WIDTH,
    HEIGHT,
    { pad: 22, azimuth: 45, elevation: 31 }
  );
  const body = [...buildBasePlinth(basePlan, projection)];

  // Armored head block and crown ring.
  const cranium = { x: 26, y: 20, w: 48, d: 36, r: 7 };
  body.push(solidSvg(slabOf(cranium, 12, 34, projection, 8, 0.7), { tone: "mid" }));
  body.push(solidSvg(cylinder(50, 38, 22, 46, 7, projection), { tone: "hi" }));

  // Twin vertical tesla spires with lit discharge spheres.
  body.push(solidSvg(cylinder(34, 38, 6.5, 53, 18, projection), { tone: "hi" }));
  body.push(solidSvg(cylinder(66, 38, 6.5, 53, 18, projection), { tone: "hi" }));
  body.push(solidSvg(cylinder(34, 38, 8, 68, 6, projection), { tone: "hi", lit: true }));
  body.push(solidSvg(cylinder(66, 38, 8, 68, 6, projection), { tone: "hi", lit: true }));

  // Voltaic arc linking both spires.
  body.push(
    wireSvg(iso([34, 38, 72], projection), iso([66, 38, 72], projection), {
      via: [iso([50, 38, 80], projection)],
      tone: "lit",
      dashed: true,
    })
  );

  return figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label: "Corona Voltaica - ilustracion isometrica",
    body,
    standalone: "dark",
  });
}

/**
 * Render Normal Torso: Canvas Ribcage stitched chest frame.
 */
function buildCanvasRibcageTorsoSvg() {
  const basePlan = { x: 0, y: 0, w: 96, d: 72, r: 6 };
  const projection = fitProjection(
    [...boxCorners(basePlan, 0, 72)],
    WIDTH,
    HEIGHT,
    { pad: 24, azimuth: 45, elevation: 30 }
  );
  const body = [...buildBasePlinth(basePlan, projection)];

  // Spine column and ribbed torso chassis.
  body.push(solidSvg(cylinder(48, 26, 9, 10, 50, projection), { tone: "mid" }));
  const chest = { x: 22, y: 20, w: 52, d: 34, r: 6 };
  const ribLines = topTicks(28, 68, 8, 2, 22, 54, [4, 7], projection, "x");
  body.push(
    solidSvg(slabOf(chest, 16, 38, projection, 8, 0.7), {
      tone: "hi",
      inner:
        lineSvg(ribLines.minor, { tone: "lo" }) +
        lineSvg(ribLines.major, { tone: "hi" }),
    })
  );

  // Lit sternum buckle clasp.
  body.push(
    solidSvg(slabOf({ x: 40, y: 46, w: 16, d: 10, r: 2 }, 26, 14, projection, 4), {
      tone: "hi",
      lit: true,
    })
  );

  return figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label: "Caja Toracica de Lona - ilustracion isometrica",
    body,
    standalone: "dark",
  });
}

/**
 * Render Rare Torso: Boiler Plate riveted iron armor chest.
 */
function buildBoilerPlateTorsoSvg() {
  const basePlan = { x: 0, y: 0, w: 102, d: 74, r: 6 };
  const projection = fitProjection(
    [...boxCorners(basePlan, 0, 74)],
    WIDTH,
    HEIGHT,
    { pad: 24, azimuth: 44, elevation: 30 }
  );
  const body = [...buildBasePlinth(basePlan, projection)];

  // Heavy iron boiler hull with shoulder exhaust stack.
  const hull = { x: 20, y: 18, w: 62, d: 38, r: 7 };
  body.push(
    solidSvg(slabOf(hull, 12, 42, projection, 8, 0.8), {
      tone: "hi",
      inner: lineSvg(sideSeam(hull, 34, projection), { tone: "mid" }),
    })
  );
  body.push(solidSvg(cylinder(30, 24, 7, 54, 14, projection), { tone: "mid" }));

  // Lit furnace pressure gauge on front hatch.
  body.push(solidSvg(cylinder(54, 52, 11, 24, 12, projection), { tone: "hi", lit: true }));
  body.push(lineSvg(ring(54, 52, 8, 36, projection), { tone: "lo" }));

  return figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label: "Coraza de Caldera - ilustracion isometrica",
    body,
    standalone: "dark",
  });
}

/**
 * Render Unique Torso: Reactor Core shielded blast chest.
 */
function buildReactorCoreTorsoSvg() {
  const basePlan = { x: 0, y: 0, w: 106, d: 76, r: 7 };
  const projection = fitProjection(
    [...boxCorners(basePlan, 0, 78)],
    WIDTH,
    HEIGHT,
    { pad: 22, azimuth: 45, elevation: 31 }
  );
  const body = [...buildBasePlinth(basePlan, projection)];

  // Twin armored flank shields.
  const armor = { x: 18, y: 18, w: 70, d: 40, r: 8 };
  const vents = topTicks(24, 82, 6, 3, 20, 56, [3, 5], projection, "x");
  body.push(
    solidSvg(slabOf(armor, 12, 44, projection, 8, 0.8), {
      tone: "mid",
      inner:
        lineSvg(vents.minor, { tone: "lo" }) +
        lineSvg(vents.major, { tone: "hi" }),
    })
  );

  // Central lit reactor chamber and cooling coil ring.
  body.push(solidSvg(cylinder(53, 38, 16, 48, 10, projection), { tone: "hi" }));
  body.push(solidSvg(cylinder(53, 38, 10, 56, 10, projection), { tone: "hi", lit: true }));
  body.push(
    wireSvg(iso([26, 38, 56], projection), iso([80, 38, 56], projection), {
      via: [iso([53, 56, 62], projection)],
      tone: "lit",
    })
  );

  return figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label: "Nucleo Reactor - ilustracion isometrica",
    body,
    standalone: "dark",
  });
}

/**
 * Write one SVG file ensuring parent directories exist.
 */
function writeAsset(relativePath, svgContent) {
  const fullPath = join(OUTPUT_ROOT, relativePath);
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, svgContent, "utf8");
  console.log(`Generated ${relativePath} (${svgContent.length} bytes)`);
}

function main() {
  writeAsset("parts/head/head_stitch_skull.svg", buildStitchSkullHeadSvg());
  writeAsset("parts/head/head_brass_visor.svg", buildBrassVisorHeadSvg());
  writeAsset("parts/head/head_voltaic_crown.svg", buildVoltaicCrownHeadSvg());
  writeAsset("parts/torso/torso_canvas_ribcage.svg", buildCanvasRibcageTorsoSvg());
  writeAsset("parts/torso/torso_boiler_plate.svg", buildBoilerPlateTorsoSvg());
  writeAsset("parts/torso/torso_reactor_core.svg", buildReactorCoreTorsoSvg());
  writeAsset("parts/arms/arms_copper_hook.svg", buildCopperHookArmsSvg());
  writeAsset("parts/arms/arms_pneumatic_piston.svg", buildPneumaticPistonArmsSvg());
  writeAsset("parts/arms/arms_tesla_catapult.svg", buildTeslaCatapultArmsSvg());
  writeAsset("parts/legs/legs_peg_struts.svg", buildPegStrutsLegsSvg());
  writeAsset("parts/legs/legs_coil_springs.svg", buildCoilSpringsLegsSvg());
  writeAsset("parts/legs/legs_hydraulic_walkers.svg", buildHydraulicWalkersLegsSvg());
  writeAsset("cards/card_back.svg", buildCardBackSvg());
}

main();
