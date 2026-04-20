import { COLORS } from "../constants.js";

/** Bayer Workpath–style org: divisions with optional sub-teams (illustrative labels). */
const TEAM_SPECS = [
  { id: "bom", label: "Board of Management", abbrev: "B", parentId: null },
  { id: "ch", label: "Consumer Health - CH", abbrev: "CH", parentId: null },
  { id: "ch-digital", label: "CH Digital & eCommerce", abbrev: "CH", parentId: "ch" },
  { id: "ch-brand", label: "CH Brand Marketing", abbrev: "CH", parentId: "ch" },
  { id: "cs", label: "Crop Science - CS", abbrev: "CS", parentId: null },
  { id: "cs-field", label: "CS Field & Regions", abbrev: "CS", parentId: "cs" },
  { id: "cs-reg", label: "CS Regulatory Science", abbrev: "CS", parentId: "cs" },
  { id: "ef", label: "Enabling Function - EF", abbrev: "EF", parentId: null },
  { id: "ef-finance", label: "EF Corporate Finance", abbrev: "EF", parentId: "ef", myTeam: true },
  { id: "ef-it", label: "EF IT & Digital", abbrev: "EF", parentId: "ef" },
  { id: "ef-hr", label: "EF People & Talent", abbrev: "EF", parentId: "ef" },
  { id: "ef-legal", label: "EF Legal & Compliance", abbrev: "EF", parentId: "ef" },
  { id: "ph", label: "Pharmaceuticals - PH", abbrev: "PH", parentId: null },
  { id: "ph-rd", label: "PH Global R&D", abbrev: "PH", parentId: "ph" },
  { id: "ph-commercial", label: "PH Commercial Operations", abbrev: "PH", parentId: "ph" },
];

const teamNodesFromSpec = TEAM_SPECS.map((t) => ({
  id: t.id,
  label: t.label,
  type: "team",
  group: "team",
  parentId: t.parentId ?? null,
  abbrev: t.abbrev,
  myTeam: !!t.myTeam,
}));

const teamHierarchyLinks = TEAM_SPECS.filter((t) => t.parentId).map((t) => ({
  source: t.parentId,
  target: t.id,
  type: "nested",
}));

/** Top-level team order in “Search teams” style dropdowns */
const TEAM_PARENT_ORDER = ["bom", "ch", "cs", "ef", "ph"];

function buildTeamSelectOptions() {
  const byId = Object.fromEntries(TEAM_SPECS.map((t) => [t.id, t]));
  const opts = [];
  for (const pid of TEAM_PARENT_ORDER) {
    const t = byId[pid];
    if (!t || t.parentId) continue;
    const children = TEAM_SPECS.filter((c) => c.parentId === t.id);
    const arrow = children.length ? "\u25B8 " : "   ";
    opts.push({ value: t.label, label: `${arrow}${t.label}` });
    for (const c of children) {
      opts.push({ value: c.label, label: `      ${c.label}` });
    }
  }
  return opts;
}

const TEAM_SELECT_OPTIONS = buildTeamSelectOptions();

const rawNodes = [
  // Strategic Priorities
  { id: "sp1", label: "Growth & Innovation", type: "strategic", group: "sp" },
  { id: "sp2", label: "Efficiency & Quality", type: "strategic", group: "sp" },
  { id: "sp3", label: "Customer Success", type: "strategic", group: "sp" },
  ...teamNodesFromSpec,
  // Outcomes (owners = leaf teams)
  { id: "o1", label: "Increase Revenue by 15%", type: "outcome", confidence: "on-track", owner: "ef-finance", group: "outcome", labels: ["OKR", "Revenue"], collaborators: ["Theo Brampton", "Mira Okada"], updatedAt: "2026-03-01" },
  { id: "o2", label: "Expand Market Share", type: "outcome", confidence: "challenge", owner: "ch-brand", group: "outcome", labels: ["Growth"], collaborators: ["Rafael Costa", "Kai Lindstrom"], updatedAt: "2026-01-15" },
  { id: "o3", label: "Launch Product v3", type: "outcome", confidence: "on-track", owner: "ph-rd", group: "outcome", labels: ["OKR", "Product"], collaborators: ["Devon Malik"], updatedAt: "2026-04-02" },
  { id: "o4", label: "Reduce Infra Costs 20%", type: "outcome", confidence: "on-track", owner: "ef-it", group: "outcome", labels: ["Cost"], collaborators: ["Sofia Renner"], updatedAt: "2026-02-20" },
  { id: "o5", label: "NPS Score > 70", type: "outcome", confidence: "off-track", owner: "ch-brand", group: "outcome", labels: ["Customer"], collaborators: ["Avery Singh", "Inactive User (archived)"], updatedAt: "2025-11-10" },
  { id: "o6", label: "Hire 50 Engineers", type: "outcome", confidence: "challenge", owner: "ef-hr", group: "outcome", labels: ["HR"], collaborators: ["Luis Ortega"], updatedAt: "2026-03-18" },
  { id: "o7", label: "Regulatory Compliance 100%", type: "outcome", confidence: "on-track", owner: "ef-legal", group: "outcome", labels: ["Compliance"], collaborators: ["Mira Okada"], updatedAt: "2026-02-01" },
  { id: "o8", label: "Reduce Time-to-Market 30%", type: "outcome", confidence: "challenge", owner: "ph-commercial", group: "outcome", labels: ["Product"], collaborators: ["Kai Lindstrom"], updatedAt: "2026-03-25" },
  { id: "o9", label: "Operational Cost Savings", type: "outcome", confidence: "on-track", owner: "cs-field", group: "outcome", labels: ["Cost", "Operations"], collaborators: ["Rafael Costa"], updatedAt: "2026-01-30" },
  // Additional outcomes — each team has at least two owned outcomes (illustrative)
  { id: "o10", label: "Portfolio governance cadence", type: "outcome", confidence: "draft", owner: "bom", group: "outcome", labels: ["Governance"], collaborators: ["Theo Brampton"], updatedAt: "2026-03-12" },
  { id: "o11", label: "Board KPI dashboard", type: "outcome", confidence: "draft", owner: "bom", group: "outcome", labels: ["OKR"], collaborators: ["Mira Okada"], updatedAt: "2026-02-28" },
  { id: "o12", label: "Consumer health brand index", type: "outcome", confidence: "on-track", owner: "ch", group: "outcome", labels: ["Brand"], collaborators: ["Rafael Costa"], updatedAt: "2026-03-05" },
  { id: "o13", label: "Omnichannel reach Q2", type: "outcome", confidence: "draft", owner: "ch", group: "outcome", labels: ["Growth"], collaborators: ["Kai Lindstrom"], updatedAt: "2026-04-01" },
  { id: "o14", label: "D2C conversion uplift", type: "outcome", confidence: "draft", owner: "ch-digital", group: "outcome", labels: ["Digital"], collaborators: ["Avery Singh"], updatedAt: "2026-03-20" },
  { id: "o15", label: "App NPS improvement", type: "outcome", confidence: "draft", owner: "ch-digital", group: "outcome", labels: ["Customer"], collaborators: ["Mira Okada"], updatedAt: "2026-02-15" },
  { id: "o16", label: "Seed innovation pipeline", type: "outcome", confidence: "challenge", owner: "cs", group: "outcome", labels: ["Innovation"], collaborators: ["Rafael Costa"], updatedAt: "2026-03-08" },
  { id: "o17", label: "Farmer advisory hours", type: "outcome", confidence: "draft", owner: "cs", group: "outcome", labels: ["Field"], collaborators: ["Devon Malik"], updatedAt: "2026-01-22" },
  { id: "o18", label: "Regional yield optimization", type: "outcome", confidence: "on-track", owner: "cs-field", group: "outcome", labels: ["Yield"], collaborators: ["Rafael Costa"], updatedAt: "2026-03-25" },
  { id: "o19", label: "Registration dossier prep", type: "outcome", confidence: "draft", owner: "cs-reg", group: "outcome", labels: ["Compliance"], collaborators: ["Sofia Renner"], updatedAt: "2026-02-10" },
  { id: "o20", label: "Label harmonization EU", type: "outcome", confidence: "draft", owner: "cs-reg", group: "outcome", labels: ["Regulatory"], collaborators: ["Mira Okada"], updatedAt: "2026-03-18" },
  { id: "o21", label: "Enterprise OKR roll-up", type: "outcome", confidence: "on-track", owner: "ef", group: "outcome", labels: ["OKR"], collaborators: ["Theo Brampton"], updatedAt: "2026-03-01" },
  { id: "o22", label: "Shared services SLA", type: "outcome", confidence: "draft", owner: "ef", group: "outcome", labels: ["Operations"], collaborators: ["Luis Ortega"], updatedAt: "2026-04-05" },
  { id: "o23", label: "Cash conversion cycle", type: "outcome", confidence: "challenge", owner: "ef-finance", group: "outcome", labels: ["Finance"], collaborators: ["Theo Brampton"], updatedAt: "2026-02-20" },
  { id: "o24", label: "Zero-trust rollout", type: "outcome", confidence: "on-track", owner: "ef-it", group: "outcome", labels: ["Security"], collaborators: ["Sofia Renner"], updatedAt: "2026-03-14" },
  { id: "o25", label: "Leadership pipeline ratio", type: "outcome", confidence: "draft", owner: "ef-hr", group: "outcome", labels: ["HR"], collaborators: ["Luis Ortega"], updatedAt: "2026-02-28" },
  { id: "o26", label: "IP filing throughput", type: "outcome", confidence: "draft", owner: "ef-legal", group: "outcome", labels: ["Legal"], collaborators: ["Mira Okada"], updatedAt: "2026-01-30" },
  { id: "o29", label: "Launch readiness index", type: "outcome", confidence: "draft", owner: "ph", group: "outcome", labels: ["Launch"], collaborators: ["Kai Lindstrom"], updatedAt: "2026-03-22" },
  { id: "o30", label: "Patient access expansion", type: "outcome", confidence: "draft", owner: "ph", group: "outcome", labels: ["Access"], collaborators: ["Mira Okada"], updatedAt: "2026-03-06" },
  { id: "o31", label: "Clinical trial enrollment", type: "outcome", confidence: "off-track", owner: "ph-rd", group: "outcome", labels: ["Clinical"], collaborators: ["Devon Malik"], updatedAt: "2025-12-15" },
  { id: "o32", label: "Market access deals", type: "outcome", confidence: "draft", owner: "ph-commercial", group: "outcome", labels: ["Market"], collaborators: ["Kai Lindstrom"], updatedAt: "2026-03-12" },
  // Additional outcomes — denser per-team coverage for the explorer
  { id: "o33", label: "Field demo coverage 90%", type: "outcome", confidence: "on-track", owner: "cs-field", group: "outcome", labels: ["Field"], collaborators: ["Rafael Costa"], updatedAt: "2026-03-20" },
  { id: "o34", label: "Sustainability reporting pack", type: "outcome", confidence: "challenge", owner: "cs-field", group: "outcome", labels: ["ESG"], collaborators: ["Devon Malik"], updatedAt: "2026-03-18" },
  { id: "o35", label: "Dealer training hours", type: "outcome", confidence: "on-track", owner: "cs-field", group: "outcome", labels: ["Enablement"], collaborators: ["Rafael Costa"], updatedAt: "2026-03-10" },
  { id: "o36", label: "FX hedge ratio target", type: "outcome", confidence: "on-track", owner: "ef-finance", group: "outcome", labels: ["Finance"], collaborators: ["Theo Brampton"], updatedAt: "2026-03-22" },
  { id: "o37", label: "Procurement savings pipeline", type: "outcome", confidence: "challenge", owner: "ef-finance", group: "outcome", labels: ["Cost"], collaborators: ["Mira Okada"], updatedAt: "2026-03-05" },
  { id: "o38", label: "Stability study closure", type: "outcome", confidence: "on-track", owner: "ph-rd", group: "outcome", labels: ["R&D"], collaborators: ["Devon Malik"], updatedAt: "2026-04-01" },
  { id: "o39", label: "Companion diagnostics partnership", type: "outcome", confidence: "draft", owner: "ph-rd", group: "outcome", labels: ["Partners"], collaborators: ["Kai Lindstrom"], updatedAt: "2026-02-28" },
  { id: "o40", label: "Retail shelf share", type: "outcome", confidence: "on-track", owner: "ch-brand", group: "outcome", labels: ["Retail"], collaborators: ["Avery Singh"], updatedAt: "2026-03-15" },
  { id: "o41", label: "API uptime 99.95%", type: "outcome", confidence: "on-track", owner: "ef-it", group: "outcome", labels: ["Reliability"], collaborators: ["Sofia Renner"], updatedAt: "2026-03-25" },
  { id: "o42", label: "MRL harmonization", type: "outcome", confidence: "challenge", owner: "cs-reg", group: "outcome", labels: ["Regulatory"], collaborators: ["Sofia Renner"], updatedAt: "2026-03-12" },
  { id: "o43", label: "Audit findings closure", type: "outcome", confidence: "on-track", owner: "cs-reg", group: "outcome", labels: ["Quality"], collaborators: ["Mira Okada"], updatedAt: "2026-03-08" },
  { id: "o44", label: "Social commerce GMV", type: "outcome", confidence: "challenge", owner: "ch-digital", group: "outcome", labels: ["Digital"], collaborators: ["Avery Singh"], updatedAt: "2026-04-02" },
  { id: "o45", label: "Payer contract renewals", type: "outcome", confidence: "on-track", owner: "ph-commercial", group: "outcome", labels: ["Market"], collaborators: ["Kai Lindstrom"], updatedAt: "2026-03-18" },
  { id: "o46", label: "Internal mobility rate", type: "outcome", confidence: "draft", owner: "ef-hr", group: "outcome", labels: ["HR"], collaborators: ["Luis Ortega"], updatedAt: "2026-03-01" },
  { id: "o47", label: "Capital allocation review", type: "outcome", confidence: "on-track", owner: "bom", group: "outcome", labels: ["Governance"], collaborators: ["Theo Brampton"], updatedAt: "2026-03-14" },
  { id: "o48", label: "Category growth index", type: "outcome", confidence: "on-track", owner: "ch", group: "outcome", labels: ["Brand"], collaborators: ["Rafael Costa"], updatedAt: "2026-03-21" },
  { id: "o49", label: "Biologicals adoption rate", type: "outcome", confidence: "challenge", owner: "cs", group: "outcome", labels: ["Innovation"], collaborators: ["Devon Malik"], updatedAt: "2026-03-11" },
  { id: "o50", label: "Oncology pipeline milestones", type: "outcome", confidence: "draft", owner: "ph", group: "outcome", labels: ["Pipeline"], collaborators: ["Mira Okada"], updatedAt: "2026-03-09" },
  // Measures
  { id: "m1", label: "Monthly Revenue", type: "measure", owner: "ef-finance", group: "measure", labels: ["Revenue"], collaborators: ["Theo Brampton"], updatedAt: "2026-03-28" },
  { id: "m2", label: "Lead Conversion Rate", type: "measure", owner: "ch-brand", group: "measure", labels: ["Growth"], collaborators: ["Avery Singh"], updatedAt: "2026-02-14" },
  { id: "m3", label: "Feature Release Velocity", type: "measure", owner: "ph-rd", group: "measure", labels: ["Product"], collaborators: ["Devon Malik"], updatedAt: "2026-04-10" },
  { id: "m4", label: "Cloud Cost Per User", type: "measure", owner: "ef-it", group: "measure", labels: ["Cost"], collaborators: ["Sofia Renner"], updatedAt: "2026-03-05" },
  { id: "m5", label: "Customer Satisfaction", type: "measure", owner: "ch-brand", group: "measure", labels: ["Customer"], collaborators: ["Mira Okada"], updatedAt: "2026-02-22" },
  { id: "m6", label: "Board decision velocity", type: "measure", owner: "bom", group: "measure", labels: ["Governance"], collaborators: ["Theo Brampton"], updatedAt: "2026-03-20" },
  { id: "m7", label: "Omnichannel sessions", type: "measure", owner: "ch", group: "measure", labels: ["Digital"], collaborators: ["Rafael Costa"], updatedAt: "2026-03-18" },
  { id: "m8", label: "Dossier completeness %", type: "measure", owner: "cs-reg", group: "measure", labels: ["Regulatory"], collaborators: ["Mira Okada"], updatedAt: "2026-03-08" },
  { id: "m9", label: "SLA attainment", type: "measure", owner: "ef", group: "measure", labels: ["Operations"], collaborators: ["Luis Ortega"], updatedAt: "2026-03-15" },
  { id: "m10", label: "Enrollment vs plan", type: "measure", owner: "ph-rd", group: "measure", labels: ["Clinical"], collaborators: ["Devon Malik"], updatedAt: "2026-03-12" },
  { id: "m11", label: "Deals in negotiation", type: "measure", owner: "ph-commercial", group: "measure", labels: ["Market"], collaborators: ["Kai Lindstrom"], updatedAt: "2026-03-10" },
  { id: "m12", label: "Yield benchmark index", type: "measure", owner: "cs-field", group: "measure", labels: ["Yield"], collaborators: ["Rafael Costa"], updatedAt: "2026-03-22" },
  { id: "m13", label: "Open reqs vs hiring plan", type: "measure", owner: "ef-hr", group: "measure", labels: ["HR"], collaborators: ["Luis Ortega"], updatedAt: "2026-03-19" },
  { id: "m14", label: "Compliance training completion", type: "measure", owner: "ef-legal", group: "measure", labels: ["Compliance"], collaborators: ["Mira Okada"], updatedAt: "2026-03-12" },
  { id: "m15", label: "Launch cycle time (days)", type: "measure", owner: "ph-commercial", group: "measure", labels: ["Product"], collaborators: ["Kai Lindstrom"], updatedAt: "2026-03-21" },
  { id: "m16", label: "Run-rate cost takeout", type: "measure", owner: "cs-field", group: "measure", labels: ["Cost"], collaborators: ["Rafael Costa"], updatedAt: "2026-03-18" },
  { id: "m17", label: "Board pack timeliness", type: "measure", owner: "bom", group: "measure", labels: ["Governance"], collaborators: ["Mira Okada"], updatedAt: "2026-03-08" },
  { id: "m18", label: "Omnichannel reach index", type: "measure", owner: "ch", group: "measure", labels: ["Growth"], collaborators: ["Kai Lindstrom"], updatedAt: "2026-03-25" },
  { id: "m19", label: "D2C conversion rate", type: "measure", owner: "ch-digital", group: "measure", labels: ["Digital"], collaborators: ["Avery Singh"], updatedAt: "2026-03-20" },
  { id: "m20", label: "App store rating", type: "measure", owner: "ch-digital", group: "measure", labels: ["Customer"], collaborators: ["Mira Okada"], updatedAt: "2026-03-14" },
  { id: "m21", label: "Innovation funnel volume", type: "measure", owner: "cs", group: "measure", labels: ["Innovation"], collaborators: ["Rafael Costa"], updatedAt: "2026-03-16" },
  { id: "m22", label: "Farmer touchpoint hours", type: "measure", owner: "cs", group: "measure", labels: ["Field"], collaborators: ["Devon Malik"], updatedAt: "2026-03-11" },
  { id: "m23", label: "Submission readiness score", type: "measure", owner: "cs-reg", group: "measure", labels: ["Compliance"], collaborators: ["Sofia Renner"], updatedAt: "2026-03-09" },
  { id: "m24", label: "Shared services backlog age", type: "measure", owner: "ef", group: "measure", labels: ["Operations"], collaborators: ["Luis Ortega"], updatedAt: "2026-03-17" },
  { id: "m25", label: "DSO / cash conversion", type: "measure", owner: "ef-finance", group: "measure", labels: ["Finance"], collaborators: ["Theo Brampton"], updatedAt: "2026-03-24" },
  { id: "m26", label: "Endpoints on zero-trust", type: "measure", owner: "ef-it", group: "measure", labels: ["Security"], collaborators: ["Sofia Renner"], updatedAt: "2026-03-22" },
  { id: "m27", label: "Leadership bench strength", type: "measure", owner: "ef-hr", group: "measure", labels: ["HR"], collaborators: ["Luis Ortega"], updatedAt: "2026-03-06" },
  { id: "m28", label: "Patent filings YTD", type: "measure", owner: "ef-legal", group: "measure", labels: ["Legal"], collaborators: ["Mira Okada"], updatedAt: "2026-03-13" },
  { id: "m29", label: "Stage-gate pass rate", type: "measure", owner: "ph", group: "measure", labels: ["Launch"], collaborators: ["Kai Lindstrom"], updatedAt: "2026-03-19" },
  { id: "m30", label: "Patient access sites live", type: "measure", owner: "ph", group: "measure", labels: ["Access"], collaborators: ["Mira Okada"], updatedAt: "2026-03-07" },
  { id: "m31", label: "Demo events completed", type: "measure", owner: "cs-field", group: "measure", labels: ["Field"], collaborators: ["Rafael Costa"], updatedAt: "2026-03-21" },
  { id: "m32", label: "ESG metrics coverage", type: "measure", owner: "cs-field", group: "measure", labels: ["ESG"], collaborators: ["Devon Malik"], updatedAt: "2026-03-15" },
  { id: "m33", label: "Certified dealers count", type: "measure", owner: "cs-field", group: "measure", labels: ["Enablement"], collaborators: ["Rafael Costa"], updatedAt: "2026-03-12" },
  { id: "m34", label: "Hedge ratio vs policy", type: "measure", owner: "ef-finance", group: "measure", labels: ["Finance"], collaborators: ["Theo Brampton"], updatedAt: "2026-03-26" },
  { id: "m35", label: "Savings pipeline €", type: "measure", owner: "ef-finance", group: "measure", labels: ["Cost"], collaborators: ["Mira Okada"], updatedAt: "2026-03-10" },
  { id: "m36", label: "Stability lots closed", type: "measure", owner: "ph-rd", group: "measure", labels: ["R&D"], collaborators: ["Devon Malik"], updatedAt: "2026-04-05" },
  { id: "m37", label: "Partner LOIs signed", type: "measure", owner: "ph-rd", group: "measure", labels: ["Partners"], collaborators: ["Kai Lindstrom"], updatedAt: "2026-03-04" },
  { id: "m38", label: "ACV / shelf facings", type: "measure", owner: "ch-brand", group: "measure", labels: ["Retail"], collaborators: ["Avery Singh"], updatedAt: "2026-03-18" },
  { id: "m39", label: "API error budget burn", type: "measure", owner: "ef-it", group: "measure", labels: ["Reliability"], collaborators: ["Sofia Renner"], updatedAt: "2026-03-27" },
  { id: "m40", label: "MRL gap items open", type: "measure", owner: "cs-reg", group: "measure", labels: ["Regulatory"], collaborators: ["Sofia Renner"], updatedAt: "2026-03-14" },
  { id: "m41", label: "Audit CAPA closure %", type: "measure", owner: "cs-reg", group: "measure", labels: ["Quality"], collaborators: ["Mira Okada"], updatedAt: "2026-03-16" },
  { id: "m42", label: "Social GMV run rate", type: "measure", owner: "ch-digital", group: "measure", labels: ["Digital"], collaborators: ["Avery Singh"], updatedAt: "2026-04-03" },
  { id: "m43", label: "Contracts renewed on time", type: "measure", owner: "ph-commercial", group: "measure", labels: ["Market"], collaborators: ["Kai Lindstrom"], updatedAt: "2026-03-20" },
  { id: "m44", label: "Internal mobility %", type: "measure", owner: "ef-hr", group: "measure", labels: ["HR"], collaborators: ["Luis Ortega"], updatedAt: "2026-03-08" },
  { id: "m45", label: "Capital decision SLA", type: "measure", owner: "bom", group: "measure", labels: ["Governance"], collaborators: ["Theo Brampton"], updatedAt: "2026-03-22" },
  { id: "m46", label: "Category share trend", type: "measure", owner: "ch", group: "measure", labels: ["Brand"], collaborators: ["Rafael Costa"], updatedAt: "2026-03-24" },
  { id: "m47", label: "Biologicals volume mix", type: "measure", owner: "cs", group: "measure", labels: ["Innovation"], collaborators: ["Devon Malik"], updatedAt: "2026-03-17" },
  { id: "m48", label: "Pipeline phase transitions", type: "measure", owner: "ph", group: "measure", labels: ["Pipeline"], collaborators: ["Mira Okada"], updatedAt: "2026-03-12" },
];

export const TEAM_BY_ID = new Map(
  rawNodes.filter((n) => n.type === "team").map((n) => [n.id, n]),
);

export const TEAM_NODE_BY_ID = TEAM_BY_ID;

const rawLinks = [
  // Strategic → Outcomes
  { source: "sp1", target: "o1", type: "strategic" },
  { source: "sp1", target: "o2", type: "strategic" },
  { source: "sp1", target: "o3", type: "strategic" },
  { source: "sp2", target: "o4", type: "strategic" },
  { source: "sp2", target: "o7", type: "strategic" },
  { source: "sp2", target: "o9", type: "strategic" },
  { source: "sp3", target: "o5", type: "strategic" },
  { source: "sp3", target: "o8", type: "strategic" },
  { source: "sp1", target: "o6", type: "strategic" },
  ...(function extraStrategicO10ToO32() {
    const out = [];
    const sps = ["sp1", "sp2", "sp3"];
    for (let i = 10; i <= 50; i++) {
      if (i === 27 || i === 28) continue;
      out.push({ source: sps[(i - 10) % 3], target: `o${i}`, type: "strategic" });
    }
    return out;
  })(),
  // Team → Outcomes (ownership)
  { source: "ef-finance", target: "o1", type: "owns" },
  { source: "ch-brand", target: "o2", type: "owns" },
  { source: "ph-rd", target: "o3", type: "owns" },
  { source: "ef-it", target: "o4", type: "owns" },
  { source: "ch-brand", target: "o5", type: "owns" },
  { source: "ef-hr", target: "o6", type: "owns" },
  { source: "ef-legal", target: "o7", type: "owns" },
  { source: "ph-commercial", target: "o8", type: "owns" },
  { source: "cs-field", target: "o9", type: "owns" },
  { source: "bom", target: "o10", type: "owns" },
  { source: "bom", target: "o11", type: "owns" },
  { source: "ch", target: "o12", type: "owns" },
  { source: "ch", target: "o13", type: "owns" },
  { source: "ch-digital", target: "o14", type: "owns" },
  { source: "ch-digital", target: "o15", type: "owns" },
  { source: "cs", target: "o16", type: "owns" },
  { source: "cs", target: "o17", type: "owns" },
  { source: "cs-field", target: "o18", type: "owns" },
  { source: "cs-reg", target: "o19", type: "owns" },
  { source: "cs-reg", target: "o20", type: "owns" },
  { source: "ef", target: "o21", type: "owns" },
  { source: "ef", target: "o22", type: "owns" },
  { source: "ef-finance", target: "o23", type: "owns" },
  { source: "ef-it", target: "o24", type: "owns" },
  { source: "ef-hr", target: "o25", type: "owns" },
  { source: "ef-legal", target: "o26", type: "owns" },
  { source: "ph", target: "o29", type: "owns" },
  { source: "ph", target: "o30", type: "owns" },
  { source: "ph-rd", target: "o31", type: "owns" },
  { source: "ph-commercial", target: "o32", type: "owns" },
  { source: "cs-field", target: "o33", type: "owns" },
  { source: "cs-field", target: "o34", type: "owns" },
  { source: "cs-field", target: "o35", type: "owns" },
  { source: "ef-finance", target: "o36", type: "owns" },
  { source: "ef-finance", target: "o37", type: "owns" },
  { source: "ph-rd", target: "o38", type: "owns" },
  { source: "ph-rd", target: "o39", type: "owns" },
  { source: "ch-brand", target: "o40", type: "owns" },
  { source: "ef-it", target: "o41", type: "owns" },
  { source: "cs-reg", target: "o42", type: "owns" },
  { source: "cs-reg", target: "o43", type: "owns" },
  { source: "ch-digital", target: "o44", type: "owns" },
  { source: "ph-commercial", target: "o45", type: "owns" },
  { source: "ef-hr", target: "o46", type: "owns" },
  { source: "bom", target: "o47", type: "owns" },
  { source: "ch", target: "o48", type: "owns" },
  { source: "cs", target: "o49", type: "owns" },
  { source: "ph", target: "o50", type: "owns" },
  // Cross-team alignment (detail panel only — not drawn on the graph)
  { source: "ef-finance", target: "o3", type: "aligned" },
  { source: "ef-finance", target: "o9", type: "aligned" },
  { source: "ef-it", target: "o3", type: "aligned" },
  { source: "ef-it", target: "o8", type: "aligned" },
  { source: "ph-rd", target: "o6", type: "aligned" },
  { source: "cs-field", target: "o4", type: "aligned" },
  { source: "ch-brand", target: "o1", type: "aligned" },
  { source: "ch", target: "o23", type: "aligned" },
  { source: "ph", target: "o21", type: "aligned" },
  { source: "ef-finance", target: "o33", type: "aligned" },
  { source: "ef-it", target: "o33", type: "aligned" },
  { source: "ch-brand", target: "o33", type: "aligned" },
  { source: "ph-rd", target: "o34", type: "aligned" },
  { source: "cs-reg", target: "o34", type: "aligned" },
  { source: "ef-finance", target: "o36", type: "aligned" },
  { source: "cs-field", target: "o36", type: "aligned" },
  { source: "ch", target: "o36", type: "aligned" },
  { source: "ef-it", target: "o38", type: "aligned" },
  { source: "bom", target: "o38", type: "aligned" },
  { source: "cs-field", target: "o40", type: "aligned" },
  { source: "ph-commercial", target: "o41", type: "aligned" },
  { source: "ch-digital", target: "o42", type: "aligned" },
  { source: "ef-hr", target: "o45", type: "aligned" },
  { source: "ph-rd", target: "o45", type: "aligned" },
  // Outcomes → Measures
  { source: "o1", target: "m1", type: "measures" },
  { source: "o2", target: "m2", type: "measures" },
  { source: "o3", target: "m3", type: "measures" },
  { source: "o4", target: "m4", type: "measures" },
  { source: "o5", target: "m5", type: "measures" },
  { source: "o10", target: "m6", type: "measures" },
  { source: "o12", target: "m7", type: "measures" },
  { source: "o20", target: "m8", type: "measures" },
  { source: "o21", target: "m9", type: "measures" },
  { source: "o31", target: "m10", type: "measures" },
  { source: "o32", target: "m11", type: "measures" },
  { source: "o18", target: "m12", type: "measures" },
  { source: "o6", target: "m13", type: "measures" },
  { source: "o7", target: "m14", type: "measures" },
  { source: "o8", target: "m15", type: "measures" },
  { source: "o9", target: "m16", type: "measures" },
  { source: "o11", target: "m17", type: "measures" },
  { source: "o13", target: "m18", type: "measures" },
  { source: "o14", target: "m19", type: "measures" },
  { source: "o15", target: "m20", type: "measures" },
  { source: "o16", target: "m21", type: "measures" },
  { source: "o17", target: "m22", type: "measures" },
  { source: "o19", target: "m23", type: "measures" },
  { source: "o22", target: "m24", type: "measures" },
  { source: "o23", target: "m25", type: "measures" },
  { source: "o24", target: "m26", type: "measures" },
  { source: "o25", target: "m27", type: "measures" },
  { source: "o26", target: "m28", type: "measures" },
  { source: "o29", target: "m29", type: "measures" },
  { source: "o30", target: "m30", type: "measures" },
  { source: "o33", target: "m31", type: "measures" },
  { source: "o34", target: "m32", type: "measures" },
  { source: "o35", target: "m33", type: "measures" },
  { source: "o36", target: "m34", type: "measures" },
  { source: "o37", target: "m35", type: "measures" },
  { source: "o38", target: "m36", type: "measures" },
  { source: "o39", target: "m37", type: "measures" },
  { source: "o40", target: "m38", type: "measures" },
  { source: "o41", target: "m39", type: "measures" },
  { source: "o42", target: "m40", type: "measures" },
  { source: "o43", target: "m41", type: "measures" },
  { source: "o44", target: "m42", type: "measures" },
  { source: "o45", target: "m43", type: "measures" },
  { source: "o46", target: "m44", type: "measures" },
  { source: "o47", target: "m45", type: "measures" },
  { source: "o48", target: "m46", type: "measures" },
  { source: "o49", target: "m47", type: "measures" },
  { source: "o50", target: "m48", type: "measures" },
  ...teamHierarchyLinks,
];

const timeFrameOptions = [
  "Active cycle (Q2 2026)",
  "Last cycle (Q1 2026)",
  "Next cycle (Q3 2026)",
  "Full Year 2026",
  "Full Year 2025",
  "3-Year View (2024–2026)",
];

/** Sidebar: status filters; score ranges match the 1–10-style band used with each status (draft has no score band). */
const confidenceLevels = [
  { key: "on-track", label: "On track", color: COLORS.onTrack, scoreRange: "7–10" },
  { key: "challenge", label: "Challenge", color: COLORS.challenge, scoreRange: "4–6" },
  { key: "off-track", label: "Off track", color: COLORS.offTrack, scoreRange: "1–3" },
  { key: "draft", label: "Draft", color: COLORS.draft, scoreRange: null },
];

const individuals = [
  "Devon Malik", "Theo Brampton", "Mira Okada",
  "Rafael Costa", "Kai Lindstrom", "Sofia Renner",
  "Avery Singh", "Luis Ortega",
];

/** Mock mapping for #3100 — filter by individual narrows to that person’s primary team context (leaf teams) */
const INDIVIDUAL_TO_TEAM = {
  "Theo Brampton": "EF Corporate Finance",
  "Mira Okada": "EF Corporate Finance",
  "Devon Malik": "PH Global R&D",
  "Rafael Costa": "CS Field & Regions",
  "Kai Lindstrom": "PH Global R&D",
  "Sofia Renner": "EF IT & Digital",
  "Avery Singh": "CH Brand Marketing",
  "Luis Ortega": "EF People & Talent",
};

const ALL_LABELS = [...new Set(rawNodes.flatMap((n) => n.labels || []))].sort();
const COLLABORATOR_OPTIONS = [...new Set(rawNodes.flatMap((n) => n.collaborators || []))].sort();
const DEACTIVATED_COLLABORATORS = ["Inactive User (archived)"];

export {
  TEAM_SPECS,
  teamNodesFromSpec,
  teamHierarchyLinks,
  TEAM_PARENT_ORDER,
  TEAM_SELECT_OPTIONS,
  rawNodes,
  rawLinks,
  timeFrameOptions,
  confidenceLevels,
  individuals,
  INDIVIDUAL_TO_TEAM,
  ALL_LABELS,
  COLLABORATOR_OPTIONS,
  DEACTIVATED_COLLABORATORS,
};
