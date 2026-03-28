/**
 * **Plan orientation** for all CAD in this repo (Replicad / Three.js):
 *
 * - **Ground plane** = **XY**, with **Z+ = up** (vertical).
 * - **Horizontal compass** on the ground:
 *   - **+X** = **East**
 *   - **+Y** = **North**
 *   - **−X** = West · **−Y** = South
 *
 * Use this when naming corners (e.g. “northeast”), placing the sun, or describing how structures
 * meet at a seam.
 */
export const SCENE_AXIS_UP = { x: 0, y: 0, z: 1 } as const;

export const EAST = { x: 1, y: 0, z: 0 } as const;
export const NORTH = { x: 0, y: 1, z: 0 } as const;
export const WEST = { x: -1, y: 0, z: 0 } as const;
export const SOUTH = { x: 0, y: -1, z: 0 } as const;

/** Unit vectors as tuples (feet-agnostic), Z-up. */
export const EAST_VEC: [number, number, number] = [1, 0, 0];
export const NORTH_VEC: [number, number, number] = [0, 1, 0];
export const WEST_VEC: [number, number, number] = [-1, 0, 0];
export const SOUTH_VEC: [number, number, number] = [0, -1, 0];
