import { makeBox, makeCylinder } from "replicad";
import type { Shape3D } from "replicad";
import { inches } from "../../units";
import { mergeExampleParams } from "../exampleParams";
import type { ExampleMeta, ExampleParamsSchema } from "../types";

export const exampleMeta: ExampleMeta = {
  id: "coaster-with-image",
  title: "Coaster with Image",
  description:
    "Square or round coaster with a centered SVG on the top face, scaled to fit (viewer decal).",
};

/** 0 = square, 1 = round */
export const SHAPE_SQUARE = 0;
export const SHAPE_ROUND = 1;

/** Viewer-side material presets (roughness / metalness + base color before tone). */
export const MAT_CORK = 0;
export const MAT_OAK = 1;
export const MAT_WALNUT = 2;
export const MAT_BAMBOO = 3;
export const MAT_PLASTIC = 4;
export const MAT_SILICONE = 5;
export const MAT_CERAMIC = 6;

/** Color tone applied on top of the material base (multiply / shift in sRGB). */
export const TONE_NATURAL = 0;
export const TONE_DARK = 1;
export const TONE_LIGHT = 2;
export const TONE_WARM = 3;
export const TONE_COOL = 4;

export const exampleParamSchema: ExampleParamsSchema = {
  fields: [
    {
      kind: "choice",
      id: "shapeProfile",
      label: "Shape",
      default: SHAPE_SQUARE,
      options: [
        { value: SHAPE_SQUARE, label: "Square" },
        { value: SHAPE_ROUND, label: "Round" },
      ],
    },
    {
      kind: "choice",
      id: "bodyMaterial",
      label: "Material",
      default: MAT_OAK,
      options: [
        { value: MAT_CORK, label: "Cork" },
        { value: MAT_OAK, label: "Light oak" },
        { value: MAT_WALNUT, label: "Walnut" },
        { value: MAT_BAMBOO, label: "Bamboo" },
        { value: MAT_PLASTIC, label: "Plastic" },
        { value: MAT_SILICONE, label: "Silicone" },
        { value: MAT_CERAMIC, label: "Ceramic" },
      ],
    },
    {
      kind: "choice",
      id: "colorTone",
      label: "Color",
      default: TONE_NATURAL,
      options: [
        { value: TONE_NATURAL, label: "Natural" },
        { value: TONE_DARK, label: "Dark" },
        { value: TONE_LIGHT, label: "Light" },
        { value: TONE_WARM, label: "Warm" },
        { value: TONE_COOL, label: "Cool" },
      ],
    },
    {
      id: "sizeInches",
      label: "Size (in)",
      min: 3,
      max: 6,
      step: 0.25,
      default: 4,
    },
    {
      id: "thicknessInches",
      label: "Thickness (in)",
      min: 0.125,
      max: 0.75,
      step: 0.0625,
      default: 0.25,
    },
    {
      id: "imageScale",
      label: "Image scale",
      min: 0.25,
      max: 2.5,
      step: 0.05,
      default: 1,
    },
  ],
};

export function mergeCoasterParams(overrides?: Record<string, number>): Record<string, number> {
  return mergeExampleParams(exampleParamSchema, overrides);
}

/** Base appearance per material (hex color, roughness, metalness). */
const MATERIAL_BASE: readonly { color: number; roughness: number; metalness: number }[] = [
  { color: 0x9a8b72, roughness: 0.9, metalness: 0 },
  { color: 0xc9a06c, roughness: 0.48, metalness: 0.05 },
  { color: 0x5c4033, roughness: 0.42, metalness: 0.06 },
  { color: 0xd4c48a, roughness: 0.5, metalness: 0.04 },
  { color: 0xe8ecf0, roughness: 0.28, metalness: 0.12 },
  { color: 0x7a8088, roughness: 0.65, metalness: 0.02 },
  { color: 0xece8e4, roughness: 0.35, metalness: 0.04 },
];

/** sRGB multipliers per tone (approximate). */
const TONE_RGB: readonly { r: number; g: number; b: number }[] = [
  { r: 1, g: 1, b: 1 },
  { r: 0.62, g: 0.58, b: 0.54 },
  { r: 1.12, g: 1.1, b: 1.06 },
  { r: 1.06, g: 0.96, b: 0.88 },
  { r: 0.92, g: 0.96, b: 1.06 },
];

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function applyToneRgb(hex: number, tone: number): number {
  const mul = TONE_RGB[tone] ?? TONE_RGB[0];
  const r = ((hex >> 16) & 255) * mul.r;
  const g = ((hex >> 8) & 255) * mul.g;
  const b = (hex & 255) * mul.b;
  return (clampByte(r) << 16) | (clampByte(g) << 8) | clampByte(b);
}

/**
 * Maps coaster parameters to Three.js `MeshStandardMaterial`-style props (viewer only).
 */
export function coasterAppearanceFromParams(merged: Record<string, number>): {
  color: number;
  roughness: number;
  metalness: number;
} {
  const mi = Math.max(0, Math.min(MATERIAL_BASE.length - 1, Math.floor(merged.bodyMaterial)));
  const ti = Math.max(0, Math.min(TONE_RGB.length - 1, Math.floor(merged.colorTone)));
  const base = MATERIAL_BASE[mi];
  return {
    color: applyToneRgb(base.color, ti),
    roughness: base.roughness,
    metalness: base.metalness,
  };
}

export function buildScene(paramValues?: Record<string, number>): Shape3D {
  const m = mergeCoasterParams(paramValues);
  const sizeFt = inches(m.sizeInches);
  const tFt = inches(m.thicknessInches);
  const half = sizeFt / 2;

  if (m.shapeProfile === SHAPE_ROUND) {
    const r = half;
    return makeCylinder(r, tFt, [0, 0, 0], [0, 0, 1]);
  }

  return makeBox([-half, -half, 0], [half, half, tFt]);
}
