/**
 * **Project length units: feet.** Every coordinate and numeric dimension in `cad/` is in **feet**
 * unless a comment says otherwise (e.g. Three.js colors). `1` = 1 ft.
 */
export const LENGTH_UNIT = "ft" as const;

/** Convert inches to feet (for readable call sites: `inches(6)` → 0.5 ft). */
export function inches(n: number): number {
  return n / 12;
}
