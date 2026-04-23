export const COLORS = {
  bg: "#0d1117",
  panel: "#161b22",
  border: "#21262d",
  accent: "#00c2a8",
  accentDim: "#00c2a820",
  text: "#e6edf3",
  textMuted: "#7d8590",
  strategic: "#f78166",
  outcome: "#58a6ff",
  measure: "#d2a8ff",
  organization: "#a371f7",
  team: "#3fb950",
  teamHighlight: "#ffa657",
  onTrack: "#3fb950",
  challenge: "#d29922",
  offTrack: "#f85149",
  draft: "#7d8590",
};

export const GRAPH = {
  bg: "#f6f8fb",
  grid: "#e1e8ef",
  hubFill: "#ffffff",
  hubStroke: "#7dd3fc",
  text: "#0f172a",
  textMuted: "#64748b",
  outcomeLabel: "#1e293b",
  outcomeLabelStrong: "#0f172a",
  link: "#94a3b8",
  /** Hub + team hierarchy (one visual family on the map). */
  hierarchyLink: "rgba(100, 116, 139, 0.52)",
  /** Team→outcome and outcome→measure (second family; calmer than separate blues/greys). */
  workLink: "rgba(71, 85, 105, 0.62)",
  linkDash: "5 5",
  hierarchyDash: "6 4",
  /** Dashed stroke for “Highlight my team” emphasis (selected team subtree + outcomes). */
  highlightDash: "7 5",
  measureStroke: "#64748b",
  measureFill: "#ffffff",
};

export const PANEL = {
  bg: "#ffffff",
  surface: "#f8fafc",
  border: "#e2e8f0",
  text: "#0f172a",
  textMuted: "#64748b",
  inputBg: "#ffffff",
};

export const ORG_ROOT_ID = "org-root";
export const ORG_LABEL = "Bayer AG";

/** Dimmed team fill when “Highlight my team” is on (solid rgba — avoids broken 8-digit hex in SVG). */
export const TEAM_DIM_ORG = "rgba(163, 113, 247, 0.38)";
export const TEAM_DIM_LEAF = "rgba(63, 185, 80, 0.38)";

export const NODE_DRAG_MAX_PX = 200;

/** When false, “Last updated on or after” is hidden and ignored (logic stays for a later release). */
export const SHOW_LAST_UPDATED_DATE_FILTER = false;
