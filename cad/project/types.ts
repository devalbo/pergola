/** Serialized metadata for one CAD example (safe to send main ↔ worker). */
export type ExampleMeta = {
  id: string;
  title: string;
  description?: string;
};

/** Numeric field for the viewer parameter form. */
export type ParamFieldNumber = {
  kind?: "number";
  id: string;
  label: string;
  min?: number;
  max?: number;
  step?: number;
  default: number;
};

/** Dropdown field; values are still serialized as numbers for the worker. */
export type ParamFieldChoice = {
  kind: "choice";
  id: string;
  label: string;
  default: number;
  options: { value: number; label: string }[];
};

export type ParamField = ParamFieldNumber | ParamFieldChoice;

/** Declares interactive inputs for an example; used by the toolbar parameter panel. */
export type ExampleParamsSchema = {
  fields: ParamField[];
};

export function defaultParamValues(schema: ExampleParamsSchema): Record<string, number> {
  const o: Record<string, number> = {};
  for (const f of schema.fields) o[f.id] = f.default;
  return o;
}

/** One row in `listExamples()` for the viewer (metadata + parameter form schema; may be empty). */
export type ExampleListItem = ExampleMeta & {
  paramSchema: ExampleParamsSchema;
};

/** Optional data passed main → worker with `createMesh` (reserved for examples that need it). */
export type BuildSceneOptions = {
  svgMarkup?: string;
};
