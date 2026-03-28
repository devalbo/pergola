import type { Shape3D } from "replicad";
import {
  buildGroundPlane,
  buildHouseBody,
  buildHouseExtension,
  buildHouseRoof,
  buildPergolaCanopy,
  buildPergolaPosts,
  defaultPergolaParams,
  extensionLayoutFromParams,
  houseParamsToLayout,
  pergolaCenterFromOuterSwCorner,
  pergolaPostCornerBoxes,
  type HouseParams,
  type PergolaParams,
} from "../../components";
import { deriveJunctions, type NamedBox } from "../../deriveJunctions";
import type { NamedScenePoint } from "../../namedScenePoint";
import { mergeExampleParams } from "../exampleParams";
import type { ExampleMeta, ExampleParamsSchema } from "../types";

export const exampleMeta: ExampleMeta = {
  id: "patio",
  title: "Patio (house + pergola)",
  description:
    "Ground, parametric house (sketch + extrude), morning room, pergola at exterior corner (feet, Z-up).",
};

/** Declares the interactive form for this example (feet). */
export const exampleParamSchema: ExampleParamsSchema = {
  fields: [
    {
      id: "pergolaHeightFt",
      label: "Pergola height (ft)",
      min: 6,
      max: 18,
      step: 0.5,
      default: 10,
    },
    {
      id: "eaveAbovePergolaFt",
      label: "Eave clearance above pergola (ft)",
      min: 0,
      max: 10,
      step: 0.25,
      default: 2,
    },
    {
      id: "pergolaSpanFt",
      label: "Pergola post grid span (ft)",
      min: 8,
      max: 28,
      step: 0.5,
      default: 16,
    },
    {
      id: "roofBlockHeightFt",
      label: "Roof block height (ft)",
      min: 2,
      max: 10,
      step: 0.5,
      default: 4,
    },
  ],
};

const WOOD = 0xa67c52;

function mergeParams(overrides?: Record<string, number>): Record<string, number> {
  return mergeExampleParams(exampleParamSchema, overrides);
}

function houseParamsFromMerged(merged: Record<string, number>): Partial<HouseParams> {
  return {
    wallHeightFt: merged.pergolaHeightFt + merged.eaveAbovePergolaFt,
    roofBlockHeightFt: merged.roofBlockHeightFt,
  };
}

function pergolaParamsForPatio(merged: Record<string, number>): Partial<PergolaParams> {
  const hp = houseParamsFromMerged(merged);
  const ext = extensionLayoutFromParams(hp);
  const span = merged.pergolaSpanFt;
  const extMinX = ext.min[0];
  const extMaxY = ext.max[1];
  const { centerX, centerY } = pergolaCenterFromOuterSwCorner(extMinX, extMaxY, span);

  return {
    centerX,
    centerY,
    span,
    postSize: 6 / 12,
    height: merged.pergolaHeightFt,
    heightFar: 8,
    rafterCount: 9,
    beamThickness: 8 / 12,
  };
}

export const scenePartColors = [
  0x3d8c40,
  0xffffff,
  0x9e9e9e,
  0xffffff,
  WOOD,
  WOOD,
  WOOD,
  WOOD,
  WOOD,
];

export const scenePartNames = [
  "Ground",
  "House body",
  "House roof",
  "House morning room",
  "Pergola leg 1",
  "Pergola leg 2",
  "Pergola leg 3",
  "Pergola leg 4",
  "Pergola canopy",
];

export function sceneNamedPoints(paramValues?: Record<string, number>): NamedScenePoint[] {
  const merged = mergeParams(paramValues);
  const hp = houseParamsFromMerged(merged);
  const house = houseParamsToLayout(hp);
  const ext = extensionLayoutFromParams(hp);
  const pp = { ...defaultPergolaParams, ...pergolaParamsForPatio(merged) };
  const postBoxes = pergolaPostCornerBoxes(pp);
  const postNames = ["Pergola leg 1", "Pergola leg 2", "Pergola leg 3", "Pergola leg 4"];

  const boxes: NamedBox[] = [
    { name: "House body", group: "house", min: house.bodyMin, max: house.bodyMax },
    { name: "House roof", group: "house", min: house.roofMin, max: house.roofMax },
    { name: "House morning room", group: "house", min: ext.min, max: ext.max },
    ...postBoxes.map(([min, max], i) => ({ name: postNames[i], min, max })),
  ];

  return deriveJunctions(boxes);
}

export function buildSceneParts(paramValues?: Record<string, number>): Shape3D[] {
  const merged = mergeParams(paramValues);
  const hp = houseParamsFromMerged(merged);
  const pp = { ...defaultPergolaParams, ...pergolaParamsForPatio(merged) };
  return [
    buildGroundPlane(),
    buildHouseBody(hp),
    buildHouseRoof(hp),
    buildHouseExtension({}, hp),
    ...buildPergolaPosts(pp),
    buildPergolaCanopy(pp),
  ];
}

export function buildScene(paramValues?: Record<string, number>): Shape3D {
  return buildSceneParts(paramValues).reduce((a, b) => a.fuse(b));
}
