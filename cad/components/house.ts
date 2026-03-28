import { makeBox } from "replicad";
import type { Shape3D } from "replicad";
/** Corner points for the simplified house footprint and roof block. Coordinates in **feet**. */
export type HouseLayout = {
  bodyMin: [number, number, number];
  bodyMax: [number, number, number];
  roofMin: [number, number, number];
  roofMax: [number, number, number];
};

/**
 * Default layout: house on the −X side of the yard (feet).
 * Main body **70′ wide (Y) × 35′ deep (X)**; east face at `bodyMax[0]` for the extension; 10′ walls; roof slightly larger / taller.
 */
export const defaultHouseLayout: HouseLayout = {
  bodyMin: [-43, -35, 0],
  bodyMax: [-8, 35, 10],
  roofMin: [-43.5, -35.5, 10],
  roofMax: [-7.5, 35.5, 14],
};

/**
 * Simple house: extruded box body + larger roof massing.
 * Pass partial layout fields to nudge position or size from a scene.
 */
export function buildHouse(layout: Partial<HouseLayout> = {}): Shape3D {
  const L = { ...defaultHouseLayout, ...layout };
  const body = makeBox(L.bodyMin, L.bodyMax);
  const roof = makeBox(L.roofMin, L.roofMax);
  return body.fuse(roof);
}

/** Single-story extension / morning room (flat roof massing), axis-aligned, walls along Z. */
export type ExtensionLayout = {
  min: [number, number, number];
  max: [number, number, number];
};

/** One-story extension ceiling height (ft), relative to z = 0 at grade. */
export const defaultExtensionHeightFt = 9;

/**
 * Extension bump-out from the main body’s **east face** (`bodyMax[0]`):
 * - Depth in **+X** = half the main body **X** width.
 * - Span along **Y** = half the main body **Y** width, centered on the house’s Y midpoint.
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

/** Default extension derived from {@link defaultHouseLayout}. */
export const defaultExtensionLayout: ExtensionLayout =
  extensionLayoutForHouse(defaultHouseLayout);

export function buildExtension(layout: Partial<ExtensionLayout> = {}): Shape3D {
  const min: [number, number, number] = [
    layout.min?.[0] ?? defaultExtensionLayout.min[0],
    layout.min?.[1] ?? defaultExtensionLayout.min[1],
    layout.min?.[2] ?? defaultExtensionLayout.min[2],
  ];
  const max: [number, number, number] = [
    layout.max?.[0] ?? defaultExtensionLayout.max[0],
    layout.max?.[1] ?? defaultExtensionLayout.max[1],
    layout.max?.[2] ?? defaultExtensionLayout.max[2],
  ];
  return makeBox(min, max);
}

/** Main house fused with one-story extension (shared verticals, perpendicular to ground). */
export function buildHouseWithExtension(
  houseLayout: Partial<HouseLayout> = {},
  extensionLayout: Partial<ExtensionLayout> = {},
): Shape3D {
  const house = { ...defaultHouseLayout, ...houseLayout };
  const baseExt = extensionLayoutForHouse(house);
  const ext: ExtensionLayout = {
    min: [
      extensionLayout.min?.[0] ?? baseExt.min[0],
      extensionLayout.min?.[1] ?? baseExt.min[1],
      extensionLayout.min?.[2] ?? baseExt.min[2],
    ],
    max: [
      extensionLayout.max?.[0] ?? baseExt.max[0],
      extensionLayout.max?.[1] ?? baseExt.max[1],
      extensionLayout.max?.[2] ?? baseExt.max[2],
    ],
  };
  return buildHouse(houseLayout).fuse(buildExtension(ext));
}
