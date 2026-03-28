import { makeBox, Sketcher } from "replicad";
import type { Shape3D } from "replicad";
import { inches } from "../units";

/** All fields in **feet** (see `cad/units.ts`). */
export type PergolaParams = {
  centerX: number;
  centerY: number;
  /** Outside post grid: 16×16 means span 16 (ft) in plan. */
  span: number;
  postSize: number;
  /** Post height at the near (min-X) edge. */
  height: number;
  /** Post height at the far (max-X) edge. When less than `height`, the canopy slopes down away from the building. Defaults to `height` (flat). */
  heightFar: number;
  rafterCount: number;
  beamThickness: number;
};

/**
 * Center `(cx, cy)` for a pergola whose **outer SW corner** of the post grid (min X, min Y of the outer rectangle) sits at `(cornerX, cornerY)` — e.g. the building’s exterior corner so the footprint extends into the yard (+X/+Y), not over the slab.
 */
export function pergolaCenterFromOuterSwCorner(
  cornerX: number,
  cornerY: number,
  span: number,
): { centerX: number; centerY: number } {
  const half = span / 2;
  return { centerX: cornerX + half, centerY: cornerY + half };
}

/** Defaults: 16×16 ft footprint, 6×6 in posts, ~10 ft tall, flat canopy. */
export const defaultPergolaParams: PergolaParams = {
  centerX: 0,
  centerY: 0,
  span: 16,
  postSize: inches(6),
  height: 10,
  heightFar: 10,
  rafterCount: 9,
  beamThickness: inches(8),
};

function resolvedParams(overrides: Partial<PergolaParams>): PergolaParams {
  return { ...defaultPergolaParams, ...overrides };
}

/**
 * Corner post boxes in order **0–3** (array / API): SW, SE, NW, NE (plan view; see `cad/sceneOrientation.ts`: +X East, +Y North).
 * **Display names** for legs should be **1–4** (leg 1 = index 0, etc.).
 */
export function pergolaPostCornerBoxes(
  p: PergolaParams,
): Array<[[number, number, number], [number, number, number]]> {
  const cx = p.centerX;
  const cy = p.centerY;
  const span = p.span;
  const post = p.postSize;
  const hNear = p.height;
  const hFar = p.heightFar;
  const half = span / 2;

  return [
    // SW — near (min-X)
    [
      [cx - half, cy - half, 0],
      [cx - half + post, cy - half + post, hNear],
    ],
    // SE — far (max-X)
    [
      [cx + half - post, cy - half, 0],
      [cx + half, cy - half + post, hFar],
    ],
    // NW — near (min-X)
    [
      [cx - half, cy + half - post, 0],
      [cx - half + post, cy + half, hNear],
    ],
    // NE — far (max-X)
    [
      [cx + half - post, cy + half - post, 0],
      [cx + half, cy + half, hFar],
    ],
  ];
}

/** One post solid; `index` 0..3 matches {@link pergolaPostCornerBoxes} (label that as leg 1..4 in UI). */
export function buildPergolaPost(
  overrides: Partial<PergolaParams>,
  index: 0 | 1 | 2 | 3,
): Shape3D {
  const p = resolvedParams(overrides);
  const [a, b] = pergolaPostCornerBoxes(p)[index];
  return makeBox(a, b);
}

/** Four separate post solids (for per-mesh labels / picking). */
export function buildPergolaPosts(overrides: Partial<PergolaParams> = {}): Shape3D[] {
  const p = resolvedParams(overrides);
  return pergolaPostCornerBoxes(p).map(([a, b]) => makeBox(a, b));
}

/**
 * Beams and rafters only (no posts).
 *
 * Structure (matches real sloped pergola):
 * - **Two beams** run N-S (along Y), one at each X edge of the post grid.
 *   The near beam (min-X, house side) sits at `height`; the far beam (max-X) at `heightFar`.
 *   Each beam is a flat box — no slope needed since it runs perpendicular to the slope direction.
 * - **Rafters** run E-W (along X), evenly spaced along Y, sitting on top of the beams.
 *   Each rafter is a flat box positioned at its interpolated slope height.
 */
export function buildPergolaCanopy(overrides: Partial<PergolaParams> = {}): Shape3D {
  const p = resolvedParams(overrides);
  const cx = p.centerX;
  const cy = p.centerY;
  const span = p.span;
  const post = p.postSize;
  const hNear = p.height;
  const hFar = p.heightFar;
  const beamT = p.beamThickness;
  const rafterCount = p.rafterCount;
  const half = span / 2;

  // ── Beams (run N-S along Y, one at each X edge) ──
  // Beams are perpendicular to slope direction, so flat boxes are correct.
  const beamLen = span + post + inches(2.5); // Y extent (overhang past posts)
  // Near beam (min-X, house side) — top at hNear
  const beamNear = makeBox(
    [cx - half - inches(0.6), cy - beamLen / 2, hNear - beamT],
    [cx - half + beamT, cy + beamLen / 2, hNear + inches(1)],
  );
  // Far beam (max-X, yard side) — top at hFar
  const beamFar = makeBox(
    [cx + half - beamT + inches(0.6), cy - beamLen / 2, hFar - beamT],
    [cx + half + inches(0.6), cy + beamLen / 2, hFar + inches(1)],
  );
  let assembly = beamNear.fuse(beamFar);

  // ── Rafters (run E-W along X, spaced along Y) ──
  // Each rafter is a sloped solid: parallelogram profile in XZ, extruded along Y.
  const rafterDepth = inches(3);     // Y extent
  const rafterHeight = inches(5.5);  // Z cross-section height
  const rafterOverhang = inches(1.5);
  const safeRafters = Math.max(2, Math.round(rafterCount));

  const xStart = cx - half - rafterOverhang;
  const xEnd = cx + half + rafterOverhang;
  // Z at near (min-X) and far (max-X) ends — rafters sit on top of beams
  const zNear = hNear + inches(1);
  const zFar = hFar + inches(1);

  for (let i = 0; i < safeRafters; i++) {
    const tY = safeRafters === 1 ? 0.5 : i / (safeRafters - 1);
    const y = cy - half + post * 0.4 + tY * (span - post * 0.8);

    // Parallelogram in XZ plane: sloped bottom and top edges, extruded along Y.
    // "XZ" plane has normal=[0,-1,0], so origin offset is along -Y and extrude goes -Y.
    // Negate the Y offset so the plane lands at the correct world-Y, and extrude negatively to go +Y.
    const rafter = new Sketcher("XZ", -(y + rafterDepth / 2))
      .movePointerTo([xStart, zNear])
      .lineTo([xEnd, zFar])
      .lineTo([xEnd, zFar + rafterHeight])
      .lineTo([xStart, zNear + rafterHeight])
      .close()
      .extrude(-rafterDepth) as Shape3D;

    assembly = assembly.fuse(rafter);
  }

  return assembly;
}

/**
 * Four posts, parallel beams, and evenly spaced rafters over the span.
 * Center is the XY center of the post grid; base sits at z = 0 (grade).
 */
export function buildPergola(overrides: Partial<PergolaParams> = {}): Shape3D {
  const posts = buildPergolaPosts(overrides);
  const canopy = buildPergolaCanopy(overrides);
  return posts[0].fuse(posts[1]).fuse(posts[2]).fuse(posts[3]).fuse(canopy);
}
