import type { Shape3D } from "replicad";
import {
  buildGroundPlane,
  buildHouseWithExtension,
  buildPergola,
  defaultExtensionLayout,
} from "../../components";
import type { ExampleMeta } from "../types";

export const exampleMeta: ExampleMeta = {
  id: "patio",
  title: "Patio (house + pergola)",
  description:
    "Ground plane, house with extension, pergola at the extension’s outer corner — all Z-up.",
};

/** Per-part colors (Three.js hex): ground, house, pergola. */
export const scenePartColors = [
  0x3d8c40, // lawn green
  0xffffff, // white siding
  0xa67c52, // wood stain
];

function buildPergolaForPatio(): Shape3D {
  const extMaxX = defaultExtensionLayout.max[0];
  const extMaxY = defaultExtensionLayout.max[1];
  const span = 3.0;
  const half = span / 2;
  const centerX = extMaxX - half;
  const centerY = extMaxY - half;

  return buildPergola({
    centerX,
    centerY,
    span,
    postSize: 0.32,
    height: 2.75,
    rafterCount: 5,
    beamThickness: 0.22,
  });
}

/**
 * Separate solids so the viewer can assign materials (green ground, white house, …).
 */
export function buildSceneParts(): Shape3D[] {
  return [buildGroundPlane(), buildHouseWithExtension(), buildPergolaForPatio()];
}

/**
 * Z-up scene: ground in XY, walls/posts along Z.
 */
export function buildScene(): Shape3D {
  const [g, b, p] = buildSceneParts();
  return g.fuse(b).fuse(p);
}
