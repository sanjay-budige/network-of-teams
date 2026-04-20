import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const src = path.join(root, "src/components/NetworkOfTeams.jsx");
const L = fs.readFileSync(src, "utf8").split(/\r?\n/);
const join = (a, b) => L.slice(a - 1, b).join("\n");

const outDir = path.join(root, "src/components/network-of-teams");
fs.mkdirSync(path.join(outDir, "data"), { recursive: true });

const graphData = `import { COLORS } from "../constants.js";

${join(55, 109)}

${join(111, 217)}

export const TEAM_BY_ID = new Map(
  rawNodes.filter((n) => n.type === "team").map((n) => [n.id, n]),
);

export const TEAM_NODE_BY_ID = TEAM_BY_ID;

${join(291, 435)}

${join(437, 474)}
`;

fs.writeFileSync(path.join(outDir, "data/graphData.js"), graphData);

const search = `import { ORG_LABEL, TEAM_BY_ID } from "./data/graphData.js";

${join(221, 289)}
`;

fs.writeFileSync(path.join(outDir, "search.js"), search);

const filterModel = `import {
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

${join(478, 513)}

${join(567, 639)}

${join(734, 741)}
`;

fs.writeFileSync(path.join(outDir, "filterModel.js"), filterModel);

const drag = `${join(641, 661)}
`;

fs.writeFileSync(path.join(outDir, "drag.js"), drag);

const layout = `import { ORG_ROOT_ID } from "./constants.js";
import { TEAM_PARENT_ORDER, TEAM_SPECS } from "./data/graphData.js";

${join(663, 675)}

${join(681, 694)}

${join(744, 802)}

${join(807, 823)}

${join(831, 941)}

${join(943, 945)}
`;

fs.writeFileSync(path.join(outDir, "layout.js"), layout);

const graphQueries = `import { rawNodes, rawLinks } from "./data/graphData.js";

${join(705, 731)}
`;

fs.writeFileSync(path.join(outDir, "graphQueries.js"), graphQueries);

const appearance = `import { COLORS, TEAM_DIM_ORG, TEAM_DIM_LEAF } from "./constants.js";
import { TEAM_SPECS } from "./data/graphData.js";
import { isOrgTeam } from "./filterModel.js";

${join(515, 565)}

${join(697, 703)}

${join(947, 967)}
`;

fs.writeFileSync(path.join(outDir, "appearance.js"), appearance);

const legend = `import { COLORS } from "./constants.js";
import { GRAPH, PANEL } from "./constants.js";
import { hexPoints } from "./appearance.js";

${join(969, 1120)}
`;

fs.writeFileSync(path.join(outDir, "NetworkLegend.jsx"), legend);

console.log("Done", outDir);
