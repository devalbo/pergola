import { expose } from "comlink";
import type { OpenCascadeInstance } from "replicad-opencascadejs";
import opencascade from "replicad-opencascadejs/src/replicad_single.js";
import opencascadeWasm from "replicad-opencascadejs/src/replicad_single.wasm?url";
import type { Shape3D } from "replicad";
import { setOC } from "replicad";
import type { ExampleDefinition } from "../cad/project/registry";
import { defaultExampleId, examples, getExampleById } from "../cad/project/registry";
import type { ExampleMeta } from "../cad/project/types";

type OpencascadeModule = (opts?: {
  locateFile?: (file: string) => string;
}) => Promise<OpenCascadeInstance>;

let loaded = false;
const init = async (): Promise<boolean> => {
  if (loaded) return true;
  const OC = await (opencascade as OpencascadeModule)({
    locateFile: () => opencascadeWasm,
  });
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
  | { kind: "single"; payload: MeshPayload }
  | { kind: "parts"; parts: MeshPayload[]; colors: number[] };

function meshPayloadFromShape(shape: Shape3D): MeshPayload {
  return {
    faces: shape.mesh(),
    edges: shape.meshEdges(),
  };
}

function resolveExampleId(requested?: string): string {
  if (requested && getExampleById(requested)) return requested;
  return defaultExampleId;
}

function createMesh(exampleId?: string): Promise<MeshResult> {
  return started.then(() => {
    const id = resolveExampleId(exampleId);
    const ex = getExampleById(id);
    if (!ex) {
      throw new Error(`Unknown example: ${exampleId ?? "(none)"}`);
    }

    if (
      ex.buildSceneParts &&
      ex.scenePartColors &&
      ex.scenePartColors.length > 0
    ) {
      const shapes = ex.buildSceneParts();
      const n = Math.min(shapes.length, ex.scenePartColors.length);
      const parts = shapes.slice(0, n).map((s) => meshPayloadFromShape(s));
      const colors = ex.scenePartColors.slice(0, n);
      return { kind: "parts", parts, colors };
    }

    const shape = ex.buildScene();
    return { kind: "single", payload: meshPayloadFromShape(shape) };
  });
}

function listExamples(): { examples: ExampleMeta[]; defaultId: string } {
  return {
    examples: examples.map(({ id, title, description }) => ({ id, title, description })),
    defaultId: defaultExampleId,
  };
}

expose({ createMesh, listExamples });
