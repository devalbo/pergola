import { makeBox } from "replicad";
import type { Shape3D } from "replicad";

export type GroundParams = {
  /** Half-size of the square footprint in X and Y (meters). */
  halfExtent: number;
  /** Thickness below z = 0 (slab top flush with world origin). */
  thickness: number;
};

export const defaultGroundParams: GroundParams = {
  halfExtent: 28,
  thickness: 0.14,
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
