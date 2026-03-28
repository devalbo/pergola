import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { ExampleMeta } from "../cad/project/types";
import type { OrientationOverlayApi } from "./compass";
import type { JunctionSystem } from "./junctions";

export function readExampleFromUrl(): string | undefined {
  return new URLSearchParams(window.location.search).get("example") ?? undefined;
}

export function setExampleInUrl(id: string): void {
  const url = new URL(window.location.href);
  url.searchParams.set("example", id);
  window.history.replaceState({}, "", url.toString());
}

export function buildExampleToolbar(
  items: ExampleMeta[],
  onSelect: (id: string) => void,
  initialId: string,
  orientation: OrientationOverlayApi,
  controls: OrbitControls,
  junctions: JunctionSystem,
): HTMLDivElement {
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

  const select = document.createElement("select");
  select.id = "example-select";
  select.setAttribute("aria-label", "Scene");
  select.style.cssText =
    "min-width:220px;padding:6px 8px;border-radius:6px;border:1px solid #394556;background:#1a222c;color:inherit";

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

  const btnStyle = [
    "padding:6px 11px",
    "border-radius:6px",
    "border:1px solid #394556",
    "background:#243040",
    "color:inherit",
    "cursor:pointer",
    "font:inherit",
    "white-space:nowrap",
  ].join(";");

  // ── Orientation toggle ──
  const orientBtn = document.createElement("button");
  orientBtn.type = "button";
  orientBtn.title =
    "Show or hide the orientation overlay (compass matches world N/E/S/W in the current 3D view)";
  orientBtn.style.cssText = btnStyle;

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

  // ── Above-ground toggle ──
  const ABOVE_GROUND_KEY = "pergola-above-ground";
  let aboveGround = localStorage.getItem(ABOVE_GROUND_KEY) !== "0";

  const aboveBtn = document.createElement("button");
  aboveBtn.type = "button";
  aboveBtn.title = "Lock the camera above the ground plane (prevent going underneath)";
  aboveBtn.style.cssText = btnStyle;

  function applyAboveGround(): void {
    if (aboveGround) {
      controls.maxPolarAngle = Math.PI / 2 - 0.02;
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

  // ── Junctions toggle ──
  const juncBtn = document.createElement("button");
  juncBtn.type = "button";
  juncBtn.title = "Show or hide junction markers where building volumes meet";
  juncBtn.style.cssText = btnStyle;

  function syncJuncButton(): void {
    juncBtn.setAttribute("aria-pressed", junctions.isVisible() ? "true" : "false");
    juncBtn.textContent = junctions.isVisible() ? "Junctions on" : "Junctions off";
  }
  juncBtn.addEventListener("click", () => {
    junctions.toggle();
    syncJuncButton();
  });
  syncJuncButton();

  bar.append(select, orientBtn, aboveBtn, juncBtn);

  document.body.appendChild(bar);
  return bar;
}
