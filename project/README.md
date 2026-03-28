# CAD examples (`project/`)

All sample models live here so you can grow the repo without touching the viewer shell.

## Add a new example

1. Create **`project/examples/your-name.ts`** (use a **kebab-case** file name; it becomes the default `id` if you omit `exampleMeta`).
2. Export:
   - **`exampleMeta`** (optional but recommended): `{ id, title, description? }`  
     If `id` is omitted, the file name without `.ts` is used.
   - **`buildScene()`** → returns a Replicad **`Shape3D`** (fuse your solids as needed).

3. Save the file. The app uses **`import.meta.glob`** in [`registry.ts`](registry.ts) to pick up every `examples/*.ts` module — no manual list to edit.

## Layout

| Path | Purpose |
|------|---------|
| [`types.ts`](types.ts) | Shared `ExampleMeta` type. |
| [`registry.ts`](registry.ts) | Auto-loads `./examples/*.ts` and exposes `examples`, `getExampleById`, `defaultExampleId`. |
| [`examples/`](examples/) | One file per example. |

The **worker** imports the registry; the **main** thread only asks the worker for the list and meshes (no OpenCascade on the UI thread).
