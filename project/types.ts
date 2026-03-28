/** Serialized metadata for one CAD example (safe to send main ↔ worker). */
export type ExampleMeta = {
  id: string;
  title: string;
  description?: string;
};
