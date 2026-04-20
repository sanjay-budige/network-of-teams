import { NODE_DRAG_MAX_PX } from "./constants.js";

export function clampNodeDrag(dx, dy, max = NODE_DRAG_MAX_PX) {
  const L = Math.hypot(dx, dy);
  if (L <= max || L === 0) return { dx, dy };
  const s = max / L;
  return { dx: dx * s, dy: dy * s };
}

/** Apply user nudges so links and nodes stay aligned after dragging. */
export function applyDragToPositions(positions, offsets) {
  const out = {};
  for (const id of Object.keys(positions)) {
    const p = positions[id];
    const o = offsets[id];
    const d = o ? clampNodeDrag(o.dx, o.dy) : { dx: 0, dy: 0 };
    out[id] = { ...p, x: p.x + d.dx, y: p.y + d.dy };
  }
  return out;
}
