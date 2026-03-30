import { svgPathProperties } from "svg-path-properties";
import type { Point2D } from "replicad";

/** When present in imported SVG (e.g. Ghostscript Tiger), prefer this path id over “longest path”. */
const PREFERRED_OUTLINE_PATH_ID = "path56";

/** After normalization, max(width, height) of the outline in feet. */
const TARGET_FOOTPRINT_FT = 1;

/**
 * Picks a single path `d` string from SVG markup: use {@link PREFERRED_OUTLINE_PATH_ID} if present,
 * otherwise the `<path>` with the longest geometric length (best-effort “main” outline).
 */
export function extractOutlinePathD(svgMarkup: string): string {
  // Attributes can be in any order; a greedy [^>]* between id= and d= can swallow `d="..."`.
  const idNeedle = `id="${PREFERRED_OUTLINE_PATH_ID}"`;
  const idIdx = svgMarkup.indexOf(idNeedle);
  if (idIdx !== -1) {
    const tagStart = svgMarkup.lastIndexOf("<path", idIdx);
    if (tagStart !== -1 && tagStart < idIdx) {
      const tagEnd = svgMarkup.indexOf(">", idIdx);
      if (tagEnd !== -1) {
        const openTag = svgMarkup.slice(tagStart, tagEnd + 1);
        const dm = openTag.match(/\bd="([^"]+)"/);
        if (dm?.[1]) return dm[1];
      }
    }
  }

  const ds: string[] = [];
  const re = /<path\b[^>]*\sd="([^"]+)"/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(svgMarkup)) !== null) {
    ds.push(m[1]);
  }
  if (ds.length === 0) {
    throw new Error("SVG has no <path d=\"...\"> elements to extrude");
  }

  let best = ds[0];
  let bestLen = -1;
  for (const d of ds) {
    try {
      const len = new svgPathProperties(d).getTotalLength();
      if (len > bestLen) {
        bestLen = len;
        best = d;
      }
    } catch {
      /* ignore invalid paths */
    }
  }
  if (bestLen <= 0) {
    throw new Error("Could not measure any path in the SVG");
  }
  return best;
}

/**
 * Samples a closed path, centers it on the origin in XY, scales so the longer axis spans
 * {@link TARGET_FOOTPRINT_FT} feet, and flips Y (SVG screen Y → CAD).
 */
export function getOutlinePointsFromPathD(pathD: string, sampleCount = 420): Point2D[] {
  const path = new svgPathProperties(pathD);
  const total = path.getTotalLength();
  if (!(total > 0)) {
    throw new Error("Outline path has zero length");
  }

  const raw: Point2D[] = [];
  const n = Math.max(32, Math.floor(sampleCount));
  for (let i = 0; i < n; i++) {
    const pt = path.getPointAtLength((total * i) / n);
    raw.push([pt.x, pt.y]);
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of raw) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const w = Math.max(maxX - minX, 1e-12);
  const h = Math.max(maxY - minY, 1e-12);
  const scale = TARGET_FOOTPRINT_FT / Math.max(w, h);

  return raw.map(([x, y]) => [(x - cx) * scale, -(y - cy) * scale]);
}

/** @param svgMarkup Full SVG document string */
export function getOutlinePointsFromSvgMarkup(svgMarkup: string, sampleCount = 420): Point2D[] {
  const d = extractOutlinePathD(svgMarkup);
  return getOutlinePointsFromPathD(d, sampleCount);
}
