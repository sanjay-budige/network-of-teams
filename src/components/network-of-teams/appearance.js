import { COLORS, TEAM_DIM_ORG, TEAM_DIM_LEAF } from "./constants.js";
import { TEAM_SPECS } from "./data/graphData.js";
import { isOrgTeam } from "./filterModel.js";

export function getConfidenceAccent(node) {
  if (node.type !== "outcome") return null;
  if (node.confidence === "on-track") return COLORS.onTrack;
  if (node.confidence === "challenge") return COLORS.challenge;
  if (node.confidence === "off-track") return COLORS.offTrack;
  return COLORS.draft;
}

export function getNodeColor(node, opts = { highlightMyTeam: false }) {
  if (node.type === "strategic") return COLORS.strategic;
  if (node.type === "team") {
    if (opts.highlightMyTeam) return node.myTeam ? COLORS.teamHighlight : (isOrgTeam(node) ? TEAM_DIM_ORG : TEAM_DIM_LEAF);
    return isOrgTeam(node) ? COLORS.organization : COLORS.team;
  }
  if (node.type === "outcome") return COLORS.outcome;
  if (node.type === "measure") return COLORS.measure;
  return "#fff";
}

export function getNodeRadius(node) {
  if (node.type === "strategic") return 20;
  if (node.type === "team") {
    const hasSubteams = TEAM_SPECS.some((t) => t.parentId === node.id);
    return hasSubteams ? 21 : 15;
  }
  if (node.type === "outcome") return 15;
  if (node.type === "measure") return 9;
  return 10;
}

/** Stable pseudo-random 0..1 from outcome id (deterministic across renders). */
export function stableUnitFromId(id) {
  let h = 2166136261;
  const s = String(id);
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10000) / 10000;
}

/** Illustrative % on outcome disks and in the panel (deterministic per id). */
export function outcomeProgressPct(node) {
  if (!node || node.type !== "outcome") return 0;
  const u = stableUnitFromId(node.id);
  if (node.confidence === "on-track") return 70 + Math.round(u * 30);
  if (node.confidence === "challenge") return 40 + Math.round(u * 20);
  if (node.confidence === "off-track") return 10 + Math.round(u * 20);
  return 25 + Math.round(u * 20);
}

export function applyGraphLabelLod(gRootSelection, scaleK) {
  const k = Number.isFinite(scaleK) ? scaleK : 1;
  const showFine = k >= 0.52;
  const showTeamNames = k >= 0.28;
  gRootSelection.selectAll("text.lod-fine").attr("opacity", showFine ? 1 : 0);
  gRootSelection.selectAll("text.lod-medium").attr("opacity", showTeamNames ? 1 : 0.38);
}

export function hexPoints(r) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3 - Math.PI / 6;
    pts.push([Math.cos(angle) * r, Math.sin(angle) * r]);
  }
  return pts.map((p) => p.join(",")).join(" ");
}

/** Solid stroke color from getNodeColor (strip alpha suffix if present). */
export function hexStroke(hex) {
  if (!hex || hex[0] !== "#") return hex;
  return hex.length > 7 ? hex.slice(0, 7) : hex;
}

/** Semi-transparent fill for team shapes from getNodeColor. */
export function teamShapeFill(hex) {
  if (!hex || hex[0] !== "#") return hex;
  if (hex.length === 7) return `${hex}40`;
  return hex;
}
