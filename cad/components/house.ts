import { sketchRectangle } from "replicad";
import type { Shape3D } from "replicad";
import {
  buildExtensionBox,
  extensionLayoutForHouse,
  type ExtensionLayout,
  type HouseLayout,
} from "./houseLayout";

/**
 * Single source of truth for the simplified house: footprint corner, spans, wall/roof heights.
 * {@link houseParamsToLayout} derives axis-aligned min/max boxes (feet, Z-up).
 */
export type HouseParams = {
  /** Southwest corner of the body footprint at grade (X, Y, Z). */
  bodyOrigin: [number, number, number];
  /** Body depth along +X (ft). */
  bodyDepthX: number;
  /** Body span along Y (ft). */
  bodySpanY: number;
  wallHeightFt: number;
  /** Roof massing extends beyond the wall footprint by this amount on each side (ft). */
  roofOverhangFt: number;
  roofBlockHeightFt: number;
};

/** Default footprint: 70′ Y × 35′ X body, 10′ walls, 0.5′ overhang, 4′ roof block (feet). */
export const defaultHouseParams: HouseParams = {
  bodyOrigin: [-43, -35, 0],
  bodyDepthX: 35,
  bodySpanY: 70,
  wallHeightFt: 10,
  roofOverhangFt: 0.5,
  roofBlockHeightFt: 4,
};

function resolveHouseParams(partial: Partial<HouseParams> = {}): HouseParams {
  return { ...defaultHouseParams, ...partial };
}

/** Derives the same corner representation as {@link HouseLayout} from parametric input. */
export function houseParamsToLayout(partial: Partial<HouseParams> = {}): HouseLayout {
  const p = resolveHouseParams(partial);
  const [ox, oy, oz] = p.bodyOrigin;
  const { bodyDepthX: dx, bodySpanY: dy, wallHeightFt: wh, roofOverhangFt: oh, roofBlockHeightFt: rh } =
    p;

  const bodyMin: [number, number, number] = [ox, oy, oz];
  const bodyMax: [number, number, number] = [ox + dx, oy + dy, oz + wh];
  const roofMin: [number, number, number] = [ox - oh, oy - oh, oz + wh];
  const roofMax: [number, number, number] = [ox + dx + oh, oy + dy + oh, oz + wh + rh];

  return { bodyMin, bodyMax, roofMin, roofMax };
}

export const defaultHouseLayout: HouseLayout = houseParamsToLayout({});

/** Morning-room extension layout from resolved house params (see {@link extensionLayoutForHouse}). */
export function extensionLayoutFromParams(partial: Partial<HouseParams> = {}): ExtensionLayout {
  return extensionLayoutForHouse(houseParamsToLayout(partial));
}

export const defaultHouseExtensionLayout: ExtensionLayout = extensionLayoutFromParams({});

/** Walls: centered XY rectangle at grade, extruded along +Z. */
export function buildHouseBody(partial: Partial<HouseParams> = {}): Shape3D {
  const p = resolveHouseParams(partial);
  const [ox, oy, oz] = p.bodyOrigin;
  const { bodyDepthX: dx, bodySpanY: dy, wallHeightFt: wh } = p;
  const cx = ox + dx / 2;
  const cy = oy + dy / 2;
  return sketchRectangle(dx, dy, { origin: [cx, cy, oz] }).extrude(wh);
}

/** Roof massing: larger XY footprint, extruded from wall plate height. */
export function buildHouseRoof(partial: Partial<HouseParams> = {}): Shape3D {
  const p = resolveHouseParams(partial);
  const [ox, oy, oz] = p.bodyOrigin;
  const { bodyDepthX: dx, bodySpanY: dy, wallHeightFt: wh, roofOverhangFt: oh, roofBlockHeightFt: rh } =
    p;
  const cx = ox + dx / 2;
  const cy = oy + dy / 2;
  const rw = dx + 2 * oh;
  const rd = dy + 2 * oh;
  return sketchRectangle(rw, rd, { origin: [cx, cy, oz + wh] }).extrude(rh);
}

export function buildHouse(partial: Partial<HouseParams> = {}): Shape3D {
  return buildHouseBody(partial).fuse(buildHouseRoof(partial));
}

/** Morning room massing; defaults follow {@link extensionLayoutFromParams} for the given house params. */
export function buildHouseExtension(
  extensionLayout: Partial<ExtensionLayout> = {},
  houseParams: Partial<HouseParams> = {},
): Shape3D {
  return buildExtensionBox(extensionLayoutFromParams(houseParams), extensionLayout);
}

/** Main house (sketch + extrude) fused with the default east extension. */
export function buildHouseWithExtension(
  houseParams: Partial<HouseParams> = {},
  extensionLayout: Partial<ExtensionLayout> = {},
): Shape3D {
  return buildHouse(houseParams).fuse(buildHouseExtension(extensionLayout, houseParams));
}
