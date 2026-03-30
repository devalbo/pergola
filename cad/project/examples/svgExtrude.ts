import { drawPointsInterpolation } from "replicad";
import type { Shape3D, Sketch } from "replicad";
import octagonSvg from "../../images/octagon.svg?raw";
import pennsylvaniaSvg from "../../images/pennsylvania.svg?raw";
import turtleSvg from "../../images/turtle.svg?raw";
import { getOutlinePointsFromSvgMarkup } from "../../tigerOutlineFromSvg";
import { inches } from "../../units";
import { mergeExampleParams } from "../exampleParams";
import type { BuildSceneOptions, ExampleMeta, ExampleParamsSchema } from "../types";

/** Matches `outlinePreset` choice values. */
export const OUTLINE_OCTAGON = 0;
export const OUTLINE_PENNSYLVANIA = 1;
export const OUTLINE_TURTLE = 2;

const OUTLINE_SVGS: readonly string[] = [octagonSvg, pennsylvaniaSvg, turtleSvg];

export const exampleMeta: ExampleMeta = {
  id: "coaster-shaped",
  title: "Shaped coaster",
  description: "Extrudes a bundled SVG outline — Turtle, Octagon, or Pennsylvania.",
};

export const exampleParamSchema: ExampleParamsSchema = {
  fields: [
    {
      kind: "choice",
      id: "outlinePreset",
      label: "Outline",
      default: OUTLINE_OCTAGON,
      options: [
        { value: OUTLINE_OCTAGON, label: "Octagon" },
        { value: OUTLINE_PENNSYLVANIA, label: "Pennsylvania" },
        { value: OUTLINE_TURTLE, label: "Turtle" },
      ],
    },
    {
      id: "heightInches",
      label: "Extrude height (in)",
      min: 0.05,
      max: 3,
      step: 0.01,
      default: 0.25,
    },
  ],
};

export function mergeSvgExtrudeParams(overrides?: Record<string, number>): Record<string, number> {
  return mergeExampleParams(exampleParamSchema, overrides);
}

const LOG = "[cad:svg-extrude]";

export function buildScene(paramValues?: Record<string, number>, _options?: BuildSceneOptions): Shape3D {
  const m = mergeSvgExtrudeParams(paramValues);
  const heightFt = inches(m.heightInches);
  const raw = Math.round(m.outlinePreset);
  const idx = raw === OUTLINE_PENNSYLVANIA ? OUTLINE_PENNSYLVANIA : raw === OUTLINE_OCTAGON ? OUTLINE_OCTAGON : OUTLINE_TURTLE;
  const outlineName = idx === OUTLINE_PENNSYLVANIA ? "pennsylvania" : idx === OUTLINE_OCTAGON ? "octagon" : "turtle";
  console.log(LOG, "buildScene start", { outlineName, heightInches: m.heightInches });

  const svg = OUTLINE_SVGS[idx];
  let t = performance.now();
  const pts = getOutlinePointsFromSvgMarkup(svg, 420);
  console.log(LOG, "getOutlinePointsFromSvgMarkup", outlineName, pts.length, "pts", (performance.now() - t).toFixed(1), "ms");

  t = performance.now();
  // Piecewise-linear BSpline (deg 1): complex SVG outlines often make
  // Geom2dAPI_PointsToBSpline fail with the default cubic fit ("B-spline approximation failed").
  const drawing = drawPointsInterpolation(
    pts,
    { degMax: 1, degMin: 1, tolerance: 1e-3 },
    { closeShape: true },
  );
  console.log(LOG, "drawPointsInterpolation", (performance.now() - t).toFixed(1), "ms");

  t = performance.now();
  const sk = drawing.sketchOnPlane("XY") as Sketch;
  console.log(LOG, "sketchOnPlane", (performance.now() - t).toFixed(1), "ms");

  t = performance.now();
  const solid = sk.extrude(heightFt);
  console.log(LOG, "extrude", (performance.now() - t).toFixed(1), "ms");
  return solid;
}
