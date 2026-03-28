import type { Shape3D } from "replicad";
import type { ExampleMeta } from "./types";

export type ExampleDefinition = ExampleMeta & {
  buildScene: () => Shape3D;
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

  return {
    id: meta?.id ?? slug,
    title: meta?.title ?? slug,
    description: meta?.description,
    buildScene: buildScene as () => Shape3D,
  };
}

/** Every module under project/examples/*.ts that exports buildScene() is registered here. */
export const examples: ExampleDefinition[] = Object.entries(modules)
  .map(([path, mod]) => toDefinition(path, mod))
  .filter((x): x is ExampleDefinition => x !== null)
  .sort((a, b) => a.id.localeCompare(b.id));

export const defaultExampleId: string =
  examples.find((e) => e.id === "pergola-and-house")?.id ?? examples[0]?.id ?? "";

export function getExampleById(id: string): ExampleDefinition | undefined {
  return examples.find((e) => e.id === id);
}
