import type { NamedScenePoint } from "./namedScenePoint";

/**
 * A named axis-aligned bounding box: min/max corners (feet, Z-up).
 * Used as input to derive junction points between adjacent volumes.
 */
export type NamedBox = {
  name: string;
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

/** Eight corners of a box with compass metadata. */
function boxCorners(
  box: NamedBox,
): Array<{ pos: Vec3; xSide: -1 | 1; ySide: -1 | 1; boxName: string }> {
  const [x0, y0, z0] = box.min;
  const [x1, y1, z1] = box.max;
  const out: Array<{ pos: Vec3; xSide: -1 | 1; ySide: -1 | 1; boxName: string }> = [];
  for (const [x, xs] of [[x0, -1], [x1, 1]] as const) {
    for (const [y, ys] of [[y0, -1], [y1, 1]] as const) {
      for (const z of [z0, z1]) {
        out.push({ pos: [x, y, z], xSide: xs, ySide: ys, boxName: box.name });
      }
    }
  }
  return out;
}

function compassStr(xSide: -1 | 1, ySide: -1 | 1): string {
  return COMPASS[`${xSide},${ySide}`] ?? "";
}

function xyKey(x: number, y: number): string {
  return `${Math.round(x / EPS) * EPS},${Math.round(y / EPS) * EPS}`;
}

/**
 * Derive named junction columns where volumes meet.
 *
 * Returns one `NamedScenePoint` per unique XY location (the viewer renders
 * these as vertical columns). The label lists all bodies that meet at that
 * location plus the compass direction — e.g. "House · Morning room — NW".
 *
 * Catches corner-to-corner, corner-on-face, and corner-on-edge contacts.
 */
export function deriveJunctions(boxes: NamedBox[]): NamedScenePoint[] {
  const allCorners = boxes.flatMap((box) => boxCorners(box));

  // Group by XY, collecting all box names and compass info
  const xyMap = new Map<
    string,
    { x: number; y: number; zMin: number; zMax: number; boxNames: Set<string>; compass: string }
  >();

  for (const corner of allCorners) {
    const touchedBoxes: string[] = [corner.boxName];
    for (const other of boxes) {
      if (other.name === corner.boxName) continue;
      if (pointTouchesBox(corner.pos, other)) {
        touchedBoxes.push(other.name);
      }
    }
    if (touchedBoxes.length < 2) continue;

    const key = xyKey(corner.pos[0], corner.pos[1]);
    const existing = xyMap.get(key);
    if (existing) {
      for (const name of touchedBoxes) existing.boxNames.add(name);
      existing.zMin = Math.min(existing.zMin, corner.pos[2]);
      existing.zMax = Math.max(existing.zMax, corner.pos[2]);
    } else {
      xyMap.set(key, {
        x: corner.pos[0],
        y: corner.pos[1],
        zMin: corner.pos[2],
        zMax: corner.pos[2],
        boxNames: new Set(touchedBoxes),
        compass: compassStr(corner.xSide, corner.ySide),
      });
    }
  }

  const points: NamedScenePoint[] = [];

  for (const entry of xyMap.values()) {
    const names = [...entry.boxNames].sort();
    const dir = entry.compass;
    const dirStr = dir ? ` ${dir}` : "";

    const label = `${names.join(" · ")} —${dirStr}`;
    const id = [
      "junction",
      ...names.map((n) => n.toLowerCase().replace(/\s+/g, "-")),
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
