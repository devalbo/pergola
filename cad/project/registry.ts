import type { Shape3D } from "replicad";
import type { NamedScenePoint } from "../namedScenePoint";
import type { ExampleMeta } from "./types";

export type ExampleDefinition = ExampleMeta & {
  buildScene: () => Shape3D;
  /** When set with `scenePartColors`, the viewer meshes parts separately for materials. */
  buildSceneParts?: () => Shape3D[];
  scenePartColors?: number[];
  /** Labels for hover tooltips; same order and length as `buildSceneParts` / `scenePartColors`. */
  scenePartNames?: string[];
  /** Per-part animation effects (null = static); same order as `buildSceneParts`. */
  scenePartAnimations?: (string | null)[];
  /** Junction / reference points (feet); see `cad/sceneOrientation.ts` for N/S/E/W. */
  sceneNamedPoints?: () => NamedScenePoint[];
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

  return {
    id: meta?.id ?? slug,
    title: meta?.title ?? slug,
    description: meta?.description,
    buildScene: buildScene as () => Shape3D,
    buildSceneParts:
      typeof buildSceneParts === "function" ? (buildSceneParts as () => Shape3D[]) : undefined,
    scenePartColors: Array.isArray(scenePartColors)
      ? (scenePartColors as number[])
      : undefined,
    scenePartNames: Array.isArray(scenePartNames) ? (scenePartNames as string[]) : undefined,
    scenePartAnimations: Array.isArray(scenePartAnimations)
      ? (scenePartAnimations as (string | null)[])
      : undefined,
    sceneNamedPoints:
      typeof sceneNamedPoints === "function"
        ? (sceneNamedPoints as () => NamedScenePoint[])
        : undefined,
  };
}

/** Every module under cad/project/examples/*.ts that exports buildScene() is registered here. */
export const examples: ExampleDefinition[] = Object.entries(modules)
  .map(([path, mod]) => toDefinition(path, mod))
  .filter((x): x is ExampleDefinition => x !== null)
  .sort((a, b) => a.id.localeCompare(b.id));

export const defaultExampleId: string =
  examples.find((e) => e.id === "patio")?.id ?? examples[0]?.id ?? "";

export function getExampleById(id: string): ExampleDefinition | undefined {
  return examples.find((e) => e.id === id);
}
