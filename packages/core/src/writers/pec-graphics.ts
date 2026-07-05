/**
 * PEC 48×38 1-bit thumbnail graphics — port of pyembroidery/PecGraphics.py.
 * The blank frame template is GENERATED from pyembroidery (never hand-copied).
 */
import { PEC_BLANK } from '../charts/pec-blank';

export function getBlank(): number[] {
  return [...PEC_BLANK];
}

/** Python list-index semantics: one negative wrap, out-of-range is skipped. */
function markBit(graphic: number[], x: number, y: number, stride: number): void {
  let index = y * stride + Math.trunc(x / 8);
  if (index < 0) index += graphic.length;
  if (index < 0 || index >= graphic.length) return; // IndexError parity
  graphic[index] = graphic[index]! | (1 << (((x % 8) + 8) % 8));
}

export interface GraphicExtents {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export function drawScaled(
  extents: GraphicExtents,
  points: Array<{ x: number; y: number }>,
  graphic: number[],
  stride: number,
  buffer = 5,
): void {
  const { left, top, right, bottom } = extents;
  let diagramWidth = right - left;
  let diagramHeight = bottom - top;
  const graphicWidth = stride * 8;
  const graphicHeight = graphic.length / stride;
  if (diagramWidth === 0) diagramWidth = 1;
  if (diagramHeight === 0) diagramHeight = 1;
  const scaleX = (graphicWidth - buffer) / diagramWidth;
  const scaleY = (graphicHeight - buffer) / diagramHeight;
  const scale = Math.min(scaleX, scaleY);
  const cx = (right + left) / 2;
  const cy = (bottom + top) / 2;
  let translateX = -cx * scale + graphicWidth / 2;
  let translateY = -cy * scale + graphicHeight / 2;
  for (const point of points) {
    markBit(
      graphic,
      Math.floor(point.x * scale + translateX),
      Math.floor(point.y * scale + translateY),
      stride,
    );
  }
}
