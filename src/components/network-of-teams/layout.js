import { ORG_ROOT_ID } from "./constants.js";
import { TEAM_PARENT_ORDER, TEAM_SPECS } from "./data/graphData.js";

export function clipLineToCircles(x1, y1, r1, x2, y2, r2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  return {
    x1: x1 + ux * r1,
    y1: y1 + uy * r1,
    x2: x2 - ux * r2,
    y2: y2 - uy * r2,
  };
}

export function curvedChordPath(x1, y1, r1, x2, y2, r2, hubCx, hubCy, minDim, bulgeFactor = 1) {
  const seg = clipLineToCircles(x1, y1, r1, x2, y2, r2);
  const mx = (seg.x1 + seg.x2) / 2;
  const my = (seg.y1 + seg.y2) / 2;
  let ux = mx - hubCx;
  let uy = my - hubCy;
  const d = Math.hypot(ux, uy) || 1;
  ux /= d;
  uy /= d;
  const bulge = Math.max(40, minDim * 0.068) * bulgeFactor;
  const qx = mx + ux * bulge;
  const qy = my + uy * bulge;
  return `M${seg.x1},${seg.y1} Q${qx},${qy} ${seg.x2},${seg.y2}`;
}

export function layoutTeamNodes(teamNodes, cx, cy, minDim, expandedOrgId) {
  /** Division ring — slightly farther from hub for clearer org → division hierarchy. */
  const R1 = minDim * 0.545;
  /** Leaf ring base — pushed out so sub-teams sit clearly beyond their division hex. */
  const R2 = minDim * 0.925;
  const hubR = Math.max(68, minDim * 0.086);
  const divR = 32;
  const leafR = 22;  
  const positions = { [ORG_ROOT_ID]: { x: cx, y: cy, r: hubR } };

  const inSet = new Set(teamNodes.map((t) => t.id));
  const orphans = teamNodes.filter((t) => !t.parentId || !inSet.has(t.parentId));
  const roots = [...new Map(orphans.map((r) => [r.id, r])).values()].sort((a, b) => {
    const ia = TEAM_PARENT_ORDER.indexOf(a.id);
    const ib = TEAM_PARENT_ORDER.indexOf(b.id);
    if (ia >= 0 && ib >= 0) return ia - ib;
    if (ia >= 0) return -1;
    if (ib >= 0) return 1;
    return a.label.localeCompare(b.label);
  });

  roots.forEach((root, i) => {
    const angle = (2 * Math.PI * i) / Math.max(roots.length, 1) - Math.PI / 2;
    positions[root.id] = { x: cx + R1 * Math.cos(angle), y: cy + R1 * Math.sin(angle), r: divR, angle };

    if (expandedOrgId !== root.id) return;

    const kids = teamNodes.filter((t) => t.parentId === root.id);
    const n = kids.length;
    const R2_BASE = R2;
    const LEAF_RING_STEP = minDim * 0.076 + 38;
    const MAX_LEAF_PER_RING = 9;

    kids.forEach((child, j) => {
      const ring = Math.floor(j / MAX_LEAF_PER_RING);
      const idxInRing = j % MAX_LEAF_PER_RING;
      const inRing = Math.min(MAX_LEAF_PER_RING, n - ring * MAX_LEAF_PER_RING);
      const Rleaf = R2_BASE + ring * LEAF_RING_STEP;
      const minGap =
        2 *
        Math.asin(Math.min(0.95, (leafR * 2 + 26) / Math.max(2 * Rleaf, 0.001)));
      let angleStep = 0;
      if (inRing > 1) {
        const needed = (inRing - 1) * minGap;
        const spanCap = 1.42 * Math.PI;
        const span = Math.min(spanCap, Math.max(needed, minGap * 0.85));
        angleStep = span / (inRing - 1);
      }
      const spread = inRing <= 1 ? 0 : (idxInRing - (inRing - 1) / 2) * angleStep;
      const ang = angle + spread;
      positions[child.id] = {
        x: cx + Rleaf * Math.cos(ang),
        y: cy + Rleaf * Math.sin(ang),
        r: leafR,
        angle: ang,
      };
    });
  });

  return { positions, roots, divR, leafR, hubR };
}

export function resolveLayoutAnchorTeamId(teamId, positions, nodeById) {
  let id = teamId;
  const seen = new Set();
  while (id && !seen.has(id)) {
    seen.add(id);
    if (positions[id]) return id;
    const node = nodeById.get(id);
    id = node?.parentId ?? null;
  }
  return ORG_ROOT_ID;
}

/** For link drawing: use positioned team, else roll up to visible ancestor / hub. */
export function linkEndpointTeamId(teamId, positions, nodeById) {
  if (positions[teamId]) return teamId;
  return resolveLayoutAnchorTeamId(teamId, positions, nodeById);
}

/** Furthest distance from hub (cx,cy) to the outer edge of any positioned child team of this division. */
function maxChildHullRadiusFromHub(divisionId, positions, cx, cy) {
  let max = 0;
  for (const s of TEAM_SPECS) {
    if (s.parentId !== divisionId) continue;
    const p = positions[s.id];
    if (!p) continue;
    const d = Math.hypot(p.x - cx, p.y - cy) + p.r;
    max = Math.max(max, d);
  }
  return max;
}

export function layoutOutcomesAroundTeams({
  outcomes,
  positions,
  allLinks,
  cx,
  cy,
  hubR,
  outcomeR,
  nodeById,
  focusTeamId,
  expandedOrgId,
  minDim,
}) {
  const ownsByOutcome = new Map();
  allLinks.filter((l) => l.type === "owns").forEach((l) => ownsByOutcome.set(l.target, l.source));

  const gap = Math.max(minDim * 0.152, 168);
  const rowStep = outcomeR * 2 + Math.max(92, minDim * 0.108);
  const lateralPack = Math.max(outcomeR * 5.2, minDim * 0.104);

  /** When the focused division is expanded, leaf teams sit on an outer ring; packing every outcome on the division hex overlaps them — use per-owner anchors instead. */
  const focusSplitByOwner =
    focusTeamId &&
    expandedOrgId === focusTeamId &&
    divisionHasSubTeams(focusTeamId) &&
    TEAM_SPECS.some((s) => s.parentId === focusTeamId && positions[s.id]);

  if (focusTeamId && positions[focusTeamId] && !focusSplitByOwner) {
    const pt = positions[focusTeamId];
    const outs = [...outcomes].sort((a, b) => a.id.localeCompare(b.id));
    const radialGap = Math.max(minDim * 0.155, 188);
    const lateral = Math.max(outcomeR * 5.4, minDim * 0.108);
    const maxPerRow = 3;
    const rowRadialStep = rowStep + Math.max(28, minDim * 0.028);

    const dx = pt.x - cx;
    const dy = pt.y - cy;
    const dist = Math.hypot(dx, dy) || 1;
    const ux = dx / dist;
    const uy = dy / dist;
    const px = -uy;
    const py = ux;

    outs.forEach((o, j) => {
      const row = Math.floor(j / maxPerRow);
      const idxInRow = j % maxPerRow;
      const rowCount = Math.min(maxPerRow, outs.length - row * maxPerRow);
      const radialBase = pt.r + radialGap + outcomeR + row * rowRadialStep;
      const off = rowCount === 1 ? 0 : (idxInRow - (rowCount - 1) / 2) * lateral;
      positions[o.id] = {
        x: pt.x + ux * radialBase + px * off,
        y: pt.y + uy * radialBase + py * off,
        r: outcomeR,
      };
    });
    return;
  }

  const byAnchor = new Map();
  for (const o of outcomes) {
    const ownerId = ownsByOutcome.get(o.id) || o.owner;
    if (!ownerId) continue;
    const anchor = resolveLayoutAnchorTeamId(ownerId, positions, nodeById);
    if (!byAnchor.has(anchor)) byAnchor.set(anchor, []);
    byAnchor.get(anchor).push(o);
  }

  for (const [, outs] of byAnchor) outs.sort((a, b) => a.id.localeCompare(b.id));

  const radialGap = gap;
  const lateral = lateralPack;
  const maxPerRowAnchor = focusSplitByOwner
    ? 1
    : Math.max(2, Math.min(4, Math.floor(minDim / 128)));
  const rowStepFocus = rowStep * (focusSplitByOwner ? 1.72 : 1);

  /** Stagger each sub-tree along its spoke so row-0 outcomes from different owners do not land in the same annulus (major source of overlap). */
  const anchorStagger = new Map();
  if (focusSplitByOwner && expandedOrgId && positions[expandedOrgId]) {
    const anchors = [...byAnchor.keys()].filter((id) => id !== ORG_ROOT_ID && positions[id]);
    anchors.sort((a, b) => {
      const pa = positions[a];
      const pb = positions[b];
      return Math.atan2(pa.y - cy, pa.x - cx) - Math.atan2(pb.y - cy, pb.x - cx);
    });
    const step = outcomeR * 2.85 + Math.max(40, minDim * 0.034);
    anchors.forEach((id, i) => anchorStagger.set(id, i * step));
  }

  for (const [anchorId, outs] of byAnchor) {
    const pt = positions[anchorId];
    if (!pt) continue;

    if (anchorId === ORG_ROOT_ID) {
      const baseR = hubR + radialGap + outcomeR;
      const ringStep = outcomeR * 2.65 + Math.max(78, minDim * 0.092);
      const minChord = outcomeR * 3.45 + 18;
      const slotsPerRing = Math.max(8, Math.min(20, Math.floor((2 * Math.PI * baseR) / Math.max(minChord, 52))));
      outs.forEach((o, j) => {
        const ring = Math.floor(j / slotsPerRing);
        const jInRing = j % slotsPerRing;
        const inRing = Math.min(slotsPerRing, outs.length - ring * slotsPerRing);
        const rr = baseR + ring * ringStep;
        const angle = (2 * Math.PI * jInRing) / Math.max(inRing, 1) - Math.PI / 2;
        positions[o.id] = {
          x: cx + rr * Math.cos(angle),
          y: cy + rr * Math.sin(angle),
          r: outcomeR,
        };
      });
      continue;
    }

    const dx = pt.x - cx;
    const dy = pt.y - cy;
    const dist = Math.hypot(dx, dy) || 1;
    const ux = dx / dist;
    const uy = dy / dist;
    const px = -uy;
    const py = ux;

    let radialGapForAnchor = radialGap;
    if (focusSplitByOwner && expandedOrgId) {
      const an = nodeById.get(anchorId);
      if (an?.parentId === expandedOrgId) {
        radialGapForAnchor = radialGap + Math.max(72, minDim * 0.055);
      }
    }

    const childHull =
      expandedOrgId === anchorId ? maxChildHullRadiusFromHub(anchorId, positions, cx, cy) : 0;

    const stagger = anchorStagger.get(anchorId) ?? 0;
    const rowStride = focusSplitByOwner ? rowStepFocus : rowStep;

    outs.forEach((o, j) => {
      const row = Math.floor(j / maxPerRowAnchor);
      const idxInRow = j % maxPerRowAnchor;
      const rowCount = Math.min(maxPerRowAnchor, outs.length - row * maxPerRowAnchor);
      let radialBase = stagger + pt.r + radialGapForAnchor + outcomeR + row * rowStride;
      if (childHull > 0) {
        const clearance = Math.max(96, minDim * 0.082);
        const minHubDist = stagger + childHull + clearance + outcomeR + row * rowStride;
        radialBase = Math.max(radialBase, minHubDist - dist);
      }
      const off = rowCount === 1 ? 0 : (idxInRow - (rowCount - 1) / 2) * lateral;
      positions[o.id] = {
        x: pt.x + ux * radialBase + px * off,
        y: pt.y + uy * radialBase + py * off,
        r: outcomeR,
      };
    });
  }
}

export function divisionHasSubTeams(divisionId) {
  return TEAM_SPECS.some((t) => t.parentId === divisionId);
}
