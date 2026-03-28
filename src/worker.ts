import { expose } from "comlink";
import type { OpenCascadeInstance } from "replicad-opencascadejs";
import opencascade from "replicad-opencascadejs/src/replicad_single.js";
import opencascadeWasm from "replicad-opencascadejs/src/replicad_single.wasm?url";
import { setOC } from "replicad";
import { buildScene } from "./cad";

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

export type MeshPayload = {
  faces: ReturnType<ReturnType<typeof buildScene>["mesh"]>;
  edges: ReturnType<ReturnType<typeof buildScene>["meshEdges"]>;
};

function createMesh(): Promise<MeshPayload> {
  return started.then(() => {
    const shape = buildScene();
    return {
      faces: shape.mesh(),
      edges: shape.meshEdges(),
    };
  });
}

expose({ createMesh });
