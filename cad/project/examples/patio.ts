import type { Shape3D } from "replicad";
import { buildHouse, buildPergola } from "../../components";
import type { ExampleMeta } from "../types";

export const exampleMeta: ExampleMeta = {
  id: "patio",
  title: "Patio (house + pergola)",
  description: "Assembles reusable house and pergola components into one scene.",
};

/**
 * Outdoor scene: house and pergola side by side.
 * Adjust layout here (e.g. nudge `buildHouse({ bodyMin: [...] })`) or change defaults in `cad/components/`.
 */
export function buildScene(): Shape3D {
  return buildHouse().fuse(buildPergola());
}
