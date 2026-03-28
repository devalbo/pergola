import type { ExampleParamsSchema } from "./types";
import { defaultParamValues } from "./types";

/** Use when an example has no tunable fields; the viewer hides the Parameters control. */
export const EMPTY_EXAMPLE_PARAM_SCHEMA: ExampleParamsSchema = { fields: [] };

/**
 * Merge viewer overrides onto schema defaults. Every example should resolve inputs through this
 * (or pass the result into `buildScene` / `buildSceneParts` / `sceneNamedPoints`).
 */
export function mergeExampleParams(
  schema: ExampleParamsSchema,
  overrides?: Record<string, number>,
): Record<string, number> {
  return { ...defaultParamValues(schema), ...overrides };
}
