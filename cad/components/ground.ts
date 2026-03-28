import { makeBox } from "replicad";
import type { Shape3D } from "replicad";
import { inches } from "../units";

export type GroundParams = {
  /** Half-size of the square footprint in X and Y (feet). */
  halfExtent: number;
  /** Thickness below z = 0 (slab top flush with world origin). */
  thickness: number;
};

/** ~180×180 ft lot; slab ~6 in thick. */
export const defaultGroundParams: GroundParams = {
  halfExtent: 90,
  thickness: inches(6),
};

/**
 * Horizontal ground slab in the XY plane (Z up). Top face at z = 0 so walls sit flush.
 * All edges are axis-aligned — verticals are parallel to Z (perpendicular to the ground).
 */
export function buildGroundPlane(overrides: Partial<GroundParams> = {}): Shape3D {
  const p = { ...defaultGroundParams, ...overrides };
  const h = p.halfExtent;
  const t = p.thickness;
  return makeBox([-h, -h, -t], [h, h, 0]);
}
