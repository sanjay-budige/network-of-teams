import {
  rawNodes,
  rawLinks,
  INDIVIDUAL_TO_TEAM,
  DEACTIVATED_COLLABORATORS,
} from "./data/graphData.js";
import {
  parseSearchTokens,
  normalizeSearchString,
  matchesSearchTokens,
  buildOutcomeSearchHaystack,
} from "./search.js";

export function collectDescendantTeamIds(rootId) {
  const ids = new Set([rootId]);
  let frontier = [rootId];
  while (frontier.length) {
    const next = [];
    for (const n of rawNodes) {
      if (n.type === "team" && n.parentId && frontier.includes(n.parentId) && !ids.has(n.id)) {
        ids.add(n.id);
        next.push(n.id);
      }
    }
    frontier = next;
  }
  return ids;
}

export function isOrgTeam(node) {
  return node.type === "team" && !node.parentId;
}

/** Owner chain up to root — teams needed to draw outcomes on the map. */
export function teamClosureForOutcomeIds(outcomeIds, allLinks, allNodes) {
  const teamIds = new Set();
  for (const oid of outcomeIds) {
    const own = allLinks.find((l) => l.type === "owns" && l.target === oid);
    const ownerId = own?.source ?? allNodes.find((n) => n.id === oid && n.type === "outcome")?.owner;
    if (!ownerId) continue;
    let id = ownerId;
    while (id) {
      teamIds.add(id);
      const t = allNodes.find((n) => n.id === id && n.type === "team");
      id = t?.parentId ?? null;
    }
  }
  return teamIds;
}

/** Same filters as the graph for outcomes, optionally skipping confidence toggles (for sidebar counts). */
export function filterOutcomesForExplorer(outcomes, links, filters, { skipConfidenceFilter = false } = {}) {
  let o = outcomes;
  if (!skipConfidenceFilter) {
    const activeConf = Object.entries(filters.confidence)
      .filter(([, v]) => v)
      .map(([k]) => k);
    o = o.filter((x) => activeConf.includes(x.confidence));
  }
  if (filters.keyword?.trim()) {
    const tokens = parseSearchTokens(filters.keyword);
    if (tokens.length) {
      const phrase = normalizeSearchString(filters.keyword);
      o = o.filter((x) =>
        matchesSearchTokens(buildOutcomeSearchHaystack(x, links), tokens, phrase),
      );
    }
  }
  if (filters.changesSince) {
    const cutoff = filters.changesSince;
    o = o.filter((x) => x.updatedAt && x.updatedAt >= cutoff);
  }
  if (filters.selectedLabels.length) {
    const labelSet = new Set(filters.selectedLabels);
    o = o.filter((x) => x.labels?.some((l) => labelSet.has(l)));
  }
  if (filters.selectedCollaborators.length) {
    const want = new Set(filters.selectedCollaborators);
    o = o.filter((x) => {
      const rawList = x.collaborators || [];
      const list = filters.includeDeactivated
        ? rawList
        : rawList.filter((c) => !DEACTIVATED_COLLABORATORS.includes(c));
      return list.some((c) => want.has(c));
    });
  }
  const effectiveTeamLabel =
    filters.team || (filters.individual && INDIVIDUAL_TO_TEAM[filters.individual]) || "";
  if (effectiveTeamLabel) {
    const teamNode = rawNodes.find((n) => n.type === "team" && n.label === effectiveTeamLabel);
    if (teamNode) {
      const teamIds = collectDescendantTeamIds(teamNode.id);
      const directLinks = links.filter((l) => teamIds.has(l.source) || teamIds.has(l.target));
      const connectedIds = new Set(teamIds);
      directLinks.forEach((l) => {
        connectedIds.add(l.source);
        connectedIds.add(l.target);
      });
      const alignedOutcomeIds = directLinks
        .filter((l) => l.type === "aligned" || l.type === "owns")
        .map((l) => (l.source === teamNode.id ? l.target : l.source));
      const alignedTeamLinks = links.filter(
        (l) => alignedOutcomeIds.includes(l.source) || alignedOutcomeIds.includes(l.target),
      );
      alignedTeamLinks.forEach((l) => {
        connectedIds.add(l.source);
        connectedIds.add(l.target);
      });
      o = o.filter((x) => connectedIds.has(x.id));
    }
  }
  if (!filters.level.team) {
    o = o.filter(
      (x) =>
        !rawLinks.some(
          (l) =>
            (l.source === x.id || l.target === x.id) &&
            rawNodes.find((nn) => nn.id === (l.source === x.id ? l.target : l.source))?.type === "team",
        ),
    );
  }
  return o;
}

export function getOwnedOutcomeIdsForTeam(teamId, links) {
  const scope = collectDescendantTeamIds(teamId);
  const ids = new Set();
  for (const l of links) {
    if (l.type === "owns" && scope.has(l.source)) ids.add(l.target);
  }
  return ids;
}
