import { makeBox } from "replicad";
import type { Shape3D } from "replicad";

/** Corner boxes for the simplified house footprint and roof massing. Coordinates in **feet**. */
export type HouseLayout = {
  bodyMin: [number, number, number];
  bodyMax: [number, number, number];
  roofMin: [number, number, number];
  roofMax: [number, number, number];
};

/** Single-story extension / morning room (axis-aligned massing). */
export type ExtensionLayout = {
  min: [number, number, number];
  max: [number, number, number];
};

/** One-story extension ceiling height (ft), relative to z = 0 at grade. */
export const defaultExtensionHeightFt = 9;

/**
 * Extension bump-out from the main body’s **east face** (`bodyMax[0]`):
 * depth in **+X** = half the main body **X** width; span along **Y** = half the main body **Y** width, centered on the house Y midpoint.
 */
export function extensionLayoutForHouse(house: HouseLayout): ExtensionLayout {
  const [bx0, by0, bz0] = house.bodyMin;
  const [bx1, by1, _bz1] = house.bodyMax;
  const bodyXw = bx1 - bx0;
  const bodyYw = by1 - by0;
  const cy = (by0 + by1) / 2;

  const extDepthX = bodyXw / 2;
  const extSpanY = bodyYw / 2;

  const xMin = bx1;
  const xMax = bx1 + extDepthX;
  const yMin = cy - extSpanY / 2;
  const yMax = cy + extSpanY / 2;

  return {
    min: [xMin, yMin, bz0],
    max: [xMax, yMax, defaultExtensionHeightFt],
  };
}

/** Axis-aligned extension solid; `partial` overrides coordinates relative to `base`. */
export function buildExtensionBox(base: ExtensionLayout, partial: Partial<ExtensionLayout> = {}): Shape3D {
  const min: [number, number, number] = [
    partial.min?.[0] ?? base.min[0],
    partial.min?.[1] ?? base.min[1],
    partial.min?.[2] ?? base.min[2],
  ];
  const max: [number, number, number] = [
    partial.max?.[0] ?? base.max[0],
    partial.max?.[1] ?? base.max[1],
    partial.max?.[2] ?? base.max[2],
  ];
  return makeBox(min, max);
}
