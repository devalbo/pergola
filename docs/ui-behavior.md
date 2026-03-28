# Viewer UI behavior (for future changes)

This document describes how the **user interface is supposed to behave** so new features do not fight each other—especially the distinction between **3D navigation on the canvas** and **2D / plan-style interaction on the scene orientation panel**.

**Primary implementation:** `src/main.ts` (Three.js + DOM overlays).

---

## Two different interaction surfaces

| Surface | Role | User mental model |
|--------|------|-------------------|
| **WebGL canvas** | Inspect the CAD model in 3D | **Orbit / zoom / pan** around a focus point (`OrbitControls`). Drag moves the **camera** in full 3D (azimuth, polar angle, distance). |
| **Scene orientation panel** (bottom-right) | Read world N/E/S/W relative to the screen; optional **plan spin** | **2D, screen-fixed widget.** Drag is interpreted as rotation **only around world +Z** (vertical), through the current orbit **target**—i.e. “spin the plan,” not free 3D tumble. The compass visually follows the pointer 1:1. |

These must be treated as **different modes**, not two bindings of the same gesture. If both react to the same pointer stream, the user will feel **fighting** between compass drag and orbit.

---

## Compass drag mechanics

The compass drag uses **angular tracking**, not raw pixel deltas:

1. On `pointerdown`, compute the pointer's angle relative to the compass center (`atan2`).
2. On each `pointermove`, compute the new angle and take the delta (wrapped to ±π).
3. Pass that radian delta directly to `rotateViewAroundWorldZByAngle()` — **1 radian of pointer sweep = 1 radian of camera rotation**. No arbitrary pixel-to-angle conversion factor.
4. The compass updates via `syncToView` / `updateCompassForCamera` each frame, so it visually follows the pointer.

This makes the interaction feel like **grabbing and spinning a dial**: click the left edge and pull down → the compass and 3D view rotate clockwise together, tracking the pointer.

---

## Rules for coding agents

1. **Never let OrbitControls and orientation drag both consume the same gesture.**
   While the user is dragging on the orientation overlay, **`OrbitControls` must not run** for that pointer. The current code sets `controls.enabled = false` on `pointerdown` and restores it on `pointerup` / `pointercancel` on that overlay.

2. **Use pointer capture on the overlay** for compass/plan drags so movement is tracked reliably even if the pointer leaves the panel (`setPointerCapture` / `releasePointerCapture`). This also reduces accidental handoff to the canvas mid-drag.

3. **Stop propagation** on orientation overlay pointer events when handling drags (`preventDefault` / `stopPropagation` as appropriate) so behavior is explicit and future listeners do not double-handle.

4. **Plan rotation vs 3D orbit use different math:**
   - Canvas: `OrbitControls` (spherical motion around `controls.target`).
   - Orientation panel: angular delta from `atan2` relative to compass center → `rotateViewAroundWorldZByAngle(radians)`, preserving Z-up and `lookAt(controls.target)`.
   Do not reuse orbit deltas or raw pixel deltas for the compass. The mapping must be angular (pointer sweep around compass center) so the compass tracks the pointer naturally.

5. **Hover tooltips** for CAD parts use raycasting on `cadRoot` from the **canvas** only. Starting a drag on the orientation panel should **hide** the part tooltip (`#cad-hover-tooltip`) so stale labels do not linger.

6. **Z-order:** The orientation panel sits above the canvas (`z-index`). Clicks on the panel must hit the panel (`pointer-events: auto` on the overlay root where interaction is needed). Inner decorative pieces (e.g. SVG, animated dots) must use `pointer-events: none` so hits go to a consistent parent and don't block the drag.

7. **Touch:** Use `touch-action: none` on draggable overlays to avoid browser scrolling stealing the gesture.

---

## Animated axis indicators

Both the 3D view and the 2D compass have traveling indicators to reinforce axis direction:

- **3D**: Spheres travel along the E/W (+X) and N/S (+Y) world axes. They scale with camera distance to stay readable. Positioned each frame in `updateAxisSpheres()`.
- **2D compass**: SVG circles animate along the compass lines using `<animate>` elements.
- **Speeds differ by axis** to make them visually distinguishable: E/W at 1x (1.6s period), N/S at 2x (0.8s period). The 3D sphere periods match the 2D SVG durations.
- Animated SVG elements must have `pointer-events: none` to avoid blocking compass drag.

---

## Toolbar and other UI

- **Example selector** (top-left): changing examples reloads geometry; it should not steal pointer capture from the canvas or orientation overlay.
- **Orientation visibility toggle:** Toggles the **HUD panel** and, together, the **3D orientation group** (`worldOrientationScene3d`: world axes + traveling axis spheres). When orientation is off, those 3D aids are hidden so the scene stays uncluttered. Interaction rules above are unchanged.
- **Above ground / Free orbit toggle:** Controls whether the camera can orbit below the ground plane.
  - **Above ground** (default, persisted in `localStorage`): Sets `controls.maxPolarAngle` to just above the horizon (`π/2 − 0.02`), preventing the camera from going underneath. If the camera is already below ground when toggled on, `controls.update()` snaps it back.
  - **Free orbit**: Restores `maxPolarAngle` to `π`, allowing full spherical exploration including from below.
  - This only constrains the **canvas orbit** (`OrbitControls`). Compass drag is Z-rotation only and is unaffected.

---

## When extending the UI

- **New overlays** (legend, gizmos, future panels): decide whether they are **read-only** (`pointer-events: none`) or **interactive**. If interactive, document whether they should disable orbit during drag (same pattern as orientation).
- **New camera controls:** Prefer a single owner of pointer input per gesture, or explicit modes (e.g. modifier keys), rather than stacking multiple controllers on `pointermove` without coordination.
- **Fullscreen / resize:** Anything that depends on `camera.far` or panel size (e.g. infinite axis lines, compass layout) should stay consistent after `resize` / refit—see `frameCameraToStructure` and `updateWorldPlaneAxesToFarPlane`.
- **New animations on axes:** Keep 3D and 2D indicators synced (same period). Use `pointer-events: none` on any decorative/animated elements inside interactive panels.

---

## Related project docs

- Scene compass / axes convention: `cad/sceneOrientation.ts`
- Named points and part labels: `cad/namedScenePoint.ts`, example `scenePartNames` / `sceneNamedPoints` in `cad/project/examples/`

---

## Summary

**3D view drag** = orbit the camera (full spherical exploration).
**Orientation panel drag** = plan-only rotation about world up, with orbit controls **disabled for that gesture**. Uses angular tracking (atan2 around compass center) so the compass follows the pointer 1:1.

Keeping that separation explicit—in code (`controls.enabled`) and in product behavior—is what prevents the two from fighting.
