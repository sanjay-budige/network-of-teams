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

/** Merge searchable fragments into one normalized string, deduping words (first occurrence wins). */
function mergeSearchParts(parts) {
  const out = [];
  const seen = new Set();
  for (const raw of parts) {
    if (raw == null || raw === "") continue;
    const n = normalizeSearchString(String(raw));
    for (const w of n.split(" ").filter(Boolean)) {
      if (!seen.has(w)) {
        seen.add(w);
        out.push(w);
      }
    }
  }
  return out.join(" ");
}

/** Single haystack word vs one query token (used for ordered multi-word phrase matching). */
function wordMatchesQueryToken(word, t) {
  if (!t) return true;
  if (word === t) return true;
  if (/^\d+$/.test(t)) {
    return word.includes(t) || word.replace(/[^\d]/g, "").includes(t);
  }
  if (t.length <= 2) return word === t;
  return word.startsWith(t) || word.includes(t);
}

/**
 * True if each phrase word matches the next eligible haystack word in order
 * (handles "CS Field" vs haystack "… cs … field …" where strict substring fails).
 */
function phraseWordsMatchOrdered(haystackNorm, phraseNorm) {
  const pw = phraseNorm.split(" ").filter(Boolean);
  if (!pw.length) return true;
  const hw = haystackNorm.split(" ").filter(Boolean);
  let hi = 0;
  for (const tok of pw) {
    let matched = false;
    while (hi < hw.length) {
      if (wordMatchesQueryToken(hw[hi], tok)) {
        matched = true;
        hi++;
        break;
      }
      hi++;
    }
    if (!matched) return false;
  }
  return true;
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

/**
 * Match: contiguous phrase in haystack, or same with spaces removed, or ordered word sequence,
 * else every loose token must match (AND).
 */
export function matchesSearchTokens(haystackNorm, tokens, fullQueryNormalized) {
  if (!tokens.length) return true;
  if (fullQueryNormalized) {
    if (haystackNorm.includes(fullQueryNormalized)) return true;
    const ch = compactSearchKey(haystackNorm);
    const cp = compactSearchKey(fullQueryNormalized);
    if (cp.length >= 2 && ch.includes(cp)) return true;
    if (phraseWordsMatchOrdered(haystackNorm, fullQueryNormalized)) return true;
  }
  return tokens.every((t) => tokenMatchesHaystack(haystackNorm, t));
}

function appendTeamChainParts(parts, startTeamId) {
  let tid = startTeamId;
  while (tid) {
    const team = TEAM_BY_ID.get(tid);
    if (!team) break;
    parts.push(team.label, team.abbrev, team.id);
    tid = team.parentId ?? null;
  }
}

/**
 * Searchable text for an outcome: org hub, outcome title/id, and **owning** team chain only.
 * Intentionally excludes **aligned** team names — otherwise a query like "operations" matches
 * text from "PH Commercial Operations" on an aligned link while the outcome is owned under EF,
 * which incorrectly pulls unrelated divisions onto the map. Cross-team context stays on the graph via links.
 */
export function buildOutcomeSearchHaystack(outcome, links) {
  const parts = [ORG_LABEL, outcome.label, outcome.id, ...(outcome.collaborators || [])];
  const ownerId = links.find((l) => l.type === "owns" && l.target === outcome.id)?.source ?? outcome.owner;
  if (ownerId) appendTeamChainParts(parts, ownerId);

  return mergeSearchParts(parts);
}

/** Searchable text for a measure: org, measure title/id, owner team chain. */
export function buildMeasureSearchHaystack(measure) {
  const parts = [ORG_LABEL, measure.label, measure.id];
  appendTeamChainParts(parts, measure.owner);
  return mergeSearchParts(parts);
}
