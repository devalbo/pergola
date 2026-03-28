# Pergola — Replicad playground

**Goal:** Define geometry in TypeScript and preview it in the browser (OpenCascade WASM + Three.js).

## Prerequisites

- [Node.js](https://nodejs.org/) LTS (v20+ recommended)

## Setup

Clone or copy the repository, then from the project root:

```bash
npm install
npm run dev
```

`node_modules/` and `dist/` are gitignored; run `npm install` on every new clone or machine.

Open the URL Vite prints (default `http://localhost:5173`). Orbit: drag to rotate, scroll to zoom.

**Optional:** `npx tsc --noEmit` typechecks the CAD + viewer code.

## Viewer (main thread)

- **Scene picker** (toolbar): choose a registered example; URL stays in sync (`?example=<id>`).
- **Parameters** (toolbar, when the scene declares fields): live numeric inputs; values merge with defaults in the worker and rebuild the mesh.
- **Orientation** / **Above ground** / **Junctions**: toggles for the compass overlay, orbit limits, and junction markers where volumes meet.
- **Part hover** (multi-part scenes): tooltips use `scenePartNames` from each example.

CAD runs in a **Web Worker** ([`src/worker.ts`](src/worker.ts)): OpenCascade + Replicad, exposed to the UI via [Comlink](https://github.com/GoogleChromeLabs/comlink) (`listExamples`, `createMesh(exampleId, paramValues?)`).

## GitHub Pages

Production builds use **`base: "./"`** in [`vite.config.ts`](vite.config.ts) so asset URLs are **relative** (`./assets/...`). That works for a **project site** at `https://<user>.github.io/<repo>/` without hard-coding the repo name.

1. Push this repo to GitHub (including [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml)).
2. In the repo on GitHub: **Settings → Pages → Build and deployment → Source**: choose **GitHub Actions** (not “Deploy from a branch”).
3. Push to **`main`**. The workflow runs `npm ci`, `npm run build`, and publishes **`dist/`** to Pages.
4. After the first successful run, the site URL is shown on the workflow run and under **Settings → Pages** (typically `https://<user>.github.io/<repo>/`).

To confirm locally: `npm run build` then `npm run preview` and open the printed URL.

## Local-first runtime (no remote scripts)

- **HTML** loads a single local module entry (`/src/main.ts` in dev, hashed `./assets/*.js` after `npm run build`).
- **Three.js, Comlink, Replicad, and the OpenCascade `.wasm` bundle** all come from `node_modules` and are emitted into your dev server or `dist/`; the app does not pull scripts from CDNs or third-party URLs at runtime.
- **`npm install`** is the only step that uses the network, to download packages; after that you can work offline. To serve the built app locally: `npm run build` then `npm run preview` (or any static file server pointed at `dist/`).

## Project layout

| Path | Role |
|------|------|
| [`cad/components/`](cad/components/) | Reusable solids: **house**, **pergola**, **ground**, shared **houseLayout** (corners + extension layout). |
| [`cad/project/examples/`](cad/project/examples/) | One file per **scene** (e.g. **`patio`**, **`minimal-cube`**); auto-registered by [`cad/project/registry.ts`](cad/project/registry.ts). |
| [`cad/project/types.ts`](cad/project/types.ts) | `ExampleMeta`, `ExampleParamsSchema`, `ParamField`. |
| [`cad/project/exampleParams.ts`](cad/project/exampleParams.ts) | `mergeExampleParams`, `EMPTY_EXAMPLE_PARAM_SCHEMA`. |
| [`cad/deriveJunctions.ts`](cad/deriveJunctions.ts) | Derives labeled junction points from scene bounding boxes. |
| [`src/worker.ts`](src/worker.ts) | WASM + `createMesh` / `listExamples`. |
| [`src/main.ts`](src/main.ts) | Three.js scene, camera, mesh sync. |
| [`src/toolbar.ts`](src/toolbar.ts) | Scene picker + view toggles. |
| [`src/paramPanel.ts`](src/paramPanel.ts) | Dynamic form from each example’s `exampleParamSchema`. |
| [`src/compass.ts`](src/compass.ts), [`src/junctions.ts`](src/junctions.ts), [`src/tooltips.ts`](src/tooltips.ts) | Orientation overlay, junction columns, part hover. |
| [`docs/ui-behavior.md`](docs/ui-behavior.md) | Viewer UI contract: canvas orbit vs orientation panel. |

**Default scene** is **`patio`** (`defaultExampleId` in [`cad/project/registry.ts`](cad/project/registry.ts)). Add a file under `cad/project/examples/`, export `buildScene` and optional `exampleParamSchema`, save — Vite HMR reloads. See [`cad/project/README.md`](cad/project/README.md) for the full example contract.

## Export

For STL/STEP from code, see Replicad’s [use as a library](https://replicad.xyz/docs/use-as-a-library/) (e.g. `blobSTL()` on shapes in a worker or Node context). This scaffold focuses on the live preview.

## Dependencies

Versions are pinned in [`package.json`](package.json). To refresh packages later:

```bash
npx npm-check-updates -u && npm install
```

## Troubleshooting

- If WASM fails to load, ensure `npm run dev` is serving from the project root and that no ad-blocker strips `.wasm` requests.
- **Vite** may log that Node built-ins were externalized when bundling `replicad-opencascadejs`; that is expected for browser builds.

## Other stacks

For `.scad` + editor preview, use **OpenSCAD** with the **OpenSCAD Language Support** VS Code extension. For pure JS CSG without OpenCascade, see **JSCAD**.
