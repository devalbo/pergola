import {
  CanvasTexture,
  Group,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  NoColorSpace,
  PlaneGeometry,
  Vector3,
  type WebGLRenderer,
} from "three";
import { mergeCoasterParams, SHAPE_ROUND } from "../cad/project/examples/coaster";
import { loadSvgAsContainFitTexture } from "./loadSvgTexture";

const COASTER_EXAMPLE_ID = "coaster-with-image";
const COASTER_SOLID_LABEL = "Coaster with Image";

/** `userData.partLabel` on the decal mesh (remove via {@link removeCoasterDecal}). */
export const COASTER_DECAL_LABEL = "Coaster pattern (SVG)";

const DISK_ALPHA_SIZE = 256;

function makeDiskAlphaTexture(): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = DISK_ALPHA_SIZE;
  canvas.height = DISK_ALPHA_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D context");
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(
    canvas.width / 2,
    canvas.height / 2,
    (canvas.width / 2) * 0.995,
    0,
    Math.PI * 2,
  );
  ctx.fill();

  const tex = new CanvasTexture(canvas);
  tex.colorSpace = NoColorSpace;
  tex.flipY = false;
  tex.needsUpdate = true;
  tex.generateMipmaps = false;
  tex.minFilter = LinearFilter;
  tex.magFilter = LinearFilter;
  return tex;
}

export function removeCoasterDecal(cadRoot: Group): void {
  const toRemove: Mesh[] = [];
  cadRoot.traverse((o) => {
    if (o instanceof Mesh && o.userData.partLabel === COASTER_DECAL_LABEL) toRemove.push(o);
  });
  for (const m of toRemove) {
    m.removeFromParent();
    m.geometry.dispose();
    const mat = m.material as MeshBasicMaterial;
    if (mat.map) mat.map.dispose();
    if (mat.alphaMap) mat.alphaMap.dispose();
    mat.dispose();
  }
}

/**
 * Places an SVG on a plane slightly above the coaster top: centered, uniformly scaled to fit
 * inside the face (contain). Round coasters use a square plane plus a circular alpha map.
 */
export async function attachCoasterDecal(
  cadRoot: Group,
  exampleId: string | undefined,
  svgUrl: string,
  renderer: WebGLRenderer,
  paramValues?: Record<string, number>,
): Promise<void> {
  if (exampleId !== COASTER_EXAMPLE_ID) return;

  const merged = mergeCoasterParams(paramValues);

  let coaster: Mesh | undefined;
  cadRoot.updateMatrixWorld(true);
  cadRoot.traverse((o) => {
    if (o instanceof Mesh && o.userData.partLabel === COASTER_SOLID_LABEL) coaster = o;
  });
  if (!coaster) return;

  const geomSolid = coaster.geometry;
  geomSolid.computeBoundingBox();
  const bb = geomSolid.boundingBox;
  if (!bb) return;

  const size = new Vector3();
  bb.getSize(size);
  const inset = 0.98;
  const planeW = Math.max(size.x * inset, 0.05);
  const planeH = Math.max(size.y * inset, 0.05);

  let tex;
  try {
    tex = await loadSvgAsContainFitTexture(
      svgUrl,
      renderer,
      planeW,
      planeH,
      merged.imageScale,
    );
  } catch (e) {
    console.warn("[coasterDecal] SVG texture failed:", e);
    return;
  }

  const geom = new PlaneGeometry(planeW, planeH);
  const isRound = merged.shapeProfile === SHAPE_ROUND;
  const alphaMap = isRound ? makeDiskAlphaTexture() : undefined;

  const mat = new MeshBasicMaterial({
    map: tex,
    alphaMap,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const decal = new Mesh(geom, mat);
  decal.renderOrder = 1;
  /** Local top-center: follows mesh geometry even if vertices are slightly off-axis in the buffer. */
  const lx = (bb.min.x + bb.max.x) / 2;
  const ly = (bb.min.y + bb.max.y) / 2;
  const lz = bb.max.z + 0.00015;
  decal.position.set(lx, ly, lz);
  decal.userData.excludeFromFit = true;
  decal.userData.partLabel = COASTER_DECAL_LABEL;
  coaster.add(decal);
}
