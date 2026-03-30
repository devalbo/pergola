import type { Shape3D } from "replicad";
import type { NamedScenePoint } from "../namedScenePoint";
import { EMPTY_EXAMPLE_PARAM_SCHEMA } from "./exampleParams";
import type { BuildSceneOptions, ExampleMeta, ExampleParamsSchema } from "./types";

export type ExampleDefinition = ExampleMeta & {
  /** Always pass merged params from {@link mergeExampleParams} in the worker (see `cad/project/exampleParams.ts`). */
  buildScene: (paramValues?: Record<string, number>, options?: BuildSceneOptions) => Shape3D;
  /** When set with `scenePartColors`, the viewer meshes parts separately for materials. */
  buildSceneParts?: (paramValues?: Record<string, number>) => Shape3D[];
  scenePartColors?: number[];
  /** Labels for hover tooltips; same order and length as `buildSceneParts` / `scenePartColors`. */
  scenePartNames?: string[];
  /** Per-part animation effects (null = static); same order as `buildSceneParts`. */
  scenePartAnimations?: (string | null)[];
  /** Junction / reference points (feet); see `cad/sceneOrientation.ts` for N/S/E/W. */
  sceneNamedPoints?: (paramValues?: Record<string, number>) => NamedScenePoint[];
  /** Declares the parameter form (`fields: []` hides the UI control). */
  paramSchema: ExampleParamsSchema;
};

const modules = import.meta.glob("./examples/*.ts", { eager: true }) as Record<
  string,
  Record<string, unknown>
>;

function toDefinition(path: string, mod: Record<string, unknown>): ExampleDefinition | null {
  const buildScene = mod.buildScene;
  if (typeof buildScene !== "function") {
    console.warn(`[project] Skipping ${path}: export a buildScene() function.`);
    return null;
  }

  const slug = path.replace(/^\.\/examples\//, "").replace(/\.ts$/, "");
  const meta = mod.exampleMeta as Partial<ExampleMeta> | undefined;

  const buildSceneParts = mod.buildSceneParts;
  const scenePartColors = mod.scenePartColors;
  const scenePartNames = mod.scenePartNames;
  const scenePartAnimations = mod.scenePartAnimations;
  const sceneNamedPoints = mod.sceneNamedPoints;
  const paramSchema = mod.exampleParamSchema as ExampleParamsSchema | undefined;

  return {
    id: meta?.id ?? slug,
    title: meta?.title ?? slug,
    description: meta?.description,
    buildScene: buildScene as (paramValues?: Record<string, number>, options?: BuildSceneOptions) => Shape3D,
    buildSceneParts:
      typeof buildSceneParts === "function"
        ? (buildSceneParts as (paramValues?: Record<string, number>) => Shape3D[])
        : undefined,
    paramSchema:
      paramSchema && Array.isArray(paramSchema.fields)
        ? (paramSchema as ExampleParamsSchema)
        : EMPTY_EXAMPLE_PARAM_SCHEMA,
    scenePartColors: Array.isArray(scenePartColors)
      ? (scenePartColors as number[])
      : undefined,
    scenePartNames: Array.isArray(scenePartNames) ? (scenePartNames as string[]) : undefined,
    scenePartAnimations: Array.isArray(scenePartAnimations)
      ? (scenePartAnimations as (string | null)[])
      : undefined,
    sceneNamedPoints:
      typeof sceneNamedPoints === "function"
        ? (sceneNamedPoints as (paramValues?: Record<string, number>) => NamedScenePoint[])
        : undefined,
  };
}

/** Every module under cad/project/examples/*.ts that exports buildScene() is registered here. */
export const examples: ExampleDefinition[] = Object.entries(modules)
  .map(([path, mod]) => toDefinition(path, mod))
  .filter((x): x is ExampleDefinition => x !== null)
  .sort((a, b) => a.id.localeCompare(b.id));

export const defaultExampleId: string =
  examples.find((e) => e.id === "coaster-shaped")?.id ?? examples[0]?.id ?? "";

export function getExampleById(id: string): ExampleDefinition | undefined {
  return examples.find((e) => e.id === id);
}
