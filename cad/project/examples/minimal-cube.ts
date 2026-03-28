import { makeBox } from "replicad";
import type { Shape3D } from "replicad";
import type { ExampleMeta } from "../types";

export const exampleMeta: ExampleMeta = {
  id: "minimal-cube",
  title: "Minimal cube",
  description: "2×2×2 ft box (all CAD lengths in feet) — template for new examples.",
};

export function buildScene(): Shape3D {
  return makeBox([-1, -1, 0], [1, 1, 2]);
}
