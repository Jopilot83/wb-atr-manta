import type { EnvelopePoint } from "../types.ts";

/**
 * Ray casting algorithm
 * X = weight, Y = index
 */
export function isPointInsideEnvelope(
  weightKg: number,
  index: number,
  envelope: EnvelopePoint[]
): boolean {
  if (!envelope || envelope.length < 3) return false;

  let inside = false;

  for (let i = 0, j = envelope.length - 1; i < envelope.length; j = i++) {
    const xi = envelope[i].weightKg;
    const yi = envelope[i].index;
    const xj = envelope[j].weightKg;
    const yj = envelope[j].index;

    const intersect =
      yi > index !== yj > index &&
      weightKg <
        ((xj - xi) * (index - yi)) / (yj - yi) + xi;

    if (intersect) inside = !inside;
  }

  return inside;
}