import type { NamedScenePoint } from "./namedScenePoint";

/**
 * A named axis-aligned bounding box: min/max corners (feet, Z-up).
 * Used as input to derive junction points between adjacent volumes.
 */
export type NamedBox = {
  name: string;
  /** Optional grouping key. Junctions involving only boxes from the same group are suppressed. */
  group?: string;
  min: [number, number, number];
  max: [number, number, number];
};

type Vec3 = [number, number, number];

const COMPASS: Record<string, string> = {
  "1,1": "NE",
  "1,-1": "SE",
  "-1,1": "NW",
  "-1,-1": "SW",
  "1,0": "E",
  "-1,0": "W",
  "0,1": "N",
  "0,-1": "S",
  "0,0": "",
};

/** Tolerance for considering two coordinates equal (feet). */
const EPS = 0.01;

/** True if value is on or within the box range [lo, hi] (within tolerance). */
function inRange(v: number, lo: number, hi: number): boolean {
  return v >= lo - EPS && v <= hi + EPS;
}

/** True if point is on or within the box boundary (within tolerance). */
function pointTouchesBox(pos: Vec3, box: NamedBox): boolean {
  return (
    inRange(pos[0], box.min[0], box.max[0]) &&
    inRange(pos[1], box.min[1], box.max[1]) &&
    inRange(pos[2], box.min[2], box.max[2])
  );
}

/**
 * Two AABBs are face-adjacent if they overlap (positive-width) in at least 2
 * axes and at least touch (within tolerance) in all 3.  Edge-only or
 * corner-only contact does not count.
 */
function boxesShareFace(a: NamedBox, b: NamedBox): boolean {
  let touchCount = 0;
  let overlapCount = 0;
  for (let i = 0; i < 3; i++) {
    const overlap = Math.min(a.max[i], b.max[i]) - Math.max(a.min[i], b.min[i]);
    if (overlap >= -EPS) touchCount++;
    if (overlap > EPS) overlapCount++;
  }
  return touchCount === 3 && overlapCount >= 2;
}

/** Collect all unique values along one axis from all box min/max. */
function uniqueCoords(boxes: NamedBox[], axis: 0 | 1 | 2): number[] {
  const set = new Set<number>();
  for (const b of boxes) {
    set.add(Math.round(b.min[axis] / EPS) * EPS);
    set.add(Math.round(b.max[axis] / EPS) * EPS);
  }
  return [...set].sort((a, b) => a - b);
}

/** Compass label for a point relative to the boxes it touches. */
function compassForPoint(x: number, y: number, boxes: NamedBox[], touching: string[]): string {
  let xSide = 0;
  let ySide = 0;
  for (const box of boxes) {
    if (!touching.includes(box.name)) continue;
    if (Math.abs(x - box.min[0]) < EPS) xSide = Math.min(xSide, -1);
    if (Math.abs(x - box.max[0]) < EPS) xSide = Math.max(xSide, 1);
    if (Math.abs(y - box.min[1]) < EPS) ySide = Math.min(ySide, -1);
    if (Math.abs(y - box.max[1]) < EPS) ySide = Math.max(ySide, 1);
  }
  return COMPASS[`${xSide},${ySide}`] ?? "";
}

function xyKey(x: number, y: number): string {
  return `${Math.round(x / EPS) * EPS},${Math.round(y / EPS) * EPS}`;
}

/**
 * Derive named junction columns where volumes meet.
 *
 * Pre-computes which box pairs are face-adjacent (overlap in 2+ axes, touch
 * in all 3).  Then tests candidate points from the Cartesian product of all
 * min/max coordinates; a point becomes a junction only if the boxes touching
 * it include at least one face-adjacent pair.
 *
 * Edge-only or corner-only contacts are ignored.
 */
export function deriveJunctions(boxes: NamedBox[]): NamedScenePoint[] {
  // Pre-compute face-adjacent pairs (by index).
  const adjacent = new Set<string>();
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      if (boxesShareFace(boxes[i], boxes[j])) {
        adjacent.add(`${i},${j}`);
      }
    }
  }

  const boxIndex = new Map<string, number>();
  for (let i = 0; i < boxes.length; i++) boxIndex.set(boxes[i].name, i);

  const groupOf = new Map<string, string | undefined>();
  for (const box of boxes) groupOf.set(box.name, box.group);

  const xs = uniqueCoords(boxes, 0);
  const ys = uniqueCoords(boxes, 1);
  const zs = uniqueCoords(boxes, 2);

  // Group by XY, collecting box names and Z extent.
  const xyMap = new Map<
    string,
    { x: number; y: number; zMin: number; zMax: number; boxNames: Set<string> }
  >();

  for (const x of xs) {
    for (const y of ys) {
      for (const z of zs) {
        const pos: Vec3 = [x, y, z];
        const touchingIndices: number[] = [];
        for (let i = 0; i < boxes.length; i++) {
          if (pointTouchesBox(pos, boxes[i])) {
            touchingIndices.push(i);
          }
        }

        // Keep only boxes that are face-adjacent to at least one other touching box.
        const relevant = touchingIndices.filter((i) =>
          touchingIndices.some((j) => {
            if (i === j) return false;
            const lo = Math.min(i, j);
            const hi = Math.max(i, j);
            return adjacent.has(`${lo},${hi}`);
          }),
        );
        if (relevant.length < 2) continue;

        const key = xyKey(x, y);
        const existing = xyMap.get(key);
        const names = relevant.map((i) => boxes[i].name);
        if (existing) {
          for (const name of names) existing.boxNames.add(name);
          existing.zMin = Math.min(existing.zMin, z);
          existing.zMax = Math.max(existing.zMax, z);
        } else {
          xyMap.set(key, {
            x,
            y,
            zMin: z,
            zMax: z,
            boxNames: new Set(names),
          });
        }
      }
    }
  }

  const points: NamedScenePoint[] = [];

  for (const entry of xyMap.values()) {
    const names = [...entry.boxNames].sort();

    // Skip junctions where all touching boxes belong to the same group.
    const groups = new Set(names.map((n) => groupOf.get(n)));
    if (groups.size === 1 && !groups.has(undefined)) continue;

    // Collapse same-group boxes into the group name for labels/ids.
    const seen = new Set<string>();
    const displayNames: string[] = [];
    for (const n of names) {
      const g = groupOf.get(n);
      const key = g ?? n;
      if (!seen.has(key)) {
        seen.add(key);
        displayNames.push(g ? g.charAt(0).toUpperCase() + g.slice(1) : n);
      }
    }

    const dir = compassForPoint(entry.x, entry.y, boxes, names);
    const dirStr = dir ? ` ${dir}` : "";

    const label = `${displayNames.join(" · ")} —${dirStr}`;
    const id = [
      "junction",
      ...displayNames.map((n) => n.toLowerCase().replace(/\s+/g, "-")),
      (dir || "center").toLowerCase(),
    ].join("-");

    const z = (entry.zMin + entry.zMax) / 2;
    points.push({
      id,
      label,
      position: [entry.x, entry.y, z],
      zMin: entry.zMin,
      zMax: entry.zMax,
    });
  }

  points.sort((a, b) => a.id.localeCompare(b.id));
  return points;
}
