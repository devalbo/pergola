# CAD (`cad/`)

All modeling code for this app lives here:

| Subfolder | Role |
|-----------|------|
| [`components/`](components/) | Reusable parts — `buildHouse()`, `buildPergola()`, … |
| [`images/`](images/) | Static assets for CAD/viewer (e.g. SVG). Import from `src/` with `…/cad/images/file.svg?url` so Vite emits a URL. |
| [`project/`](project/) | Scene examples, `registry.ts`, and shared `types.ts` |

The Vite app under [`src/`](../src) only handles the viewer; the worker imports [`project/registry.ts`](project/registry.ts) to list and build scenes.
