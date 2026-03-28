import type { Shape3D } from "replicad";
import {
  buildExtension,
  buildGroundPlane,
  buildHouse,
  buildPergolaCanopy,
  buildPergolaPosts,
  defaultExtensionLayout,
  defaultHouseLayout,
  defaultPergolaParams,
  extensionLayoutForHouse,
  pergolaCenterFromOuterSwCorner,
  pergolaPostCornerBoxes,
  type PergolaParams,
} from "../../components";
import { deriveJunctions, type NamedBox } from "../../deriveJunctions";
import type { NamedScenePoint } from "../../namedScenePoint";
import type { ExampleMeta } from "../types";

export const exampleMeta: ExampleMeta = {
  id: "patio",
  title: "Patio (house + pergola)",
  description:
    "Feet throughout: ground, house, morning room extension, 16×16 ft pergola at exterior corner (Z-up).",
};

const WOOD = 0xa67c52;

/** Per-part colors (Three.js hex): ground, house, morning room, four legs, canopy. */
export const scenePartColors = [
  0x3d8c40, // lawn green
  0xffffff, // white siding — main body
  0xffffff, // white siding — extension
  WOOD,
  WOOD,
  WOOD,
  WOOD,
  WOOD,
];

/** Hover tooltips (same order as `scenePartColors`). */
export const scenePartNames = [
  "Ground",
  "House",
  "Morning room",
  "Pergola leg 1",
  "Pergola leg 2",
  "Pergola leg 3",
  "Pergola leg 4",
  "Pergola canopy",
];

/**
 * Derive junction points automatically from component bounding boxes.
 * Any corner shared by 2+ boxes becomes a named point with a compass/height label.
 */
export function sceneNamedPoints(): NamedScenePoint[] {
  const house = defaultHouseLayout;
  const ext = extensionLayoutForHouse(house);
  const pp = { ...defaultPergolaParams, ...pergolaParamsForPatio() };
  const postBoxes = pergolaPostCornerBoxes(pp);
  const postNames = ["Pergola leg 1", "Pergola leg 2", "Pergola leg 3", "Pergola leg 4"];

  const boxes: NamedBox[] = [
    { name: "House", min: house.bodyMin, max: house.bodyMax },
    { name: "Roof", min: house.roofMin, max: house.roofMax },
    { name: "Morning room", min: ext.min, max: ext.max },
    ...postBoxes.map(([min, max], i) => ({ name: postNames[i], min, max })),
  ];

  return deriveJunctions(boxes);
}

/**
 * 16×16 ft post grid: **outer SW corner** of the grid meets the morning room’s NW corner
 * (where house east face meets extension north edge) so leg 1 is at the House · Morning room junction.
 */
function pergolaParamsForPatio(): Partial<PergolaParams> {
  const span = 16;
  const extMinX = defaultExtensionLayout.min[0]; // house east face
  const extMaxY = defaultExtensionLayout.max[1]; // extension north edge
  const { centerX, centerY } = pergolaCenterFromOuterSwCorner(extMinX, extMaxY, span);

  return {
    centerX,
    centerY,
    span,
    postSize: 6 / 12,
    height: 10,
    rafterCount: 9,
    beamThickness: 8 / 12,
  };
}

/**
 * Separate solids so the viewer can assign materials and per-leg hover labels.
 */
export function buildSceneParts(): Shape3D[] {
  const pp = pergolaParamsForPatio();
  return [
    buildGroundPlane(),
    buildHouse(),
    buildExtension(),
    ...buildPergolaPosts(pp),
    buildPergolaCanopy(pp),
  ];
}

/**
 * Z-up scene: ground in XY, walls/posts along Z.
 */
export function buildScene(): Shape3D {
  const parts = buildSceneParts();
  return parts.reduce((a, b) => a.fuse(b));
}
