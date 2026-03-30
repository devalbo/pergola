import { expose } from "comlink";
import type { OpenCascadeInstance } from "replicad-opencascadejs";
import opencascade from "replicad-opencascadejs/src/replicad_single.js";
import opencascadeWasm from "replicad-opencascadejs/src/replicad_single.wasm?url";
import type { Shape3D } from "replicad";
import { setOC } from "replicad";
import type { ExampleDefinition } from "../cad/project/registry";
import { defaultExampleId, examples, getExampleById } from "../cad/project/registry";
import { mergeExampleParams } from "../cad/project/exampleParams";
import type { BuildSceneOptions, ExampleListItem } from "../cad/project/types";
import type { NamedScenePoint } from "../cad/namedScenePoint";

type OpencascadeModule = (opts?: {
  locateFile?: (file: string) => string;
}) => Promise<OpenCascadeInstance>;

let loaded = false;
const init = async (): Promise<boolean> => {
  if (loaded) return true;
  console.log("[cad:worker] OpenCascade WASM loading…");
  const t0 = performance.now();
  const OC = await (opencascade as OpencascadeModule)({
    locateFile: () => opencascadeWasm,
  });
  console.log("[cad:worker] OpenCascade init done", (performance.now() - t0).toFixed(0), "ms");
  loaded = true;
  setOC(OC);
  return true;
};

const started = init();

type Built = ReturnType<ExampleDefinition["buildScene"]>;

export type MeshPayload = {
  faces: ReturnType<Built["mesh"]>;
  edges: ReturnType<Built["meshEdges"]>;
};

export type MeshResult =
  | { kind: "single"; payload: MeshPayload; partLabel?: string; namedPoints: NamedScenePoint[] }
  | {
      kind: "parts";
      parts: MeshPayload[];
      colors: number[];
      partNames?: string[];
      partAnimations?: (string | null)[];
      namedPoints: NamedScenePoint[];
    };

export type { NamedScenePoint };

function meshPayloadFromShape(shape: Shape3D, exampleId: string): MeshPayload {
  const t0 = performance.now();
  const faces = shape.mesh();
  console.log("[cad:worker]", exampleId, "shape.mesh()", (performance.now() - t0).toFixed(1), "ms");
  const t1 = performance.now();
  const edges = shape.meshEdges();
  console.log("[cad:worker]", exampleId, "shape.meshEdges()", (performance.now() - t1).toFixed(1), "ms");
  return { faces, edges };
}

function resolveExampleId(requested?: string): string {
  if (requested && getExampleById(requested)) return requested;
  return defaultExampleId;
}

function createMesh(
  exampleId?: string,
  paramValues?: Record<string, number>,
  sceneOptions?: BuildSceneOptions,
): Promise<MeshResult> {
  return started.then(() => {
    const id = resolveExampleId(exampleId);
    const ex = getExampleById(id);
    if (!ex) {
      throw new Error(`Unknown example: ${exampleId ?? "(none)"}`);
    }

    const merged = mergeExampleParams(ex.paramSchema, paramValues);
    console.log("[cad:worker] createMesh start", { id, merged });

    const namedPoints: NamedScenePoint[] = ex.sceneNamedPoints?.(merged) ?? [];

    if (
      ex.buildSceneParts &&
      ex.scenePartColors &&
      ex.scenePartColors.length > 0
    ) {
      const tParts = performance.now();
      const shapes = ex.buildSceneParts(merged);
      console.log("[cad:worker]", id, "buildSceneParts()", (performance.now() - tParts).toFixed(1), "ms");
      const n = Math.min(shapes.length, ex.scenePartColors.length);
      const parts = shapes.slice(0, n).map((s) => meshPayloadFromShape(s, id));
      const colors = ex.scenePartColors.slice(0, n);
      const partNames = ex.scenePartNames?.slice(0, n);
      const partAnimations = ex.scenePartAnimations?.slice(0, n);
      return { kind: "parts", parts, colors, partNames, partAnimations, namedPoints };
    }

    const tBuild = performance.now();
    const shape = ex.buildScene(merged, sceneOptions);
    console.log("[cad:worker]", id, "buildScene()", (performance.now() - tBuild).toFixed(1), "ms");
    return {
      kind: "single",
      payload: meshPayloadFromShape(shape, id),
      partLabel: ex.title,
      namedPoints,
    };
  });
}

function listExamples(): { examples: ExampleListItem[]; defaultId: string } {
  return {
    examples: examples.map((e) => ({
      id: e.id,
      title: e.title,
      description: e.description,
      paramSchema: e.paramSchema,
    })),
    defaultId: defaultExampleId,
  };
}

expose({ createMesh, listExamples });
