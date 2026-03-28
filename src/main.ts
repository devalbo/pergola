import { wrap } from "comlink";
import {
  AmbientLight,
  Box3,
  BufferGeometry,
  Clock,
  Color,
  DirectionalLight,
  DoubleSide,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  PCFShadowMap,
  PerspectiveCamera,
  Scene,
  Texture,
  Vector3,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { syncFaces, syncLines, syncLinesFromFaces } from "replicad-threejs-helper";
import type { ExampleListItem } from "../cad/project/types";
import type { MeshPayload, MeshResult } from "./worker";
import { createOrientationScene3d, setupOrientationOverlay } from "./compass";
import { createJunctionSystem } from "./junctions";
import { setupPartHoverTooltip } from "./tooltips";
import { createExampleParamPanel } from "./paramPanel";
import { buildExampleToolbar, readExampleFromUrl, setExampleInUrl } from "./toolbar";
import { coasterAppearanceFromParams, mergeCoasterParams } from "../cad/project/examples/coaster";
import { attachCoasterDecal, removeCoasterDecal } from "./coasterDecal";
import tigerSvgUrl from "../cad/images/Ghostscript_Tiger.svg?url";

// ── Worker API ────────────────────────────────────────────────────

type ViewerApi = {
  listExamples: () => Promise<{ examples: ExampleListItem[]; defaultId: string }>;
  createMesh: (exampleId?: string, paramValues?: Record<string, number>) => Promise<MeshResult>;
};

const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
const api = wrap<ViewerApi>(worker);

/** Resolved example id for the last `loadMesh` (worker default when arg omitted). */
let defaultExampleIdCached = "patio";
let currentExampleId = "patio";
/** After a successful mesh build; used to frame the camera only when the example id changes. */
let lastMeshedExampleId: string | null = null;
/** User-chosen SVG for coaster pattern; falls back to bundled tiger when unset. */
let customCoasterSvgObjectUrl: string | null = null;

function coasterSvgUrlForDecal(): string {
  return customCoasterSvgObjectUrl ?? tigerSvgUrl;
}

// ── Scene scaffolding ─────────────────────────────────────────────

const scene = new Scene();
scene.background = new Color(0x87b5d4);

const camera = new PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.08, 500);
camera.up.set(0, 0, 1);
camera.position.set(14, 11, 16);

const renderer = new WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = PCFShadowMap;
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, 1.5);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.update();

const sun = new DirectionalLight(0xfff5e6, 1.35);
sun.position.set(18, 14, 36);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
scene.add(sun);
scene.add(new AmbientLight(0xb4c9e8, 0.45));

// const grid = new GridHelper(56, 56, 0x5a7a8f, 0x3d5566);
// grid.rotation.x = Math.PI / 2;
// grid.position.z = 0.002;
// scene.add(grid);

const cadRoot = new Group();
scene.add(cadRoot);

const clock = new Clock();

// ── Orientation (3D axes + compass) ───────────────────────────────

const orientationScene3d = createOrientationScene3d(clock, camera);
scene.add(orientationScene3d.group);

// ── Junction markers ──────────────────────────────────────────────

const junctions = createJunctionSystem();
scene.add(junctions.root);

// ── Materials ─────────────────────────────────────────────────────

const edgeMaterial = new LineBasicMaterial({ color: 0x1a1a22 });

const defaultMat = new MeshStandardMaterial({
  color: 0xc49a6c,
  roughness: 0.58,
  metalness: 0.06,
  side: DoubleSide,
});

// ── CAD root helpers ──────────────────────────────────────────────

function disposeObject3D(obj: Mesh | LineSegments): void {
  obj.geometry.dispose();
  const m = obj.material;
  const mats = Array.isArray(m) ? m : [m];
  for (const mat of mats) {
    if ("map" in mat && mat.map) (mat.map as Texture).dispose();
    mat.dispose();
  }
}

function clearCadRoot(): void {
  cadRoot.traverse((obj) => {
    if (obj instanceof Mesh || obj instanceof LineSegments) disposeObject3D(obj);
  });
  while (cadRoot.children.length > 0) {
    cadRoot.remove(cadRoot.children[0]);
  }
}

// ── Camera framing ────────────────────────────────────────────────

function frameCameraToStructure(): void {
  const box = new Box3();
  cadRoot.updateMatrixWorld(true);
  cadRoot.traverse((obj) => {
    if (obj instanceof Mesh) {
      if (obj.userData.excludeFromFit) return;
      box.expandByObject(obj, true);
    }
  });
  if (box.isEmpty()) return;

  const center = new Vector3();
  const size = new Vector3();
  box.getCenter(center);
  box.getSize(size);

  const maxDim = Math.max(size.x, size.y, size.z, 1e-6);
  const fovRad = (camera.fov * Math.PI) / 180;
  const dist = (maxDim / (2 * Math.tan(fovRad / 2))) * 1.14;

  const elev = 0.46;
  const azim = 0.58;
  const cosE = Math.cos(elev);
  const sinE = Math.sin(elev);
  const dir = new Vector3(cosE * Math.cos(azim), cosE * Math.sin(azim), sinE).normalize();

  camera.position.copy(center).add(dir.multiplyScalar(dist));

  const targetZ = box.min.z + size.z * 0.12;
  controls.target.set(center.x, center.y, targetZ);
  controls.minDistance = dist * 0.12;
  controls.maxDistance = dist * 12;
  controls.update();

  const near = Math.max(0.05, dist * 0.02);
  const far = Math.max(500, dist * 30);
  camera.near = near;
  camera.far = far;
  camera.updateProjectionMatrix();
}

// ── Mesh loading ──────────────────────────────────────────────────

async function loadMesh(exampleId?: string, paramValues?: Record<string, number>): Promise<void> {
  const id = exampleId ?? defaultExampleIdCached;
  const shouldFrameCamera = lastMeshedExampleId !== id;
  currentExampleId = id;
  const result = await api.createMesh(exampleId, paramValues);
  clearCadRoot();

  if (result.kind === "single") {
    const { faces, edges } = result.payload;
    const geom = new BufferGeometry();
    syncFaces(geom, faces);
    const mesh = new Mesh(geom, defaultMat.clone());
    if (currentExampleId === "coaster") {
      const cm = coasterAppearanceFromParams(mergeCoasterParams(paramValues));
      mesh.material.color.set(cm.color);
      mesh.material.roughness = cm.roughness;
      mesh.material.metalness = cm.metalness;
    } else {
      mesh.material.color.set(0xc49a6c);
    }
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    if (result.partLabel) mesh.userData.partLabel = result.partLabel;
    const lineGeom = new BufferGeometry();
    if (edges) syncLines(lineGeom, edges);
    else syncLinesFromFaces(lineGeom, geom);
    const lines = new LineSegments(lineGeom, edgeMaterial);
    cadRoot.add(mesh, lines);
    junctions.addColumns(result.namedPoints);
    await attachCoasterDecal(
      cadRoot,
      currentExampleId,
      coasterSvgUrlForDecal(),
      renderer,
      paramValues ?? mergeCoasterParams(),
    );
    if (shouldFrameCamera) frameCameraToStructure();
    lastMeshedExampleId = id;
    return;
  }

  result.parts.forEach((payload: MeshPayload, i: number) => {
    const { faces, edges } = payload;
    const geom = new BufferGeometry();
    syncFaces(geom, faces);
    const label = result.partNames?.[i];
    const isWhiteSiding =
      label === "House" ||
      label === "Morning room" ||
      (label === undefined && i === 1);
    const mat = new MeshStandardMaterial({
      color: result.colors[i],
      roughness: isWhiteSiding ? 0.38 : 0.58,
      metalness: isWhiteSiding ? 0 : 0.07,
      side: DoubleSide,
    });
    if (label === "House") {
      mat.polygonOffset = true;
      mat.polygonOffsetFactor = 1;
      mat.polygonOffsetUnits = 1;
    }
    if (label === "Morning room") {
      mat.polygonOffset = true;
      mat.polygonOffsetFactor = 2;
      mat.polygonOffsetUnits = 2;
    }
    const mesh = new Mesh(geom, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.excludeFromFit = i === 0;
    mesh.userData.partLabel =
      result.partNames?.[i] ?? `Part ${i + 1}`;
    cadRoot.add(mesh);

    const lineGeom = new BufferGeometry();
    if (edges) syncLines(lineGeom, edges);
    else syncLinesFromFaces(lineGeom, geom);
    cadRoot.add(new LineSegments(lineGeom, edgeMaterial));
  });

  junctions.addColumns(result.namedPoints);
  await attachCoasterDecal(
    cadRoot,
    currentExampleId,
    coasterSvgUrlForDecal(),
    renderer,
    paramValues ?? mergeCoasterParams(),
  );
  if (shouldFrameCamera) frameCameraToStructure();
  lastMeshedExampleId = id;
}

// ── Animation loop ────────────────────────────────────────────────

let syncOrientationToView: (() => void) | undefined;

function animate(): void {
  requestAnimationFrame(animate);
  controls.update();
  if (orientationScene3d.group.visible) {
    orientationScene3d.updateFrame();
  }
  syncOrientationToView?.();
  renderer.render(scene, camera);
}

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  frameCameraToStructure();
});

// ── Bootstrap ─────────────────────────────────────────────────────

async function bootstrap(): Promise<void> {
  setupPartHoverTooltip(renderer.domElement, camera, () => [cadRoot, junctions.root]);

  const orientationOverlay = setupOrientationOverlay(
    orientationScene3d.group,
    camera,
    controls,
  );
  syncOrientationToView = () => orientationOverlay.syncToView();

  const { examples: list, defaultId } = await api.listExamples();
  if (list.length === 0) {
    throw new Error("No examples found under cad/project/examples/");
  }
  defaultExampleIdCached = defaultId;

  const fromUrl = readExampleFromUrl();
  const initialId =
    fromUrl !== undefined && list.some((e) => e.id === fromUrl) ? fromUrl : defaultId;

  const paramPanel = createExampleParamPanel(
    list,
    (id, values) => {
      loadMesh(id, values).catch((err) => console.error(err));
    },
    {
      onPick: (file) => {
        void handleSvgImport(file);
      },
    },
  );

  async function handleSvgImport(file: File): Promise<void> {
    const ok = file.name.toLowerCase().endsWith(".svg") || file.type.includes("svg");
    if (!ok) {
      console.warn("[svg import] Expected an SVG file.");
      return;
    }
    if (currentExampleId === "coaster") {
      if (customCoasterSvgObjectUrl) URL.revokeObjectURL(customCoasterSvgObjectUrl);
      customCoasterSvgObjectUrl = URL.createObjectURL(file);
      removeCoasterDecal(cadRoot);
      const pv =
        paramPanel.getValuesForExample("coaster") ?? mergeCoasterParams();
      await attachCoasterDecal(cadRoot, "coaster", coasterSvgUrlForDecal(), renderer, pv);
    }
  }
  paramPanel.syncToExample(initialId);
  await loadMesh(initialId, paramPanel.getValuesForExample(initialId));

  const bar = buildExampleToolbar(
    list,
    (id) => {
      paramPanel.syncToExample(id);
      void loadMesh(id, paramPanel.getValuesForExample(id));
    },
    initialId,
    orientationOverlay,
    controls,
    junctions,
  );
  bar.appendChild(paramPanel.paramsButton);

  if (!fromUrl || !list.some((e) => e.id === fromUrl)) {
    setExampleInUrl(initialId);
  }
}

animate();

bootstrap().catch((err) => {
  console.error(err);
  document.body.insertAdjacentHTML(
    "beforeend",
    `<pre style="position:fixed;bottom:0;left:0;background:#300;color:#fcc;padding:8px;max-width:100%;overflow:auto;">${String(err)}</pre>`,
  );
});
