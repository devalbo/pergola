import { makeBox } from "replicad";
import type { Shape3D } from "replicad";

export type PergolaParams = {
  centerX: number;
  centerY: number;
  span: number;
  postSize: number;
  height: number;
  rafterCount: number;
  beamThickness: number;
};

export const defaultPergolaParams: PergolaParams = {
  centerX: 5.5,
  centerY: 0,
  span: 3.4,
  postSize: 0.32,
  height: 2.85,
  rafterCount: 5,
  beamThickness: 0.22,
};

/**
 * Four posts, parallel beams, and evenly spaced rafters over the span.
 * Center is the XY center of the post grid; base sits at z = 0.
 */
export function buildPergola(overrides: Partial<PergolaParams> = {}): Shape3D {
  const p = { ...defaultPergolaParams, ...overrides };
  const cx = p.centerX;
  const cy = p.centerY;
  const span = p.span;
  const post = p.postSize;
  const height = p.height;
  const beamT = p.beamThickness;
  const rafterCount = p.rafterCount;
  const half = span / 2;

  const corners: Array<[[number, number, number], [number, number, number]]> = [
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

  const posts = corners.map(([a, b]) => makeBox(a, b));
  let assembly = posts[0].fuse(posts[1]).fuse(posts[2]).fuse(posts[3]);

  const beamW = half * 2 + post + 0.2;
  const z0 = height - beamT;
  const z1 = height + 0.08;

  const beamNorth = makeBox(
    [cx - beamW / 2, cy - half - 0.05, z0],
    [beamW / 2 + cx, cy - half + beamT, z1],
  );
  const beamSouth = makeBox(
    [cx - beamW / 2, cy + half - beamT + 0.05, z0],
    [beamW / 2 + cx, cy + half + 0.05, z1],
  );
  assembly = assembly.fuse(beamNorth).fuse(beamSouth);

  const safeRafters = Math.max(2, Math.round(rafterCount));
  for (let i = 0; i < safeRafters; i++) {
    const t = safeRafters === 1 ? 0.5 : i / (safeRafters - 1);
    const x = cx - half + post * 0.4 + t * (span - post * 0.8);
    const rafter = makeBox([x - 0.06, cy - half - 0.12, z1], [x + 0.06, cy + half + 0.12, z1 + 0.14]);
    assembly = assembly.fuse(rafter);
  }

  return assembly;
}
