import { makeBox } from "replicad";
import type { Shape3D } from "replicad";
import type { ExampleMeta } from "../types";

export const exampleMeta: ExampleMeta = {
  id: "pergola-and-house",
  title: "Pergola beside house",
  description: "Simple house on the left and a pergola assembly on the right.",
};

function house(): Shape3D {
  const body = makeBox([-12, -3.8, 0], [-4.2, 3.8, 4]);
  const roofBlock = makeBox([-12.4, -4.2, 4], [-3.8, 4.2, 5.6]);
  return body.fuse(roofBlock);
}

function pergola(): Shape3D {
  const cx = 5.5;
  const cy = 0;
  const span = 3.4;
  const post = 0.32;
  const height = 2.85;
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

  const beamT = 0.22;
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

  const rafterCount = 5;
  for (let i = 0; i < rafterCount; i++) {
    const t = i / (rafterCount - 1);
    const x = cx - half + post * 0.4 + t * (span - post * 0.8);
    const rafter = makeBox([x - 0.06, cy - half - 0.12, z1], [x + 0.06, cy + half + 0.12, z1 + 0.14]);
    assembly = assembly.fuse(rafter);
  }

  return assembly;
}

export function buildScene(): Shape3D {
  return house().fuse(pergola());
}
