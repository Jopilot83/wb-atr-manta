import type { EnvelopePoint, Index, Kg } from "./types.js";

/** Point-in-polygon for envelope checks in (weightKg, index) space. */
export function pointInPolygon(weightKg: Kg, index: Index, poly: EnvelopePoint[]): boolean {
  // Ray casting algorithm
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].weightKg, yi = poly[i].index;
    const xj = poly[j].weightKg, yj = poly[j].index;
    const intersect =
      ((yi > index) !== (yj > index)) &&
      (weightKg < (xj - xi) * (index - yi) / (yj - yi + 0.0) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Safe numeric helper */
export function n(v: unknown, fallback = 0): number {
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : fallback;
}
