function distancePointToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;

  if (dx === 0 && dy === 0) {
    return Math.hypot(px - x1, py - y1);
  }

  const t =
    ((px - x1) * dx + (py - y1) * dy) /
    (dx * dx + dy * dy);

  const clamped = Math.max(0, Math.min(1, t));

  const projX = x1 + clamped * dx;
  const projY = y1 + clamped * dy;

  return Math.hypot(px - projX, py - projY);
}

export function envelopeMargin(
  point: { weightKg: number; index: number },
  envelope: Array<{ weightKg: number; index: number }>,
  inside: boolean
): number {
  let minDist = Infinity;

  for (let i = 0; i < envelope.length; i++) {
    const a = envelope[i];
    const b = envelope[(i + 1) % envelope.length];

    const d = distancePointToSegment(
      point.weightKg,
      point.index,
      a.weightKg,
      a.index,
      b.weightKg,
      b.index
    );

    if (d < minDist) minDist = d;
  }

  return inside ? minDist : -minDist;
}