# CAD (`cad/`)

All modeling code for this app lives here:

| Subfolder | Role |
|-----------|------|
| [`components/`](components/) | Reusable parts — `buildHouse()`, `buildPergola()`, … |
| [`project/`](project/) | Scene examples, `registry.ts`, and shared `types.ts` |

The Vite app under [`src/`](../src) only handles the viewer; the worker imports [`project/registry.ts`](project/registry.ts) to list and build scenes.
