import { makeBox } from "replicad";
import type { Shape3D } from "replicad";

/** Corner points for the simplified house footprint and roof block. */
export type HouseLayout = {
  bodyMin: [number, number, number];
  bodyMax: [number, number, number];
  roofMin: [number, number, number];
  roofMax: [number, number, number];
};

/** Default layout: house on the −X side of the yard. */
export const defaultHouseLayout: HouseLayout = {
  bodyMin: [-12, -3.8, 0],
  bodyMax: [-4.2, 3.8, 4],
  roofMin: [-12.4, -4.2, 4],
  roofMax: [-3.8, 4.2, 5.6],
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
