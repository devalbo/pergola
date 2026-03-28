import { expose } from "comlink";
import type { OpenCascadeInstance } from "replicad-opencascadejs";
import opencascade from "replicad-opencascadejs/src/replicad_single.js";
import opencascadeWasm from "replicad-opencascadejs/src/replicad_single.wasm?url";
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

function resolveExampleId(requested?: string): string {
  if (requested && getExampleById(requested)) return requested;
  return defaultExampleId;
}

function createMesh(exampleId?: string): Promise<MeshPayload> {
  return started.then(() => {
    const id = resolveExampleId(exampleId);
    const ex = getExampleById(id);
    if (!ex) {
      throw new Error(`Unknown example: ${exampleId ?? "(none)"}`);
    }
    const shape = ex.buildScene();
    return {
      faces: shape.mesh(),
      edges: shape.meshEdges(),
    };
  });
}

function listExamples(): ExampleMeta[] {
  return examples.map(({ id, title, description }) => ({ id, title, description }));
}

expose({ createMesh, listExamples });
