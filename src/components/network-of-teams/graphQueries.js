import { rawNodes, rawLinks } from "./data/graphData.js";

export function teamLabelById(id) {
  const t = rawNodes.find((n) => n.id === id && n.type === "team");
  return t?.label ?? id;
}

/** Teams with an `aligned` link to this outcome (shown in panel, not drawn on the graph). */
export function alignmentTeamsForOutcome(outcomeId) {
  const ownerId = rawNodes.find((x) => x.id === outcomeId && x.type === "outcome")?.owner;
  const seen = new Set();
  const teams = [];
  for (const l of rawLinks) {
    if (l.type !== "aligned" || l.target !== outcomeId) continue;
    const n = rawNodes.find((x) => x.id === l.source && x.type === "team");
    if (!n || seen.has(n.id)) continue;
    if (ownerId && n.id === ownerId) continue;
    seen.add(n.id);
    teams.push(n);
  }
  return teams;
}

export function measuresForOutcome(outcomeId) {
  return rawLinks
    .filter((l) => l.source === outcomeId && l.type === "measures")
    .map((l) => rawNodes.find((n) => n.id === l.target))
    .filter(Boolean);
}
