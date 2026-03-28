# Pergola — Replicad playground

**Goal:** Define geometry in TypeScript and preview it in the browser (OpenCascade WASM + Three.js).

## Prerequisites

- [Node.js](https://nodejs.org/) LTS (v20+ recommended)

## Setup

From this directory:

```bash
npm install
npm run dev
```

Open the URL Vite prints (default `http://localhost:5173`). Orbit: drag to rotate, scroll to zoom.

## Project layout

| Path | Role |
|------|------|
| [`src/cad.ts`](src/cad.ts) | Parametric model: house + pergola assembly (`buildScene`). |
| [`src/worker.ts`](src/worker.ts) | Loads OpenCascade WASM, exposes mesh generation via [Comlink](https://github.com/GoogleChromeLabs/comlink). |
| [`src/main.ts`](src/main.ts) | Three.js scene, lighting, and `replicad-threejs-helper` sync. |

Edit `cad.ts`, save, and refresh (or rely on Vite HMR where applicable) to see changes.

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
