import { wrap } from "comlink";
import {
  AmbientLight,
  BufferGeometry,
  Color,
  DirectionalLight,
  DoubleSide,
  GridHelper,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  PCFSoftShadowMap,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { syncFaces, syncLines, syncLinesFromFaces } from "replicad-threejs-helper";
import type { ExampleMeta } from "../project/types";
import type { MeshPayload } from "./worker";

type ViewerApi = {
  listExamples: () => ExampleMeta[];
  createMesh: (exampleId?: string) => Promise<MeshPayload>;
};

const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
const api = wrap<ViewerApi>(worker);

const scene = new Scene();
scene.background = new Color(0x87b5d4);

const camera = new PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(14, 11, 16);

const renderer = new WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1.5, 0);
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

const bodyGeometry = new BufferGeometry();
const edgeMaterial = new LineBasicMaterial({ color: 0x1a1a22 });
const lineGeometry = new BufferGeometry();
const lines = new LineSegments(lineGeometry, edgeMaterial);

const bodyMaterial = new MeshStandardMaterial({
  color: 0xc49a6c,
  roughness: 0.62,
  metalness: 0.05,
  side: DoubleSide,
});
const bodyMesh = new Mesh(bodyGeometry, bodyMaterial);
bodyMesh.castShadow = true;
bodyMesh.receiveShadow = true;
lines.castShadow = true;
scene.add(bodyMesh);
scene.add(lines);

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
  const { faces, edges } = await api.createMesh(exampleId);
  syncFaces(bodyGeometry, faces);
  if (edges) syncLines(lineGeometry, edges);
  else syncLinesFromFaces(lineGeometry, bodyGeometry);
}

function animate(): void {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

async function bootstrap(): Promise<void> {
  const list = await api.listExamples();
  if (list.length === 0) {
    throw new Error("No examples found under project/examples/");
  }

  const fromUrl = readExampleFromUrl();
  const initialId =
    fromUrl !== undefined && list.some((e) => e.id === fromUrl) ? fromUrl : list[0].id;

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
