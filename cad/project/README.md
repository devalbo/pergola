# CAD examples (`cad/project/`)

Scenes live here: each example **imports shapes from [`../components/`](../components)**, optionally overrides parameters, and **`fuse`s** (or otherwise combines) them into `buildScene()`.

## Add a new example

1. Create **`cad/project/examples/your-name.ts`** (use a **kebab-case** file name; it becomes the default `id` if you omit `exampleMeta`).
2. Export:
   - **`exampleMeta`** (optional but recommended): `{ id, title, description? }`  
     If `id` is omitted, the file name without `.ts` is used.
   - **`exampleParamSchema`** — `{ fields: ParamField[] }` for the Parameters panel. Use [`EMPTY_EXAMPLE_PARAM_SCHEMA`](exampleParams.ts) when there is nothing to edit (`fields: []` hides the toolbar control).
   - **`buildScene(paramValues?)`** → returns a **`Shape3D`**. Resolve inputs with [`mergeExampleParams`](exampleParams.ts)(`exampleParamSchema`, `paramValues`) so defaults match the schema.
   - If you split parts for materials, also export **`buildSceneParts(paramValues?)`** and **`sceneNamedPoints(paramValues?)`** using the same merged record.

3. Save the file. The app uses **`import.meta.glob`** in [`registry.ts`](registry.ts) to pick up every `examples/*.ts` module — no manual list to edit.

## Layout

| Path | Purpose |
|------|---------|
| [`types.ts`](types.ts) | Shared `ExampleMeta`, `ExampleParamsSchema`, `ParamField`. |
| [`exampleParams.ts`](exampleParams.ts) | `mergeExampleParams`, `EMPTY_EXAMPLE_PARAM_SCHEMA`. |
| [`registry.ts`](registry.ts) | Auto-loads `./examples/*.ts` and exposes `examples`, `getExampleById`, `defaultExampleId`. |
| [`examples/`](examples/) | One file per **scene** (e.g. `patio` = house + pergola). |
| [`../components/`](../components) | Reusable **`buildHouse`**, **`buildPergola`**, etc. |

The **worker** imports the registry; the **main** thread only asks the worker for the list and meshes (no OpenCascade on the UI thread).
