import { makeBox } from "replicad";
import type { Shape3D } from "replicad";
import { mergeExampleParams } from "../exampleParams";
import type { ExampleMeta, ExampleParamsSchema } from "../types";

export const exampleMeta: ExampleMeta = {
  id: "minimal-cube",
  title: "Minimal cube",
  description: "Axis-aligned box (all CAD lengths in feet) — template for new examples.",
};

export const exampleParamSchema: ExampleParamsSchema = {
  fields: [
    {
      id: "halfWidth",
      label: "Half-width (ft)",
      min: 0.25,
      max: 8,
      step: 0.25,
      default: 1,
    },
    {
      id: "halfDepth",
      label: "Half-depth (ft)",
      min: 0.25,
      max: 8,
      step: 0.25,
      default: 1,
    },
    {
      id: "heightZ",
      label: "Height (ft)",
      min: 0.25,
      max: 12,
      step: 0.25,
      default: 2,
    },
  ],
};

export function buildScene(paramValues?: Record<string, number>): Shape3D {
  const m = mergeExampleParams(exampleParamSchema, paramValues);
  return makeBox([-m.halfWidth, -m.halfDepth, 0], [m.halfWidth, m.halfDepth, m.heightZ]);
}
