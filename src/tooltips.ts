import { Mesh, PerspectiveCamera, Raycaster, Vector2 } from "three";
import type { Group } from "three";

const raycaster = new Raycaster();
const pointerNdc = new Vector2();

export function setupPartHoverTooltip(
  canvas: HTMLCanvasElement,
  camera: PerspectiveCamera,
  raycastTargets: () => Group[],
): void {
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

  function hideTooltip(): void {
    tip.style.visibility = "hidden";
  }

  let currentHoverLabel = "";
  let currentTipX = 0;
  let currentTipY = 0;

  let downX = 0;
  let downY = 0;
  const DRAG_THRESHOLD = 5;

  canvas.addEventListener("pointerdown", (event: PointerEvent) => {
    downX = event.clientX;
    downY = event.clientY;
  });

  canvas.addEventListener("pointermove", (event: PointerEvent) => {
    if (pinOpen) return;
    pointerNdc.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointerNdc.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(pointerNdc, camera);
    const targets = raycastTargets().flatMap((g) => g.children);
    const hits = raycaster.intersectObjects(targets, true);
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
    const dx = event.clientX - downX;
    const dy = event.clientY - downY;
    if (dx * dx + dy * dy > DRAG_THRESHOLD * DRAG_THRESHOLD) return;
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
