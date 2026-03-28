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
import type { MeshPayload } from "./worker";

const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
const api = wrap<{ createMesh: () => Promise<MeshPayload> }>(worker);

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

async function loadMesh(): Promise<void> {
  const { faces, edges } = await api.createMesh();
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

loadMesh().catch((err) => {
  console.error(err);
  document.body.insertAdjacentHTML(
    "beforeend",
    `<pre style="position:fixed;bottom:0;left:0;background:#300;color:#fcc;padding:8px;">${String(err)}</pre>`,
  );
});
animate();
