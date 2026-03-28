# Shape components (`cad/components/`)

Reusable **parametric parts** (house, pergola, …) that **scenes** under [`../project/examples/`](../project/examples) import, tweak, and fuse.

## Conventions

- Each file exports one or more **`build…()`** functions returning **`Shape3D`**.
- Prefer a **`default…Params`** or **`default…Layout`** object plus **`Partial<>`** overrides so scenes can adjust placement without copying geometry code.
- Keep **low-level boxes/wires** inside the component; **scenes** decide how to combine (`fuse`, future `cut`, etc.).

## Add a component

1. Create **`cad/components/my-part.ts`** with `buildMyPart(overrides?: Partial<…>)`.
2. Re-export from [`index.ts`](index.ts) if you want a stable import path from scenes: `from "../../components"`.

## Used by

[`../project/examples/patio.ts`](../project/examples/patio.ts) — `buildHouse()` + `buildPergola()` fused into one outdoor scene.
