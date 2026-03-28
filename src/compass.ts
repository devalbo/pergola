import {
  Clock,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Quaternion,
  SphereGeometry,
  Vector3,
} from "three";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

// ── Axis gizmo constants ──────────────────────────────────────────

const WORLD_AXIS_TOTAL_LEN = 12;
const WORLD_AXIS_HEAD_LEN = 2.6;
const WORLD_AXIS_SHAFT_RADIUS = 0.48;
const WORLD_AXIS_HEAD_RADIUS = 1.05;
const WORLD_PLANE_AXIS_CYL_BASE_H = 2;
const COLOR_AXIS_EAST = 0x6ab0e8;
const COLOR_AXIS_NORTH = 0x7ecf9a;
const COLOR_AXIS_UP = 0xc8d8f0;

const axisOverlayMaterialOpts = {
  depthTest: false,
  depthWrite: false,
  transparent: true,
  opacity: 0.96,
} as const;

const AXIS_SPHERE_RADIUS = 0.45;
const AXIS_SPHERE_PERIOD_X = 1.6;
const AXIS_SPHERE_PERIOD_Y = 0.8;
const AXIS_SPHERE_RANGE = 60;

// ── Scratch vectors ───────────────────────────────────────────────

const _axisDir = new Vector3();
const _axisWorldZ = new Vector3(0, 0, 1);
const _camOrbitOffset = new Vector3();
const _quatPlan = new Quaternion();
const _projA = new Vector3();
const _projB = new Vector3();

// ── Orientation 3D scene ──────────────────────────────────────────

export type OrientationScene3d = {
  group: Group;
  /** Call every frame when visible. */
  updateFrame: () => void;
};

export function createOrientationScene3d(
  clock: Clock,
  camera: PerspectiveCamera,
): OrientationScene3d {
  const group = new Group();
  group.name = "worldOrientationScene3d";

  // ── Plane axes (stretched to far plane each frame) ──
  const planeCylGeo = new CylinderGeometry(
    WORLD_AXIS_SHAFT_RADIUS,
    WORLD_AXIS_SHAFT_RADIUS,
    WORLD_PLANE_AXIS_CYL_BASE_H,
    28,
  );
  const matX = new MeshBasicMaterial({ color: COLOR_AXIS_EAST, ...axisOverlayMaterialOpts });
  const matY = new MeshBasicMaterial({ color: COLOR_AXIS_NORTH, ...axisOverlayMaterialOpts });

  const meshX = new Mesh(planeCylGeo, matX);
  meshX.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), new Vector3(1, 0, 0));
  meshX.renderOrder = 1000;

  const meshY = new Mesh(planeCylGeo, matY);
  meshY.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), new Vector3(0, 1, 0));
  meshY.renderOrder = 1000;

  group.add(meshX, meshY);

  // ── Z arrow ──
  const shaftLen = WORLD_AXIS_TOTAL_LEN - WORLD_AXIS_HEAD_LEN;
  const upCylGeo = new CylinderGeometry(WORLD_AXIS_SHAFT_RADIUS, WORLD_AXIS_SHAFT_RADIUS, shaftLen, 28);
  const coneGeo = new ConeGeometry(WORLD_AXIS_HEAD_RADIUS, WORLD_AXIS_HEAD_LEN, 32);
  const matZ = new MeshBasicMaterial({ color: COLOR_AXIS_UP, ...axisOverlayMaterialOpts });

  _axisDir.set(0, 0, 1);
  const shaftZ = new Mesh(upCylGeo, matZ);
  shaftZ.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), _axisDir);
  shaftZ.position.copy(_axisDir.clone().multiplyScalar(shaftLen / 2));
  shaftZ.renderOrder = 1000;

  const headZ = new Mesh(coneGeo, matZ);
  headZ.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), _axisDir);
  headZ.position.copy(_axisDir.clone().multiplyScalar(shaftLen + WORLD_AXIS_HEAD_LEN / 2));
  headZ.renderOrder = 1000;

  group.add(shaftZ, headZ);

  // ── Traveling spheres ──
  const sphereGeo = new SphereGeometry(AXIS_SPHERE_RADIUS, 16, 12);
  const sphereX = new Mesh(sphereGeo, new MeshBasicMaterial({
    color: COLOR_AXIS_EAST, depthTest: false, transparent: true, opacity: 0.92,
  }));
  sphereX.renderOrder = 1001;
  sphereX.userData.excludeFromFit = true;

  const sphereY = new Mesh(sphereGeo, new MeshBasicMaterial({
    color: COLOR_AXIS_NORTH, depthTest: false, transparent: true, opacity: 0.92,
  }));
  sphereY.renderOrder = 1001;
  sphereY.userData.excludeFromFit = true;

  group.add(sphereX, sphereY);

  // Initial far-plane stretch
  const initL = camera.far * 0.92;
  const initSy = (2 * initL) / WORLD_PLANE_AXIS_CYL_BASE_H;
  meshX.scale.set(1, initSy, 1);
  meshY.scale.set(1, initSy, 1);

  group.traverse((obj) => { obj.userData.excludeFromFit = true; });

  function updateFrame(): void {
    // Stretch plane axes to far plane
    const L = camera.far * 0.92;
    const sy = (2 * L) / WORLD_PLANE_AXIS_CYL_BASE_H;
    meshX.scale.set(1, sy, 1);
    meshY.scale.set(1, sy, 1);

    // Animate traveling spheres
    const t = clock.getElapsedTime();
    const px = (t % AXIS_SPHERE_PERIOD_X) / AXIS_SPHERE_PERIOD_X;
    const py = (t % AXIS_SPHERE_PERIOD_Y) / AXIS_SPHERE_PERIOD_Y;
    const range = Math.min(AXIS_SPHERE_RANGE, camera.far * 0.45);
    sphereX.position.set(-range + px * 2 * range, 0, 0);
    sphereY.position.set(0, -range + py * 2 * range, 0);
    const s = Math.max(1, camera.position.length() * 0.035);
    sphereX.scale.setScalar(s);
    sphereY.scale.setScalar(s);
  }

  return { group, updateFrame };
}

// ── Plan rotation ─────────────────────────────────────────────────

export function rotateViewAroundWorldZ(
  angleRad: number,
  camera: PerspectiveCamera,
  controls: OrbitControls,
): void {
  if (Math.abs(angleRad) < 1e-10) return;
  _camOrbitOffset.copy(camera.position).sub(controls.target);
  _quatPlan.setFromAxisAngle(_axisWorldZ, angleRad);
  _camOrbitOffset.applyQuaternion(_quatPlan);
  camera.position.copy(controls.target).add(_camOrbitOffset);
  camera.up.set(0, 0, 1);
  camera.lookAt(controls.target);
  controls.update();
}

// ── Compass sync ──────────────────────────────────────────────────

function updateCompassForCamera(
  camera: PerspectiveCamera,
  controls: OrbitControls,
  compassWrap: HTMLElement,
): void {
  camera.updateMatrixWorld(true);

  const t = controls.target;
  _projA.set(t.x, t.y, t.z).project(camera);
  _projB.set(t.x, t.y + 1, t.z).project(camera);

  const dx = _projB.x - _projA.x;
  const dy = _projB.y - _projA.y;

  if (dx * dx + dy * dy < 1e-12) {
    compassWrap.style.transform = "rotate(0deg)";
    return;
  }

  const angleRad = Math.atan2(dx, dy);
  compassWrap.style.transform = `rotate(${(angleRad * 180) / Math.PI}deg)`;
}

// ── Orientation overlay (2D HUD) ──────────────────────────────────

const ORIENTATION_VISIBLE_KEY = "pergola-orientation-visible";

export type OrientationOverlayApi = {
  setVisible: (visible: boolean) => void;
  getVisible: () => boolean;
  toggle: () => void;
  syncToView: () => void;
};

export function setupOrientationOverlay(
  worldScene3d: Group,
  camera: PerspectiveCamera,
  controls: OrbitControls,
): OrientationOverlayApi {
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
  titleSub.textContent = "Drag here to spin the view in plan \u00b7 compass matches the 3D axes";
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
  addRippleDot(-40, 0, 40, 0, "#6ab0e8", "1.6s");
  addRippleDot(0, 40, 0, -40, "#7ecf9a", "0.8s");

  function svgLabel(x: string, y: string, text: string, fill: string, fs = "15"): void {
    const el = document.createElementNS(svgNs, "text");
    el.setAttribute("x", x);
    el.setAttribute("y", y);
    el.setAttribute("fill", fill);
    el.setAttribute("font-size", fs);
    el.setAttribute("font-weight", "700");
    el.setAttribute("text-anchor", "middle");
    el.setAttribute("dominant-baseline", "middle");
    el.textContent = text;
    svg.appendChild(el);
  }
  svgLabel("0", "-50", "N", "#7ecf9a");
  svgLabel("0", "52", "S", "rgba(232,238,245,.55)");
  svgLabel("52", "0", "E", "#6ab0e8");
  svgLabel("-52", "0", "W", "rgba(232,238,245,.55)");

  const legend = document.createElement("div");
  legend.style.cssText = "opacity:0.92;line-height:1.45";
  legend.innerHTML =
    "<div><strong>+X</strong> East \u00b7 <strong>+Y</strong> North \u00b7 <strong>+Z</strong> up</div>" +
    '<div style="margin-top:6px;opacity:0.88;font-size:11px">' +
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
    controls.enabled = false;
    hideCadHoverTooltip();
    e.preventDefault();
    e.stopPropagation();
  });

  root.addEventListener("pointermove", (e: PointerEvent) => {
    if (!compassDragging) return;
    const angle = pointerAngle(e);
    let delta = angle - lastAngle;
    if (delta > Math.PI) delta -= 2 * Math.PI;
    if (delta < -Math.PI) delta += 2 * Math.PI;
    lastAngle = angle;
    rotateViewAroundWorldZ(delta, camera, controls);
    e.preventDefault();
    e.stopPropagation();
  });

  function endCompassDrag(e: PointerEvent): void {
    if (!compassDragging) return;
    compassDragging = false;
    controls.enabled = true;
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
      updateCompassForCamera(camera, controls, compassWrap);
    },
  };
}
