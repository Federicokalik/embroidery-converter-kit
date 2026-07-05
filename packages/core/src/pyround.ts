/**
 * Python's round() semantics: round-half-to-EVEN (banker's rounding) on the
 * IEEE754 double. JS Math.round rounds half away from zero upward — the two
 * disagree on every exact .5, which would break byte-identity with the
 * pyembroidery-generated golden files whenever the encoder rounds
 * coordinates.
 */
export function pyround(v: number): number {
  const floor = Math.floor(v);
  const diff = v - floor;
  if (diff < 0.5) return floor;
  if (diff > 0.5) return floor + 1;
  return floor % 2 === 0 ? floor : floor + 1;
}
