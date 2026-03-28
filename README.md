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

## Local-first runtime (no remote scripts)

- **HTML** loads a single local module entry (`/src/main.ts` in dev, hashed `./assets/*.js` after `npm run build`).
- **Three.js, Comlink, Replicad, and the OpenCascade `.wasm` bundle** all come from `node_modules` and are emitted into your dev server or `dist/`; the app does not pull scripts from CDNs or third-party URLs at runtime.
- **`npm install`** is the only step that uses the network, to download packages; after that you can work offline. To serve the built app locally: `npm run build` then `npm run preview` (or any static file server pointed at `dist/`).

## Project layout

| Path | Role |
|------|------|
| [`cad/`](cad/) | All CAD modeling code: [`cad/components`](cad/components) (reusable shapes) and [`cad/project`](cad/project) (scenes + registry). |
| [`cad/project/examples/`](cad/project/examples/) | One `.ts` file per **scene**; auto-registered by [`cad/project/registry.ts`](cad/project/registry.ts). |
| [`src/worker.ts`](src/worker.ts) | Loads OpenCascade WASM; `listExamples` + `createMesh(id)` via [Comlink](https://github.com/GoogleChromeLabs/comlink). |
| [`src/main.ts`](src/main.ts) | Three.js viewer, example picker, `?example=` URL sync. |
| [`docs/ui-behavior.md`](docs/ui-behavior.md) | **Viewer UI contract:** canvas (3D orbit) vs scene orientation panel (plan drag)—how they must not fight. |

Add a file under `cad/project/examples/`, save, and choose it from the **Example** dropdown (or open `?example=your-id`). The default scene is **`patio`** (see `defaultExampleId` in [`cad/project/registry.ts`](cad/project/registry.ts)). Vite HMR reloads when you edit an example.

## Export

For STL/STEP from code, see Replicad’s [use as a library](https://replicad.xyz/docs/use-as-a-library/) (e.g. `blobSTL()` on shapes in a worker or Node context). This scaffold focuses on the live preview.

## Dependencies (pinned to latest stable at install time)

Check [`package.json`](package.json) for exact versions. To refresh everything later:

```bash
npx npm-check-updates -u && npm install
```

## Troubleshooting

- If WASM fails to load, ensure `npm run dev` is serving from the project root and that no ad-blocker strips `.wasm` requests.
- **Vite** may log that Node built-ins were externalized when bundling `replicad-opencascadejs`; that is expected for browser builds.

## Other stacks

For `.scad` + editor preview, use **OpenSCAD** with the **OpenSCAD Language Support** VS Code extension. For pure JS CSG without OpenCascade, see **JSCAD**.
