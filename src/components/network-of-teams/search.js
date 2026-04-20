import { ORG_LABEL } from "./constants.js";
import { TEAM_BY_ID } from "./data/graphData.js";

/** Lowercase, split on non-alphanumeric so "IT & Digital" matches "it digital". */
export function normalizeSearchString(s) {
  return String(s ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseSearchTokens(query) {
  const n = normalizeSearchString(query);
  if (!n) return [];
  return n.split(" ").filter(Boolean);
}

/** Strip spaces so "31" can match inside "o31", and multi-word phrases match as a run. */
export function compactSearchKey(haystackNorm) {
  return haystackNorm.replace(/\s/g, "");
}

/**
 * True if this single token matches the normalized haystack (one token from the user query).
 * Short tokens (≤2 chars) must match a whole word so "ch" does not match "challenge".
 * Longer tokens may substring- or prefix-match; digit runs also match id substrings (e.g. 31 → o31).
 */
export function tokenMatchesHaystack(haystackNorm, t) {
  if (!t) return true;
  if (haystackNorm === t) return true;
  const words = haystackNorm.split(" ").filter(Boolean);
  const compact = compactSearchKey(haystackNorm);
  if (/^\d+$/.test(t) && compact.includes(t)) return true;
  if (t.length <= 2) return words.includes(t);
  if (haystackNorm.includes(t)) return true;
  if (compact.includes(t)) return true;
  return words.some((w) => w.startsWith(t));
}

/** Match if any token hits, or the full query matches as a substring (phrase). */
export function matchesSearchTokens(haystackNorm, tokens, fullQueryNormalized) {
  if (!tokens.length) return true;
  if (fullQueryNormalized && haystackNorm.includes(fullQueryNormalized)) return true;
  return tokens.some((t) => tokenMatchesHaystack(haystackNorm, t));
}

/** Search text: organization name + outcome title/id + owning team chain only (no tags, people, or linked nodes). */
export function buildOutcomeSearchHaystack(outcome, links) {
  const parts = [ORG_LABEL, outcome.label, outcome.id];
  const ownerId = links.find((l) => l.type === "owns" && l.target === outcome.id)?.source ?? outcome.owner;
  let tid = ownerId;
  while (tid) {
    const team = TEAM_BY_ID.get(tid);
    if (!team) break;
    parts.push(team.label, team.abbrev, team.id);
    tid = team.parentId ?? null;
  }
  return normalizeSearchString(parts.filter(Boolean).join(" "));
}

export function buildMeasureSearchHaystack(measure) {
  const parts = [ORG_LABEL, measure.label, measure.id];
  let tid = measure.owner;
  while (tid) {
    const team = TEAM_BY_ID.get(tid);
    if (!team) break;
    parts.push(team.label, team.abbrev, team.id);
    tid = team.parentId ?? null;
  }
  return normalizeSearchString(parts.filter(Boolean).join(" "));
}
