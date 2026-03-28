/**
 * A reference location in scene space (feet, Z-up). Used for junctions between volumes, corners,
 * and other labels — often shown as small markers in the viewer.
 */
export type NamedScenePoint = {
  /** Stable id (e.g. for logs or future APIs). */
  id: string;
  /** Full label for tooltips (may include part names and N/S/E/W). */
  label: string;
  position: [number, number, number];
  /** Optional Z extent for junction columns: column spans zMin..zMax. */
  zMin?: number;
  zMax?: number;
};
