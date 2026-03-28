import { wrap } from "comlink";
import {
  AmbientLight,
  Box3,
  BufferGeometry,
  Clock,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  GridHelper,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PCFShadowMap,
  PerspectiveCamera,
  Quaternion,
  Raycaster,
  Scene,
  SphereGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { syncFaces, syncLines, syncLinesFromFaces } from "replicad-threejs-helper";
import type { ExampleMeta } from "../cad/project/types";
import type { MeshPayload, MeshResult, NamedScenePoint } from "./worker";

type ViewerApi = {
  listExamples: () => Promise<{ examples: ExampleMeta[]; defaultId: string }>;
  createMesh: (exampleId?: string) => Promise<MeshResult>;
};

const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
const api = wrap<ViewerApi>(worker);

const scene = new Scene();
scene.background = new Color(0x87b5d4);

const camera = new PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.08, 500);
// Replicad is Z-up (ground in XY, height along Z). Three.js defaults to Y-up without this.
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
// Z-up: light mainly from above (+Z) with XY offset for readable shadows on the ground
sun.position.set(18, 14, 36);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
scene.add(sun);
scene.add(new AmbientLight(0xb4c9e8, 0.45));

// Default GridHelper lies in XZ (Y-up); rotate to XY so it matches Replicad’s ground (z ≈ 0).
const grid = new GridHelper(56, 56, 0x5a7a8f, 0x3d5566);
grid.rotation.x = Math.PI / 2;
grid.position.z = 0.002;
scene.add(grid);

const cadRoot = new Group();
scene.add(cadRoot);

const clock = new Clock();

/** Match orientation overlay: East (+X), North (+Y), up (+Z). Feet; not cleared with CAD reload. */
const WORLD_AXIS_TOTAL_LEN = 12;
const WORLD_AXIS_HEAD_LEN = 2.6;
/** Thick shafts / wide cones so the gizmo reads in the main view (ties to 2D compass). */
const WORLD_AXIS_SHAFT_RADIUS = 0.48;
const WORLD_AXIS_HEAD_RADIUS = 1.05;
/** Base height for E/W and N/S cylinders before scaling to the far plane (see `updateWorldPlaneAxesToFarPlane`). */
const WORLD_PLANE_AXIS_CYL_BASE_H = 2;
const COLOR_AXIS_EAST = 0x6ab0e8;
const COLOR_AXIS_NORTH = 0x7ecf9a;
const COLOR_AXIS_UP = 0xc8d8f0;

const _axisDir = new Vector3();

const axisOverlayMaterialOpts = {
  depthTest: false,
  depthWrite: false,
  transparent: true,
  opacity: 0.96,
} as const;

/** E/W and N/S: scaled each frame to ~`camera.far` so they read as infinite in the frustum. */
let worldPlaneAxisMeshes: { x: Mesh; y: Mesh } | null = null;

const _axisWorldZ = new Vector3(0, 0, 1);
const _camOrbitOffset = new Vector3();
const _quatPlan = new Quaternion();

/**
 * Orbit the camera around **world Z** through `controls.target` by `angleRad` radians.
 */
function rotateViewAroundWorldZByAngle(angleRad: number): void {
  if (Math.abs(angleRad) < 1e-10) return;
  _camOrbitOffset.copy(camera.position).sub(controls.target);
  _quatPlan.setFromAxisAngle(_axisWorldZ, angleRad);
  _camOrbitOffset.applyQuaternion(_quatPlan);
  camera.position.copy(controls.target).add(_camOrbitOffset);
  camera.up.set(0, 0, 1);
  camera.lookAt(controls.target);
  controls.update();
}

/**
 * Stretch E/W (+X) and N/S (+Y) axes to the camera far plane each frame so they appear **infinite**
 * in the rendered view (within the frustum). +Z stays a short finite “up” arrow.
 */
function updateWorldPlaneAxesToFarPlane(): void {
  if (!worldPlaneAxisMeshes) return;
  const L = camera.far * 0.92;
  // Cylinder default height = WORLD_PLANE_AXIS_CYL_BASE_H; local Y maps to world ±X / ±Y after quaternion.
  // Total world length = BASE_H * scale.y — want ≈ 2 * L spanning through origin → scale.y = 2 * L / BASE_H.
  const sy = (2 * L) / WORLD_PLANE_AXIS_CYL_BASE_H;
  worldPlaneAxisMeshes.x.scale.set(1, sy, 1);
  worldPlaneAxisMeshes.y.scale.set(1, sy, 1);
}

/**
 * Thick mesh axes: **E/W and N/S** extend to the far plane (updated every frame). **+Z** is a short
 * arrow. Same palette as the HUD compass; **no depth test** so they read on top of the model.
 */
function createWorldAxesGizmo(): Group {
  const g = new Group();
  g.name = "worldAxesGizmo";
  g.renderOrder = 1000;

  const planeCylGeo = new CylinderGeometry(
    WORLD_AXIS_SHAFT_RADIUS,
    WORLD_AXIS_SHAFT_RADIUS,
    WORLD_PLANE_AXIS_CYL_BASE_H,
    28,
  );

  const matX = new MeshBasicMaterial({
    color: COLOR_AXIS_EAST,
    ...axisOverlayMaterialOpts,
  });
  const matY = new MeshBasicMaterial({
    color: COLOR_AXIS_NORTH,
    ...axisOverlayMaterialOpts,
  });

  const meshX = new Mesh(planeCylGeo, matX);
  meshX.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), new Vector3(1, 0, 0));
  meshX.renderOrder = 1000;

  const meshY = new Mesh(planeCylGeo, matY);
  meshY.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), new Vector3(0, 1, 0));
  meshY.renderOrder = 1000;

  worldPlaneAxisMeshes = { x: meshX, y: meshY };
  g.add(meshX, meshY);

  const shaftLen = WORLD_AXIS_TOTAL_LEN - WORLD_AXIS_HEAD_LEN;
  const upCylGeo = new CylinderGeometry(
    WORLD_AXIS_SHAFT_RADIUS,
    WORLD_AXIS_SHAFT_RADIUS,
    shaftLen,
    28,
  );
  const coneGeo = new ConeGeometry(WORLD_AXIS_HEAD_RADIUS, WORLD_AXIS_HEAD_LEN, 32);

  const matZ = new MeshBasicMaterial({
    color: COLOR_AXIS_UP,
    ...axisOverlayMaterialOpts,
  });
  _axisDir.set(0, 0, 1);
  const shaftZ = new Mesh(upCylGeo, matZ);
  shaftZ.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), _axisDir);
  shaftZ.position.copy(_axisDir.clone().multiplyScalar(shaftLen / 2));
  shaftZ.renderOrder = 1000;

  const headZ = new Mesh(coneGeo, matZ);
  headZ.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), _axisDir);
  headZ.position.copy(_axisDir.clone().multiplyScalar(shaftLen + WORLD_AXIS_HEAD_LEN / 2));
  headZ.renderOrder = 1000;

  g.add(shaftZ, headZ);

  updateWorldPlaneAxesToFarPlane();

  g.traverse((obj) => {
    obj.userData.excludeFromFit = true;
  });
  return g;
}

/** 3D orientation aids (axes + traveling dots): visibility follows the orientation overlay toggle. */
const worldOrientationScene3d = new Group();
worldOrientationScene3d.name = "worldOrientationScene3d";

worldOrientationScene3d.add(createWorldAxesGizmo());

// Traveling spheres along X (E/W) and Y (N/S) axes — synced with 2D compass dots.
const AXIS_SPHERE_RADIUS = 0.45;
const AXIS_SPHERE_PERIOD_X = 1.6; // seconds (1x speed) — matches 2D E/W dot
const AXIS_SPHERE_PERIOD_Y = 0.8; // seconds (2x speed) — matches 2D N/S dot
const AXIS_SPHERE_RANGE = 60;     // feet from origin in each direction

const axisSphereGeo = new SphereGeometry(AXIS_SPHERE_RADIUS, 16, 12);
const axisSphereX = new Mesh(axisSphereGeo, new MeshBasicMaterial({
  color: COLOR_AXIS_EAST,
  depthTest: false,
  transparent: true,
  opacity: 0.92,
}));
axisSphereX.renderOrder = 1001;
axisSphereX.userData.excludeFromFit = true;

const axisSphereY = new Mesh(axisSphereGeo, new MeshBasicMaterial({
  color: COLOR_AXIS_NORTH,
  depthTest: false,
  transparent: true,
  opacity: 0.92,
}));
axisSphereY.renderOrder = 1001;
axisSphereY.userData.excludeFromFit = true;

worldOrientationScene3d.add(axisSphereX, axisSphereY);
scene.add(worldOrientationScene3d);

/** Move axis spheres along their world axis at different speeds. */
function updateAxisSpheres(): void {
  const t = clock.getElapsedTime();
  const progressX = (t % AXIS_SPHERE_PERIOD_X) / AXIS_SPHERE_PERIOD_X; // W→E (1x)
  const progressY = (t % AXIS_SPHERE_PERIOD_Y) / AXIS_SPHERE_PERIOD_Y; // S→N (2x)
  const range = Math.min(AXIS_SPHERE_RANGE, camera.far * 0.45);
  axisSphereX.position.set(-range + progressX * 2 * range, 0, 0);
  axisSphereY.position.set(0, -range + progressY * 2 * range, 0);
  // Scale sphere with distance so it stays readable
  const s = Math.max(1, camera.position.length() * 0.035);
  axisSphereX.scale.setScalar(s);
  axisSphereY.scale.setScalar(s);
}

const raycaster = new Raycaster();
const pointerNdc = new Vector2();

/** World +Y (North) projected into the view plane — compass graphic aligns with this each frame. */
const _worldNorth = new Vector3(0, 1, 0);
const _viewForward = new Vector3();
const _northInViewPlane = new Vector3();
const _camRight = new Vector3();
const _camUp = new Vector3();
const _camBack = new Vector3();

let syncOrientationToView: (() => void) | undefined;

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
  cadRoot.traverse((obj) => {
    if (obj instanceof Mesh || obj instanceof LineSegments) disposeObject3D(obj);
  });
  while (cadRoot.children.length > 0) {
    cadRoot.remove(cadRoot.children[0]);
  }
}

const JUNCTION_COL_RADIUS = 0.12;
const junctionMarkerMat = new MeshStandardMaterial({
  color: 0xe8b44a,
  emissive: 0x331800,
  emissiveIntensity: 0.4,
  roughness: 0.42,
  metalness: 0.12,
});

/** Group that holds all junction column markers — toggled independently of cadRoot. */
const junctionRoot = new Group();
junctionRoot.name = "junctionMarkers";
scene.add(junctionRoot);

const JUNCTIONS_VISIBLE_KEY = "pergola-junctions-visible";
let junctionsVisible = localStorage.getItem(JUNCTIONS_VISIBLE_KEY) !== "0";
junctionRoot.visible = junctionsVisible;

function clearJunctionMarkers(): void {
  junctionRoot.traverse((obj) => {
    if (obj instanceof Mesh) {
      obj.geometry.dispose();
      const m = obj.material;
      if (Array.isArray(m)) m.forEach((x) => x.dispose());
      else m.dispose();
    }
  });
  while (junctionRoot.children.length > 0) {
    junctionRoot.remove(junctionRoot.children[0]);
  }
}

/**
 * Group junction points by XY position and create a vertical column at each.
 * The column spans from the min Z to the max Z of all points at that XY.
 * For single-Z points, the column extends down to grade (z=0).
 * The tooltip aggregates all labels at that XY.
 */
function addNamedPointMarkers(points: NamedScenePoint[]): void {
  clearJunctionMarkers();

  for (const p of points) {
    const x = p.position[0];
    const y = p.position[1];
    // Use explicit zMin/zMax if provided, otherwise fall back to position Z
    let zMin = p.zMin ?? p.position[2];
    let zMax = p.zMax ?? p.position[2];
    // Always start from ground
    zMin = Math.min(zMin, 0);
    if (zMax - zMin < 0.5) zMax = zMin + 1;

    const height = zMax - zMin;
    const geo = new CylinderGeometry(JUNCTION_COL_RADIUS, JUNCTION_COL_RADIUS, height, 12);
    const mesh = new Mesh(geo, junctionMarkerMat.clone());
    // CylinderGeometry is Y-up by default; rotate to Z-up
    mesh.rotation.x = Math.PI / 2;
    mesh.position.set(x, y, zMin + height / 2);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.excludeFromFit = true;
    mesh.userData.partLabel = p.label;

    junctionRoot.add(mesh);
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

function setupPartHoverTooltip(): void {
  const tip = document.createElement("div");
  tip.id = "cad-hover-tooltip";
  tip.setAttribute("role", "tooltip");
  tip.style.cssText = [
    "position:fixed",
    "left:0",
    "top:0",
    "pointer-events:none",
    "z-index:30",
    "padding:6px 10px",
    "background:rgba(15,20,28,0.92)",
    "color:#e8eef5",
    "font:13px/1.3 system-ui,sans-serif",
    "border-radius:6px",
    "box-shadow:0 2px 10px rgba(0,0,0,.35)",
    "white-space:pre-line",
    "visibility:hidden",
    "max-width:min(280px,90vw)",
  ].join(";");

  document.body.appendChild(tip);

  // Pinned panel: appears on click when a tooltip is showing
  const pinBtnStyle = [
    "padding:4px 10px",
    "border-radius:4px",
    "border:1px solid #394556",
    "background:#243040",
    "color:#e8eef5",
    "cursor:pointer",
    "font:12px/1.3 system-ui,sans-serif",
  ].join(";");

  const pin = document.createElement("div");
  pin.id = "cad-pinned-tooltip";
  pin.style.cssText = [
    "position:fixed",
    "left:0",
    "top:0",
    "z-index:31",
    "padding:8px 12px",
    "background:rgba(15,20,28,0.95)",
    "color:#e8eef5",
    "font:13px/1.3 system-ui,sans-serif",
    "border-radius:6px",
    "box-shadow:0 2px 14px rgba(0,0,0,.4)",
    "border:1px solid rgba(255,255,255,.12)",
    "white-space:pre-line",
    "max-width:min(320px,90vw)",
    "display:none",
  ].join(";");

  const pinText = document.createElement("div");
  pinText.style.marginBottom = "8px";

  const pinButtons = document.createElement("div");
  pinButtons.style.cssText = "display:flex;gap:6px;justify-content:flex-end";

  const copyBtn = document.createElement("button");
  copyBtn.type = "button";
  copyBtn.textContent = "Copy";
  copyBtn.style.cssText = pinBtnStyle;
  copyBtn.addEventListener("click", () => {
    navigator.clipboard.writeText(pinText.textContent ?? "").then(() => {
      closePin();
    });
  });

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.textContent = "Close";
  closeBtn.style.cssText = pinBtnStyle;
  closeBtn.addEventListener("click", closePin);

  pinButtons.append(copyBtn, closeBtn);
  pin.append(pinText, pinButtons);
  document.body.appendChild(pin);

  let pinOpen = false;

  function closePin(): void {
    pin.style.display = "none";
    pinOpen = false;
  }

  const canvas = renderer.domElement;

  function hideTooltip(): void {
    tip.style.visibility = "hidden";
  }

  /** Current hover label text (used to pin on click). */
  let currentHoverLabel = "";
  let currentTipX = 0;
  let currentTipY = 0;

  /** Track pointer movement to distinguish clicks from drags. */
  let downX = 0;
  let downY = 0;
  const DRAG_THRESHOLD = 5; // px

  canvas.addEventListener("pointerdown", (event: PointerEvent) => {
    downX = event.clientX;
    downY = event.clientY;
  });

  canvas.addEventListener("pointermove", (event: PointerEvent) => {
    if (pinOpen) return; // don't update hover while a pin is showing
    pointerNdc.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointerNdc.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(pointerNdc, camera);
    const hits = raycaster.intersectObjects([...cadRoot.children, ...junctionRoot.children], true);
    const hit = hits.find(
      (h): h is (typeof hits)[number] & { object: Mesh } =>
        h.object instanceof Mesh && typeof h.object.userData.partLabel === "string",
    );
    if (hit) {
      currentHoverLabel = hit.object.userData.partLabel;
      currentTipX = event.clientX + 14;
      currentTipY = event.clientY + 14;
      tip.textContent = currentHoverLabel;
      tip.style.visibility = "visible";
      tip.style.left = `${currentTipX}px`;
      tip.style.top = `${currentTipY}px`;
    } else {
      currentHoverLabel = "";
      hideTooltip();
    }
  });

  canvas.addEventListener("click", (event: MouseEvent) => {
    if (!currentHoverLabel) return;
    // Ignore if the pointer moved (drag/orbit/rotate)
    const dx = event.clientX - downX;
    const dy = event.clientY - downY;
    if (dx * dx + dy * dy > DRAG_THRESHOLD * DRAG_THRESHOLD) return;
    // Pin the tooltip
    pinText.textContent = currentHoverLabel;
    pin.style.left = `${currentTipX}px`;
    pin.style.top = `${currentTipY}px`;
    pin.style.display = "block";
    pinOpen = true;
    hideTooltip();
  });

  canvas.addEventListener("pointerleave", () => {
    if (!pinOpen) hideTooltip();
  });
}

function readExampleFromUrl(): string | undefined {
  return new URLSearchParams(window.location.search).get("example") ?? undefined;
}

function setExampleInUrl(id: string): void {
  const url = new URL(window.location.href);
  url.searchParams.set("example", id);
  window.history.replaceState({}, "", url.toString());
}

const ORIENTATION_VISIBLE_KEY = "pergola-orientation-visible";

type OrientationOverlayApi = {
  setVisible: (visible: boolean) => void;
  getVisible: () => boolean;
  toggle: () => void;
  /** Rotate the plan compass so N/E/S/W match world directions as seen in the current render. */
  syncToView: () => void;
};

/**
 * Rotate the compass widget so “N” points where world +Y (North) appears in the current camera view
 * (projection onto the screen plane).
 */
function updateCompassForCamera(camera: PerspectiveCamera, compassWrap: HTMLElement): void {
  camera.updateMatrixWorld(true);
  camera.getWorldDirection(_viewForward);
  _northInViewPlane.copy(_worldNorth).addScaledVector(_viewForward, -_worldNorth.dot(_viewForward));
  if (_northInViewPlane.lengthSq() < 1e-12) {
    compassWrap.style.transform = "rotate(0deg)";
    return;
  }
  _northInViewPlane.normalize();
  camera.matrixWorld.extractBasis(_camRight, _camUp, _camBack);
  const angleRad = Math.atan2(
    _northInViewPlane.dot(_camRight),
    _northInViewPlane.dot(_camUp),
  );
  const deg = (angleRad * 180) / Math.PI;
  compassWrap.style.transform = `rotate(${deg}deg)`;
}

/**
 * Bottom-right plan compass (+X East, +Y North) and Z-up note; matches `cad/sceneOrientation.ts`.
 * The compass **rotates with the camera** so labels match the rendered view.
 * Visibility is persisted in `localStorage`.
 */
function setupOrientationOverlay(worldScene3d: Group): OrientationOverlayApi {
  let visible =
    localStorage.getItem(ORIENTATION_VISIBLE_KEY) === null
      ? true
      : localStorage.getItem(ORIENTATION_VISIBLE_KEY) === "1";

  const root = document.createElement("div");
  root.id = "orientation-overlay";
  root.setAttribute("role", "img");
  root.setAttribute(
    "aria-label",
    "Scene orientation: compass rotates with the camera; positive X East, positive Y North, positive Z up",
  );
  root.style.cssText = [
    "position:fixed",
    "bottom:18px",
    "right:18px",
    "z-index:15",
    "padding:12px 14px 14px",
    "max-width:min(220px,calc(100vw - 36px))",
    "background:rgba(15,20,28,0.9)",
    "color:#e8eef5",
    "font:12px/1.35 system-ui,sans-serif",
    "border-radius:10px",
    "box-shadow:0 4px 20px rgba(0,0,0,.32)",
    "border:1px solid rgba(255,255,255,.1)",
    "pointer-events:auto",
    "touch-action:none",
    "user-select:none",
    "cursor:grab",
  ].join(";");

  const title = document.createElement("div");
  title.style.cssText = "margin-bottom:8px";
  const titleMain = document.createElement("div");
  titleMain.textContent = "Scene orientation";
  titleMain.style.cssText = "font-weight:600;font-size:13px;letter-spacing:0.02em";
  const titleSub = document.createElement("div");
  titleSub.textContent = "Drag here to spin the view in plan · compass matches the 3D axes";
  titleSub.style.cssText =
    "font-size:11px;font-weight:500;opacity:0.78;margin-top:4px;line-height:1.35";
  title.append(titleMain, titleSub);

  const svgNs = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNs, "svg");
  svg.setAttribute("width", "116");
  svg.setAttribute("height", "116");
  svg.setAttribute("viewBox", "-58 -58 116 116");
  svg.style.display = "block";
  svg.style.margin = "0 auto 8px";
  svg.style.pointerEvents = "none";

  const ring = document.createElementNS(svgNs, "circle");
  ring.setAttribute("cx", "0");
  ring.setAttribute("cy", "0");
  ring.setAttribute("r", "46");
  ring.setAttribute("fill", "none");
  ring.setAttribute("stroke", "rgba(255,255,255,.12)");
  ring.setAttribute("stroke-width", "1");
  svg.appendChild(ring);

  const axisStyle = "stroke-width:2.2;stroke-linecap:round";
  const h = document.createElementNS(svgNs, "line");
  h.setAttribute("x1", "-40");
  h.setAttribute("y1", "0");
  h.setAttribute("x2", "40");
  h.setAttribute("y2", "0");
  h.setAttribute("stroke", "#6ab0e8");
  h.setAttribute("style", axisStyle);
  svg.appendChild(h);

  const v = document.createElementNS(svgNs, "line");
  v.setAttribute("x1", "0");
  v.setAttribute("y1", "-40");
  v.setAttribute("x2", "0");
  v.setAttribute("y2", "40");
  v.setAttribute("stroke", "#7ecf9a");
  v.setAttribute("style", axisStyle);
  svg.appendChild(v);

  // Animated ripple dots traveling along each axis line
  function addRippleDot(
    cx1: number, cy1: number, cx2: number, cy2: number, fill: string, dur: string,
  ): void {
    const dot = document.createElementNS(svgNs, "circle");
    dot.setAttribute("r", "4");
    dot.setAttribute("fill", fill);
    dot.setAttribute("opacity", "0.9");
    dot.setAttribute("pointer-events", "none");
    const aX = document.createElementNS(svgNs, "animate");
    aX.setAttribute("attributeName", "cx");
    aX.setAttribute("from", String(cx1));
    aX.setAttribute("to", String(cx2));
    aX.setAttribute("dur", dur);
    aX.setAttribute("repeatCount", "indefinite");
    dot.appendChild(aX);
    const aY = document.createElementNS(svgNs, "animate");
    aY.setAttribute("attributeName", "cy");
    aY.setAttribute("from", String(cy1));
    aY.setAttribute("to", String(cy2));
    aY.setAttribute("dur", dur);
    aY.setAttribute("repeatCount", "indefinite");
    dot.appendChild(aY);
    svg.appendChild(dot);
  }
  // E→W ripple (1x speed — matches 3D sphere)
  addRippleDot(-40, 0, 40, 0, "#6ab0e8", "1.6s");
  // N→S ripple (2x speed — matches 3D sphere)
  addRippleDot(0, 40, 0, -40, "#7ecf9a", "0.8s");

  function label(x: string, y: string, text: string, fill: string, fs = "15"): void {
    const t = document.createElementNS(svgNs, "text");
    t.setAttribute("x", x);
    t.setAttribute("y", y);
    t.setAttribute("fill", fill);
    t.setAttribute("font-size", fs);
    t.setAttribute("font-weight", "700");
    t.setAttribute("text-anchor", "middle");
    t.setAttribute("dominant-baseline", "middle");
    t.textContent = text;
    svg.appendChild(t);
  }
  label("0", "-50", "N", "#7ecf9a");
  label("0", "52", "S", "rgba(232,238,245,.55)");
  label("52", "0", "E", "#6ab0e8");
  label("-52", "0", "W", "rgba(232,238,245,.55)");

  const legend = document.createElement("div");
  legend.style.cssText = "opacity:0.92;line-height:1.45";
  legend.innerHTML =
    "<div><strong>+X</strong> East · <strong>+Y</strong> North · <strong>+Z</strong> up</div>" +
    "<div style=\"margin-top:6px;opacity:0.88;font-size:11px\">" +
    "Same colors as the axis arrows at the scene origin. N/E/S/W = where those directions appear <em>on screen</em>." +
    "</div>";

  const compassWrap = document.createElement("div");
  compassWrap.style.cssText = [
    "width:116px",
    "height:116px",
    "margin:0 auto 8px",
    "transform-origin:center center",
    "will-change:transform",
  ].join(";");
  compassWrap.appendChild(svg);

  root.append(title, compassWrap, legend);
  document.body.appendChild(root);

  let compassDragging = false;
  let lastAngle = 0;

  function hideCadHoverTooltip(): void {
    const el = document.getElementById("cad-hover-tooltip");
    if (el) el.style.visibility = "hidden";
  }

  /** Angle (radians) of pointer relative to the compass center. */
  function pointerAngle(e: PointerEvent): number {
    const rect = compassWrap.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    return Math.atan2(e.clientY - cy, e.clientX - cx);
  }

  root.addEventListener("pointerdown", (e: PointerEvent) => {
    if (!visible || e.button !== 0) return;
    compassDragging = true;
    lastAngle = pointerAngle(e);
    root.setPointerCapture(e.pointerId);
    root.style.cursor = "grabbing";
    controls.enabled = false; // prevent OrbitControls from reacting
    hideCadHoverTooltip();
    e.preventDefault();
    e.stopPropagation();
  });

  root.addEventListener("pointermove", (e: PointerEvent) => {
    if (!compassDragging) return;
    const angle = pointerAngle(e);
    let delta = angle - lastAngle;
    // Wrap to −π..π so crossing ±180° doesn't jump
    if (delta > Math.PI) delta -= 2 * Math.PI;
    if (delta < -Math.PI) delta += 2 * Math.PI;
    lastAngle = angle;
    // 1:1 mapping — negate so the compass visually follows the pointer
    rotateViewAroundWorldZByAngle(delta);
    e.preventDefault();
    e.stopPropagation();
  });

  function endCompassDrag(e: PointerEvent): void {
    if (!compassDragging) return;
    compassDragging = false;
    controls.enabled = true; // re-enable OrbitControls
    if (root.hasPointerCapture(e.pointerId)) {
      root.releasePointerCapture(e.pointerId);
    }
    root.style.cursor = "grab";
  }

  root.addEventListener("pointerup", endCompassDrag);
  root.addEventListener("pointercancel", endCompassDrag);

  function apply(): void {
    root.style.display = visible ? "block" : "none";
    worldScene3d.visible = visible;
    localStorage.setItem(ORIENTATION_VISIBLE_KEY, visible ? "1" : "0");
  }

  apply();

  return {
    getVisible: () => visible,
    setVisible: (v: boolean) => {
      visible = v;
      apply();
    },
    toggle: () => {
      visible = !visible;
      apply();
    },
    syncToView: () => {
      if (!visible) return;
      updateCompassForCamera(camera, compassWrap);
    },
  };
}

function buildExampleToolbar(
  items: ExampleMeta[],
  onSelect: (id: string) => void,
  initialId: string,
  orientation: OrientationOverlayApi,
): void {
  const bar = document.createElement("div");
  bar.style.cssText = [
    "position:fixed",
    "top:12px",
    "left:12px",
    "z-index:10",
    "display:flex",
    "align-items:center",
    "flex-wrap:wrap",
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

  const orientBtn = document.createElement("button");
  orientBtn.type = "button";
  orientBtn.title =
    "Show or hide the orientation overlay (compass matches world N/E/S/W in the current 3D view)";
  orientBtn.style.cssText = [
    "padding:6px 11px",
    "border-radius:6px",
    "border:1px solid #394556",
    "background:#243040",
    "color:inherit",
    "cursor:pointer",
    "font:inherit",
    "white-space:nowrap",
  ].join(";");

  function syncOrientButton(): void {
    const on = orientation.getVisible();
    orientBtn.setAttribute("aria-pressed", on ? "true" : "false");
    orientBtn.textContent = on ? "Orientation on" : "Orientation off";
  }
  orientBtn.addEventListener("click", () => {
    orientation.toggle();
    syncOrientButton();
  });
  syncOrientButton();

  // "Above ground" toggle — clamps polar angle so camera can't go below ground plane
  const ABOVE_GROUND_KEY = "pergola-above-ground";
  let aboveGround = localStorage.getItem(ABOVE_GROUND_KEY) !== "0"; // default on

  const aboveBtn = document.createElement("button");
  aboveBtn.type = "button";
  aboveBtn.title = "Lock the camera above the ground plane (prevent going underneath)";
  aboveBtn.style.cssText = [
    "padding:6px 11px",
    "border-radius:6px",
    "border:1px solid #394556",
    "background:#243040",
    "color:inherit",
    "cursor:pointer",
    "font:inherit",
    "white-space:nowrap",
  ].join(";");

  function applyAboveGround(): void {
    if (aboveGround) {
      // Z-up: polar angle 0 = looking down +Z, π/2 = horizon. Clamp to just above horizon.
      controls.maxPolarAngle = Math.PI / 2 - 0.02;
      // If camera is currently below ground, snap it back
      controls.update();
    } else {
      controls.maxPolarAngle = Math.PI;
    }
    aboveBtn.setAttribute("aria-pressed", aboveGround ? "true" : "false");
    aboveBtn.textContent = aboveGround ? "Above ground" : "Free orbit";
    localStorage.setItem(ABOVE_GROUND_KEY, aboveGround ? "1" : "0");
  }

  aboveBtn.addEventListener("click", () => {
    aboveGround = !aboveGround;
    applyAboveGround();
  });
  applyAboveGround();

  // "Junctions" toggle — show/hide derived junction column markers
  const juncBtn = document.createElement("button");
  juncBtn.type = "button";
  juncBtn.title = "Show or hide junction markers where building volumes meet";
  juncBtn.style.cssText = aboveBtn.style.cssText;

  function syncJuncButton(): void {
    juncBtn.setAttribute("aria-pressed", junctionsVisible ? "true" : "false");
    juncBtn.textContent = junctionsVisible ? "Junctions on" : "Junctions off";
  }
  juncBtn.addEventListener("click", () => {
    junctionsVisible = !junctionsVisible;
    junctionRoot.visible = junctionsVisible;
    localStorage.setItem(JUNCTIONS_VISIBLE_KEY, junctionsVisible ? "1" : "0");
    syncJuncButton();
  });
  syncJuncButton();

  bar.append(label, select, orientBtn, aboveBtn, juncBtn);
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
    if (result.partLabel) mesh.userData.partLabel = result.partLabel;
    const lineGeom = new BufferGeometry();
    if (edges) syncLines(lineGeom, edges);
    else syncLinesFromFaces(lineGeom, geom);
    const lines = new LineSegments(lineGeom, edgeMaterial);
    cadRoot.add(mesh, lines);
    addNamedPointMarkers(result.namedPoints);
    frameCameraToStructure();
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

  addNamedPointMarkers(result.namedPoints);
  frameCameraToStructure();
}

function animate(): void {
  requestAnimationFrame(animate);
  controls.update();
  if (worldOrientationScene3d.visible) {
    updateWorldPlaneAxesToFarPlane();
    updateAxisSpheres();
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

async function bootstrap(): Promise<void> {
  setupPartHoverTooltip();
  const orientationOverlay = setupOrientationOverlay(worldOrientationScene3d);
  syncOrientationToView = () => orientationOverlay.syncToView();

  const { examples: list, defaultId } = await api.listExamples();
  if (list.length === 0) {
    throw new Error("No examples found under cad/project/examples/");
  }

  const fromUrl = readExampleFromUrl();
  const initialId =
    fromUrl !== undefined && list.some((e) => e.id === fromUrl) ? fromUrl : defaultId;

  await loadMesh(initialId);

  buildExampleToolbar(
    list,
    (id) => {
      loadMesh(id).catch((err) => console.error(err));
    },
    initialId,
    orientationOverlay,
  );

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
