import { makeBox } from "replicad";
import type { Shape3D } from "replicad";
import { inches } from "../units";

/** All fields in **feet** (see `cad/units.ts`). */
export type PergolaParams = {
  centerX: number;
  centerY: number;
  /** Outside post grid: 16×16 means span 16 (ft) in plan. */
  span: number;
  postSize: number;
  height: number;
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

/** Defaults: 16×16 ft footprint, 6×6 in posts, ~10 ft tall. */
export const defaultPergolaParams: PergolaParams = {
  centerX: 0,
  centerY: 0,
  span: 16,
  postSize: inches(6),
  height: 10,
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
  const height = p.height;
  const half = span / 2;

  return [
    [
      [cx - half, cy - half, 0],
      [cx - half + post, cy - half + post, height],
    ],
    [
      [cx + half - post, cy - half, 0],
      [cx + half, cy - half + post, height],
    ],
    [
      [cx - half, cy + half - post, 0],
      [cx - half + post, cy + half, height],
    ],
    [
      [cx + half - post, cy + half - post, 0],
      [cx + half, cy + half, height],
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

/** Beams and rafters only (no posts). */
export function buildPergolaCanopy(overrides: Partial<PergolaParams> = {}): Shape3D {
  const p = resolvedParams(overrides);
  const cx = p.centerX;
  const cy = p.centerY;
  const span = p.span;
  const post = p.postSize;
  const height = p.height;
  const beamT = p.beamThickness;
  const rafterCount = p.rafterCount;
  const half = span / 2;

  const beamW = half * 2 + post + inches(2.5);
  const z0 = height - beamT;
  const z1 = height + inches(1);

  const beamNorth = makeBox(
    [cx - beamW / 2, cy - half - inches(0.6), z0],
    [beamW / 2 + cx, cy - half + beamT, z1],
  );
  const beamSouth = makeBox(
    [cx - beamW / 2, cy + half - beamT + inches(0.6), z0],
    [beamW / 2 + cx, cy + half + inches(0.6), z1],
  );
  let assembly = beamNorth.fuse(beamSouth);

  const safeRafters = Math.max(2, Math.round(rafterCount));
  for (let i = 0; i < safeRafters; i++) {
    const t = safeRafters === 1 ? 0.5 : i / (safeRafters - 1);
    const x = cx - half + post * 0.4 + t * (span - post * 0.8);
    const rafter = makeBox(
      [x - inches(1.5), cy - half - inches(1.5), z1],
      [x + inches(1.5), cy + half + inches(1.5), z1 + inches(5.5)],
    );
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
