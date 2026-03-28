/** Serialized metadata for one CAD example (safe to send main ↔ worker). */
export type ExampleMeta = {
  id: string;
  title: string;
  description?: string;
};

/** One numeric field for the viewer parameter form (feet unless noted in the label). */
export type ParamField = {
  id: string;
  label: string;
  min?: number;
  max?: number;
  step?: number;
  default: number;
};

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
