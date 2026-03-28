import { wrap } from "comlink";
import {
  AmbientLight,
  Box3,
  BufferGeometry,
  Color,
  DirectionalLight,
  DoubleSide,
  GridHelper,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  PCFShadowMap,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { syncFaces, syncLines, syncLinesFromFaces } from "replicad-threejs-helper";
import type { ExampleMeta } from "../cad/project/types";
import type { MeshPayload, MeshResult } from "./worker";

type ViewerApi = {
  listExamples: () => Promise<{ examples: ExampleMeta[]; defaultId: string }>;
  createMesh: (exampleId?: string) => Promise<MeshResult>;
};

const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
const api = wrap<ViewerApi>(worker);

const scene = new Scene();
scene.background = new Color(0x87b5d4);

const camera = new PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.08, 500);
camera.position.set(14, 11, 16);

const renderer = new WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = PCFShadowMap;
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1.5, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.update();

const sun = new DirectionalLight(0xfff5e6, 1.35);
sun.position.set(20, 28, 14);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
scene.add(sun);
scene.add(new AmbientLight(0xb4c9e8, 0.45));

const grid = new GridHelper(40, 40, 0x5a7a8f, 0x3d5566);
grid.position.y = -0.001;
scene.add(grid);

const cadRoot = new Group();
scene.add(cadRoot);

const edgeMaterial = new LineBasicMaterial({ color: 0x1a1a22 });

const defaultMat = new MeshStandardMaterial({
  color: 0xc49a6c,
  roughness: 0.58,
  metalness: 0.06,
  side: DoubleSide,
});

function disposeObject3D(obj: Mesh | LineSegments): void {
  obj.geometry.dispose();
  const m = obj.material;
  if (Array.isArray(m)) m.forEach((x) => x.dispose());
  else m.dispose();
}

function clearCadRoot(): void {
  while (cadRoot.children.length > 0) {
    const ch = cadRoot.children[0];
    if (ch instanceof Mesh || ch instanceof LineSegments) disposeObject3D(ch);
    cadRoot.remove(ch);
  }
}

/**
 * Frame house + pergola (exclude huge ground mesh from bbox). Orbit target biased toward the
 * footprint so the lawn reads toward the bottom of the viewport.
 */
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
  // Distance so the structure fills most of the vertical FOV (tight margin to “edges”)
  const dist = (maxDim / (2 * Math.tan(fovRad / 2))) * 1.14;

  // Elevation & azimuth: look from front-right and above; ground plane (z≈0) trends to bottom of screen
  const elev = 0.46;
  const azim = 0.58;
  const cosE = Math.cos(elev);
  const sinE = Math.sin(elev);
  const dir = new Vector3(cosE * Math.cos(azim), cosE * Math.sin(azim), sinE).normalize();

  camera.position.copy(center).add(dir.multiplyScalar(dist));

  // Target slightly below structural center → more sky above, more ground below
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

function readExampleFromUrl(): string | undefined {
  return new URLSearchParams(window.location.search).get("example") ?? undefined;
}

function setExampleInUrl(id: string): void {
  const url = new URL(window.location.href);
  url.searchParams.set("example", id);
  window.history.replaceState({}, "", url.toString());
}

function buildExampleToolbar(
  items: ExampleMeta[],
  onSelect: (id: string) => void,
  initialId: string,
): void {
  const bar = document.createElement("div");
  bar.style.cssText = [
    "position:fixed",
    "top:12px",
    "left:12px",
    "z-index:10",
    "display:flex",
    "align-items:center",
    "gap:8px",
    "padding:8px 12px",
    "background:rgba(15,20,28,0.85)",
    "color:#e8eef5",
    "font:14px/1.3 system-ui,sans-serif",
    "border-radius:8px",
    "box-shadow:0 4px 16px rgba(0,0,0,.25)",
  ].join(";");

  const label = document.createElement("label");
  label.textContent = "Example";
  label.setAttribute("for", "example-select");
  label.style.opacity = "0.85";

  const select = document.createElement("select");
  select.id = "example-select";
  select.style.cssText = "min-width:220px;padding:6px 8px;border-radius:6px;border:1px solid #394556;background:#1a222c;color:inherit";

  for (const item of items) {
    const opt = document.createElement("option");
    opt.value = item.id;
    opt.textContent = item.title;
    if (item.description) opt.title = item.description;
    select.appendChild(opt);
  }

  select.value = items.some((i) => i.id === initialId) ? initialId : items[0]?.id ?? "";
  select.addEventListener("change", () => {
    const id = select.value;
    setExampleInUrl(id);
    void onSelect(id);
  });

  bar.append(label, select);
  document.body.appendChild(bar);
}

async function loadMesh(exampleId?: string): Promise<void> {
  const result = await api.createMesh(exampleId);
  clearCadRoot();

  if (result.kind === "single") {
    const { faces, edges } = result.payload;
    const geom = new BufferGeometry();
    syncFaces(geom, faces);
    const mesh = new Mesh(geom, defaultMat.clone());
    mesh.material.color.set(0xc49a6c);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const lineGeom = new BufferGeometry();
    if (edges) syncLines(lineGeom, edges);
    else syncLinesFromFaces(lineGeom, geom);
    const lines = new LineSegments(lineGeom, edgeMaterial);
    cadRoot.add(mesh, lines);
    frameCameraToStructure();
    return;
  }

  result.parts.forEach((payload: MeshPayload, i: number) => {
    const { faces, edges } = payload;
    const geom = new BufferGeometry();
    syncFaces(geom, faces);
    const mat = new MeshStandardMaterial({
      color: result.colors[i],
      roughness: i === 1 ? 0.38 : 0.58,
      metalness: i === 1 ? 0 : 0.07,
      side: DoubleSide,
    });
    const mesh = new Mesh(geom, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.excludeFromFit = i === 0;
    cadRoot.add(mesh);

    const lineGeom = new BufferGeometry();
    if (edges) syncLines(lineGeom, edges);
    else syncLinesFromFaces(lineGeom, geom);
    cadRoot.add(new LineSegments(lineGeom, edgeMaterial));
  });

  frameCameraToStructure();
}

function animate(): void {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  frameCameraToStructure();
});

async function bootstrap(): Promise<void> {
  const { examples: list, defaultId } = await api.listExamples();
  if (list.length === 0) {
    throw new Error("No examples found under cad/project/examples/");
  }

  const fromUrl = readExampleFromUrl();
  const initialId =
    fromUrl !== undefined && list.some((e) => e.id === fromUrl) ? fromUrl : defaultId;

  await loadMesh(initialId);

  buildExampleToolbar(list, (id) => {
    loadMesh(id).catch((err) => console.error(err));
  }, initialId);

  if (!fromUrl || !list.some((e) => e.id === fromUrl)) {
    setExampleInUrl(initialId);
  }
}

bootstrap().catch((err) => {
  console.error(err);
  document.body.insertAdjacentHTML(
    "beforeend",
    `<pre style="position:fixed;bottom:0;left:0;background:#300;color:#fcc;padding:8px;max-width:100%;overflow:auto;">${String(err)}</pre>`,
  );
});
animate();
