import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import * as d3 from "d3";

import { COLORS, GRAPH, PANEL, ORG_ROOT_ID, ORG_LABEL } from "./constants.js";
import {
  rawNodes,
  rawLinks,
  TEAM_SELECT_OPTIONS,
  TEAM_NODE_BY_ID,
  timeFrameOptions,
  confidenceLevels,
  individuals,
  INDIVIDUAL_TO_TEAM,
  ALL_LABELS,
  COLLABORATOR_OPTIONS,
} from "./data/graphData.js";
import {
  parseSearchTokens,
  normalizeSearchString,
  matchesSearchTokens,
  buildMeasureSearchHaystack,
} from "./search.js";
import {
  filterOutcomesForExplorer,
  teamClosureForOutcomeIds,
  getOwnedOutcomeIdsForTeam,
  collectDescendantTeamIds,
} from "./filterModel.js";
import {
  layoutTeamNodes,
  layoutOutcomesAroundTeams,
  clipLineToCircles,
  curvedChordPath,
  linkEndpointTeamId,
  divisionHasSubTeams,
} from "./layout.js";
import {
  getNodeColor,
  getConfidenceAccent,
  outcomeProgressPct,
  applyGraphLabelLod,
  hexPoints,
  hexStroke,
  teamShapeFill,
} from "./appearance.js";
import { teamLabelById, alignmentTeamsForOutcome, measuresForOutcome } from "./graphQueries.js";
import { clampNodeDrag, applyDragToPositions } from "./drag.js";
import { GraphLegendPanel } from "./NetworkLegend.jsx";

export default function NetworkOfTeams() {
  const svgRef = useRef(null);
  /** Plot region below the top bar — sized with ResizeObserver for correct radial layout on resize / panels. */
  const chartContainerRef = useRef(null);
  const [chartSize, setChartSize] = useState({ w: 0, h: 0 });
  const [selectedNode, setSelectedNode] = useState(null);
  const [filters, setFilters] = useState({
    keyword: "",
    confidence: { "on-track": true, challenge: true, "off-track": true, draft: true },
    individual: "",
    team: "",
    selectedCollaborators: [],
    selectedLabels: [],
    changesSince: "",
    includeDeactivated: false,
    level: { team: true, organization: true },
    timeFrame: "Active cycle (Q2 2026)",
    showMeasures: true,
    highlightMyTeam: false,
  });
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false);
  /** null = show organizations (divisions) only; set to a division id to show its sub-teams. */
  const [expandedOrgId, setExpandedOrgId] = useState(null);
  /** When set, graph shows only outcomes owned by this team (and descendants), not aligned-only (drill-down). */
  const [expandedTeamId, setExpandedTeamId] = useState(null);
  /** Per-outcome: show linked measures in a small cluster outside that outcome. */
  const [expandedMeasures, setExpandedMeasures] = useState({});
  /** User drag nudges (px) for graph nodes — bubble-like repositioning. */
  const [nodeDragOffsets, setNodeDragOffsets] = useState({});
  const [zoomPct, setZoomPct] = useState(100);
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
  /** Legend is secondary UI — start collapsed so primary filters stay visible. */
  const [legendExpanded, setLegendExpanded] = useState(false);
  const zoomBehaviorRef = useRef(null);
  const zoomTransformRef = useRef(d3.zoomIdentity);

  const getFilteredData = useCallback(() => {
    let links = [...rawLinks];

    let outcomes = filterOutcomesForExplorer(
      rawNodes.filter((n) => n.type === "outcome"),
      links,
      filters,
      { skipConfidenceFilter: false },
    );

    const outcomeIdSet = new Set(outcomes.map((o) => o.id));

    const teamIdSet = teamClosureForOutcomeIds(outcomeIdSet, links, rawNodes);
    const teams = rawNodes.filter((n) => n.type === "team" && teamIdSet.has(n.id));

    let measures = [];
    if (filters.showMeasures) {
      measures = rawNodes.filter(
        (n) =>
          n.type === "measure" &&
          links.some((l) => l.type === "measures" && l.target === n.id && outcomeIdSet.has(l.source)),
      );
      if (filters.changesSince) {
        const cutoff = filters.changesSince;
        measures = measures.filter((m) => m.updatedAt && m.updatedAt >= cutoff);
      }
      if (filters.keyword?.trim()) {
        const tokens = parseSearchTokens(filters.keyword);
        if (tokens.length) {
          const phrase = normalizeSearchString(filters.keyword);
          measures = measures.filter((m) =>
            matchesSearchTokens(buildMeasureSearchHaystack(m), tokens, phrase),
          );
        }
      }
    }

    const strategic = rawNodes.filter((n) => n.type === "strategic");

    const byId = new Map();
    for (const n of teams) byId.set(n.id, n);
    for (const n of outcomes) byId.set(n.id, n);
    for (const n of measures) byId.set(n.id, n);
    for (const n of strategic) byId.set(n.id, n);
    const nodes = [...byId.values()];

    const nodeIds = new Set(nodes.map((n) => n.id));
    links = links.filter((l) => nodeIds.has(l.source) && nodeIds.has(l.target));

    return { nodes, links };
  }, [filters]);

  useEffect(() => {
    const { nodes } = getFilteredData();
    const teamIds = new Set(nodes.filter((n) => n.type === "team").map((n) => n.id));
    if (expandedOrgId && !teamIds.has(expandedOrgId)) setExpandedOrgId(null);
    if (expandedTeamId && !teamIds.has(expandedTeamId)) setExpandedTeamId(null);
  }, [getFilteredData, expandedOrgId, expandedTeamId]);

  useEffect(() => {
    setNodeDragOffsets({});
  }, [expandedOrgId, expandedTeamId]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        setSelectedNode(null);
        setExpandedTeamId(null);
        setExpandedMeasures({});
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const el = chartContainerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    let raf = 0;
    const measure = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        const w = Math.max(280, Math.floor(r.width));
        const h = Math.max(200, Math.floor(r.height));
        setChartSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [leftSidebarOpen]);

  useEffect(() => {
    const svgEl = svgRef.current;
    const containerEl = chartContainerRef.current;
    if (!svgEl) return;

    const width =
      chartSize.w > 0 ? chartSize.w : containerEl?.clientWidth || svgEl.clientWidth || 900;
    const height =
      chartSize.h > 0 ? chartSize.h : containerEl?.clientHeight || svgEl.clientHeight || 600;

    const svg = d3.select(svgEl);
    svg.selectAll("*").remove();

    const cx = width / 2;
    const cy = height / 2;
    const minDim = Math.min(width, height);

    svg.append("rect").attr("width", width).attr("height", height).attr("fill", GRAPH.bg).attr("pointer-events", "all");

    const { nodes: filteredNodes, links: allLinks } = getFilteredData();
    const teams = filteredNodes.filter((n) => n.type === "team");
    const allOutcomes = filteredNodes.filter((n) => n.type === "outcome");
    const measurePool = filteredNodes.filter((n) => n.type === "measure");

    const visibleOutcomeIds =
      expandedTeamId != null ? getOwnedOutcomeIdsForTeam(expandedTeamId, allLinks) : new Set();
    const outcomes = allOutcomes.filter((o) => visibleOutcomeIds.has(o.id));

    const { positions, roots, divR, leafR, hubR } = layoutTeamNodes(teams, cx, cy, minDim, expandedOrgId);

    const outcomeR = Math.round(Math.max(26, Math.min(36, minDim * 0.034)));
    const measureR = 13;

    if (outcomes.length) {
      layoutOutcomesAroundTeams({
        outcomes,
        positions,
        allLinks,
        cx,
        cy,
        hubR,
        outcomeR,
        nodeById: TEAM_NODE_BY_ID,
        focusTeamId: expandedTeamId,
        minDim,
      });
    }

    if (filters.showMeasures && outcomes.length) {
      outcomes.forEach((o) => {
        if (!expandedMeasures[o.id]) return;
        const po = positions[o.id];
        if (!po) return;
        const dist = Math.hypot(po.x - cx, po.y - cy) || 1;
        const ux = (po.x - cx) / dist;
        const uy = (po.y - cy) / dist;
        const px = -uy;
        const py = ux;
        const linkedMeasures = measurePool.filter((m) =>
          allLinks.some((l) => l.source === o.id && l.target === m.id && l.type === "measures"),
        );
        const measureRing = Math.max(104, minDim * 0.11);
        linkedMeasures.forEach((m, j) => {
          const spread = (j - (linkedMeasures.length - 1) / 2) * Math.max(48, minDim * 0.048);
          positions[m.id] = {
            x: po.x + ux * measureRing + px * spread,
            y: po.y + uy * measureRing + py * spread,
            r: measureR,
          };
        });
      });
    }

    const displayPos = applyDragToPositions(positions, nodeDragOffsets);

    const pHub = displayPos[ORG_ROOT_ID];
    const linkLines = [];

    roots.forEach((root) => {
      const p = displayPos[root.id];
      if (p && pHub) {
        const seg = clipLineToCircles(p.x, p.y, p.r, pHub.x, pHub.y, pHub.r);
        linkLines.push({
          ...seg,
          key: `hub-${root.id}`,
          marker: false,
          dashed: true,
          stroke: "#cbd5e1",
          sw: 1.1,
          opacity: 0.85,
        });
      }
    });

    allLinks
      .filter((l) => l.type === "nested")
      .forEach((l) => {
        const a = displayPos[l.source];
        const b = displayPos[l.target];
        if (a && b) {
          linkLines.push({
            key: `nested-${l.source}-${l.target}`,
            marker: false,
            dashed: false,
            stroke: COLORS.organization,
            sw: 1.5,
            opacity: 0.88,
            curvePath: curvedChordPath(a.x, a.y, a.r, b.x, b.y, b.r, cx, cy, minDim, 1),
          });
        }
      });

    if (outcomes.length) {
      outcomes.forEach((o) => {
        const pO = displayPos[o.id];
        if (!pO) return;
        const own = allLinks.find((l) => l.type === "owns" && l.target === o.id);
        if (own) {
          const fromId = linkEndpointTeamId(own.source, positions, TEAM_NODE_BY_ID);
          const pTeam = displayPos[fromId];
          if (pTeam) {
            linkLines.push({
              key: `owns-${o.id}`,
              marker: false,
              dashed: true,
              stroke: COLORS.outcome,
              sw: 1.15,
              opacity: 0.78,
              curvePath: curvedChordPath(
                pO.x,
                pO.y,
                pO.r,
                pTeam.x,
                pTeam.y,
                pTeam.r,
                cx,
                cy,
                minDim,
                0.38,
              ),
            });
          }
        }

        if (filters.showMeasures && expandedMeasures[o.id]) {
          const linkedMeasures = measurePool.filter((m) =>
            allLinks.some((l) => l.source === o.id && l.target === m.id && l.type === "measures"),
          );
          linkedMeasures.forEach((m) => {
            const pM = displayPos[m.id];
            const pOwn = displayPos[o.id];
            if (!pM || !pOwn) return;
            const segM = clipLineToCircles(pM.x, pM.y, pM.r, pOwn.x, pOwn.y, pOwn.r);
            linkLines.push({
              ...segM,
              key: `to-outcome-${m.id}`,
              marker: true,
              dashed: true,
              stroke: GRAPH.link,
              sw: 1.2,
              opacity: 1,
            });
          });
        }
      });
    }

    const bindBubbleDrag = (id) =>
      d3
        .drag()
        .clickDistance(8)
        .filter((event) => !event.target?.closest?.("[data-no-bubble-drag]"))
        .on("start", (event) => {
          event.sourceEvent.stopPropagation();
        })
        .on("drag", (event) => {
          event.sourceEvent.stopPropagation();
          setNodeDragOffsets((prev) => {
            const o = prev[id] || { dx: 0, dy: 0 };
            return { ...prev, [id]: clampNodeDrag(o.dx + event.dx, o.dy + event.dy) };
          });
        });

    const gRoot = svg.append("g").attr("class", "radial-zoom-root");
    const zb = d3
      .zoom()
      .scaleExtent([0.1, 4.2])
      .extent([
        [0, 0],
        [width, height],
      ])
      .filter((event) => {
        if (event.type === "dblclick") return false;
        const t = event.target;
        if (!t || typeof t.closest !== "function") return true;
        return !t.closest("[data-node-drag]");
      })
      .on("zoom", (e) => {
        zoomTransformRef.current = e.transform;
        gRoot.attr("transform", e.transform);
        setZoomPct(Math.round(e.transform.k * 100));
        applyGraphLabelLod(gRoot, e.transform.k);
      })
      .on("start", (e) => {
        const ev = e.sourceEvent;
        if (ev && (ev.type === "mousedown" || ev.type === "pointerdown") && ev.buttons === 1) {
          d3.select(svgEl).style("cursor", "grabbing");
        }
      })
      .on("end", () => {
        d3.select(svgEl).style("cursor", "grab");
      });
    zoomBehaviorRef.current = zb;
    svg.call(zb);
    d3.select(svgEl).style("cursor", "grab");
    gRoot.attr("transform", zoomTransformRef.current);
    svg.call(zb.transform, zoomTransformRef.current);
    setZoomPct(Math.round(zoomTransformRef.current.k * 100));

    const defs = svg.append("defs");
    defs
      .append("marker")
      .attr("id", "arrowRadial")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 6)
      .attr("refY", 0)
      .attr("markerWidth", 5)
      .attr("markerHeight", 5)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", GRAPH.link);

    const gridG = gRoot.append("g").attr("pointer-events", "none");
    const maxGridR = minDim * 0.88;
    for (let i = 1; i <= 6; i++) {
      gridG
        .append("circle")
        .attr("cx", cx)
        .attr("cy", cy)
        .attr("r", (maxGridR / 6) * i)
        .attr("fill", "none")
        .attr("stroke", GRAPH.grid)
        .attr("stroke-opacity", 0.4)
        .attr("stroke-width", 1);
    }

    const main = gRoot.append("g");

    const linkLayer = main.append("g").attr("pointer-events", "none").attr("class", "graph-edges");
    const curvedLinks = linkLines.filter((d) => d.curvePath);
    const straightLinks = linkLines.filter((d) => !d.curvePath);

    linkLayer
      .selectAll("path.graph-edge-curve")
      .data(curvedLinks)
      .join("path")
      .attr("class", "graph-edge-curve")
      .attr("d", (d) => d.curvePath)
      .attr("fill", "none")
      .attr("stroke", (d) => d.stroke || GRAPH.link)
      .attr("stroke-width", (d) => d.sw ?? 1.25)
      .attr("stroke-opacity", (d) => d.opacity ?? 1)
      .attr("stroke-dasharray", (d) => (d.dashed ? GRAPH.linkDash : "none"))
      .attr("stroke-linecap", "round")
      .attr("stroke-linejoin", "round")
      .attr("marker-end", (d) => (d.marker ? "url(#arrowRadial)" : null));

    linkLayer
      .selectAll("line.graph-edge-line")
      .data(straightLinks)
      .join("line")
      .attr("class", "graph-edge-line")
      .attr("x1", (d) => d.x1)
      .attr("y1", (d) => d.y1)
      .attr("x2", (d) => d.x2)
      .attr("y2", (d) => d.y2)
      .attr("stroke", (d) => d.stroke || GRAPH.link)
      .attr("stroke-width", (d) => d.sw ?? 1.25)
      .attr("stroke-opacity", (d) => d.opacity ?? 1)
      .attr("stroke-dasharray", (d) => (d.dashed ? GRAPH.linkDash : "none"))
      .attr("marker-end", (d) => (d.marker ? "url(#arrowRadial)" : null));

    const hubG = main.append("g").attr("transform", `translate(${cx},${cy})`);

    hubG
      .append("circle")
      .attr("r", hubR)
      .attr("fill", GRAPH.hubFill)
      .attr("stroke", GRAPH.hubStroke)
      .attr("stroke-width", 2)
      .style("pointer-events", "none");

    hubG
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "0.35em")
      .attr("fill", GRAPH.text)
      .attr("font-size", 13)
      .attr("font-weight", 700)
      .attr("font-family", "Inter, system-ui, sans-serif")
      .style("pointer-events", "none")
      .text(ORG_LABEL);

    const teamG = main.append("g").attr("class", "team-nodes");
    teams.forEach((t) => {
      const pos = displayPos[t.id];
      if (!pos) return;
      const g = teamG
        .append("g")
        .attr("data-node-drag", "true")
        .attr("transform", `translate(${pos.x},${pos.y})`)
        .style("cursor", "grab")
        .call(bindBubbleDrag(t.id));
      const r = t.parentId ? leafR : divR;
      const col = getNodeColor(t, { highlightMyTeam: filters.highlightMyTeam });
      const isSel = selectedNode?.id === t.id;
      const isOutcomeFocus = expandedTeamId === t.id;
      const stroke = isOutcomeFocus ? COLORS.accent : isSel ? "#0f172a" : hexStroke(col);
      const fill = teamShapeFill(col);
      const isHex = !t.parentId;
      const isDivision = isHex;
      const hasSubs = isDivision && divisionHasSubTeams(t.id);
      const orgExpanded = expandedOrgId === t.id;

      const shapeClick = (e) => {
        e.stopPropagation();
        setSelectedNode(t);
        setExpandedTeamId((cur) => (cur === t.id ? null : t.id));
      };

      if (isHex) {
        g.append("polygon")
          .attr("points", hexPoints(r))
          .attr("fill", fill)
          .attr("stroke", stroke)
          .attr("stroke-width", isOutcomeFocus ? 3 : isSel ? 2.5 : 2)
          .style("cursor", hasSubs ? "pointer" : "pointer")
          .on("click", shapeClick);
      } else {
        g.append("circle")
          .attr("r", r)
          .attr("fill", fill)
          .attr("stroke", stroke)
          .attr("stroke-width", isOutcomeFocus ? 3 : isSel ? 2.5 : 2)
          .style("cursor", "pointer")
          .on("click", shapeClick);
      }

      if (hasSubs) {
        const tg = g
          .append("g")
          .attr("data-no-bubble-drag", "true")
          .attr("transform", `translate(${r * 0.78}, ${-r * 0.72})`)
          .style("cursor", "pointer")
          .on("click", (e) => {
            e.stopPropagation();
            setSelectedNode(t);
            setExpandedOrgId((cur) => (cur === t.id ? null : t.id));
          });
        tg.append("circle").attr("r", 11).attr("fill", COLORS.accent).attr("stroke", "#fff").attr("stroke-width", 1.5);
        tg.append("text")
          .attr("text-anchor", "middle")
          .attr("dy", "0.35em")
          .attr("fill", "#fff")
          .attr("font-size", 13)
          .attr("font-weight", 700)
          .text(orgExpanded ? "\u2212" : "+");
      }

      const short =
        t.label.length > (t.parentId ? 26 : 22)
          ? `${t.label.slice(0, t.parentId ? 24 : 20)}…`
          : t.label;
      g.append("text")
        .attr("class", "lod-medium")
        .attr("text-anchor", "middle")
        .attr("y", r + 16)
        .attr("fill", GRAPH.text)
        .attr("font-size", t.parentId ? 10 : 10.5)
        .attr("font-weight", 600)
        .attr("font-family", "Inter, system-ui, sans-serif")
        .style("pointer-events", "none")
        .text(short);
    });

    if (outcomes.length) {
      const og = main.append("g");

      outcomes.forEach((o) => {
        const pos = displayPos[o.id];
        if (!pos) return;
        const g = og
          .append("g")
          .attr("data-node-drag", "true")
          .attr("transform", `translate(${pos.x},${pos.y})`)
          .style("cursor", "grab")
          .call(bindBubbleDrag(o.id));

        const fill = getConfidenceAccent(o) || COLORS.challenge;
        const pct = outcomeProgressPct(o);
        const isSel = selectedNode?.id === o.id;

        g.append("circle")
          .attr("r", outcomeR)
          .attr("fill", fill)
          .attr("stroke", isSel ? "#0f172a" : "#ffffff")
          .attr("stroke-width", isSel ? 3.5 : 2.5)
          .style("cursor", "pointer")
          .style("filter", "drop-shadow(0 2px 6px rgba(15,23,42,0.12))")
          .on("click", (e) => {
            e.stopPropagation();
            setSelectedNode(o);
          });

        g.append("text")
          .attr("text-anchor", "middle")
          .attr("dy", "0.35em")
          .attr("fill", "#ffffff")
          .attr("font-size", 13)
          .attr("font-weight", 800)
          .attr("font-family", "Inter, system-ui, sans-serif")
          .style("pointer-events", "none")
          .style("text-shadow", "0 1px 2px rgba(0,0,0,0.25)")
          .text(`${pct}%`);

        const short = o.label.length > 42 ? `${o.label.slice(0, 40)}…` : o.label;
        g.append("text")
          .attr("class", "lod-fine")
          .attr("text-anchor", "middle")
          .attr("y", outcomeR + 18)
          .attr("fill", GRAPH.outcomeLabelStrong)
          .attr("font-size", 11)
          .attr("font-weight", 600)
          .attr("font-family", "Inter, system-ui, sans-serif")
          .style("pointer-events", "none")
          .text(short);

        const hasMeasures =
          filters.showMeasures && allLinks.some((l) => l.source === o.id && l.type === "measures");

        if (hasMeasures) {
          const exp = !!expandedMeasures[o.id];
          const tg = g
            .append("g")
            .attr("data-no-bubble-drag", "true")
            .attr("transform", `translate(${outcomeR * 0.78}, ${-outcomeR * 0.68})`)
            .style("cursor", "pointer")
            .on("click", (e) => {
              e.stopPropagation();
              setExpandedMeasures((prev) => ({ ...prev, [o.id]: !prev[o.id] }));
            });

          tg.append("circle").attr("r", 11).attr("fill", fill).attr("stroke", "#fff").attr("stroke-width", 1.5);

          tg.append("text")
            .attr("text-anchor", "middle")
            .attr("dy", "0.35em")
            .attr("fill", "#fff")
            .attr("font-size", 14)
            .attr("font-weight", 700)
            .text(exp ? "\u2212" : "+");
        }
      });

      if (filters.showMeasures) {
        measurePool.forEach((m) => {
          const pos = displayPos[m.id];
          if (!pos) return;
          const g = og
            .append("g")
            .attr("data-node-drag", "true")
            .attr("transform", `translate(${pos.x},${pos.y})`)
            .style("cursor", "grab")
            .call(bindBubbleDrag(m.id));

          g.append("circle")
            .attr("r", measureR)
            .attr("fill", GRAPH.measureFill)
            .attr("stroke", GRAPH.measureStroke)
            .attr("stroke-width", 1.8)
            .style("cursor", "pointer")
            .on("click", (e) => {
              e.stopPropagation();
              setSelectedNode(m);
            });

          const short = m.label.length > 22 ? `${m.label.slice(0, 20)}…` : m.label;
          g.append("text")
            .attr("class", "lod-fine")
            .attr("text-anchor", "middle")
            .attr("y", measureR + 12)
            .attr("fill", GRAPH.textMuted)
            .attr("font-size", 9)
            .attr("font-family", "Inter, system-ui, sans-serif")
            .style("pointer-events", "none")
            .text(short);
        });
      }
    }

    svg.on("click", () => {
      setSelectedNode(null);
      setExpandedTeamId(null);
      setExpandedMeasures({});
    });

    applyGraphLabelLod(gRoot, zoomTransformRef.current.k);

    return () => {
      svg.on("click", null);
      svg.on(".zoom", null);
    };
  }, [
    getFilteredData,
    filters.showMeasures,
    filters.highlightMyTeam,
    expandedMeasures,
    selectedNode,
    expandedOrgId,
    expandedTeamId,
    nodeDragOffsets,
    leftSidebarOpen,
    chartSize.w,
    chartSize.h,
  ]);

  const toggleConfidence = (key) => setFilters(f => ({ ...f, confidence: { ...f.confidence, [key]: !f.confidence[key] } }));

  const sectionHeading = {
    fontSize: 9,
    color: COLORS.textMuted,
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    marginBottom: 10,
    fontWeight: 600,
  };

  const sidebarHeading = {
    fontSize: 9,
    color: PANEL.textMuted,
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    marginBottom: 10,
    fontWeight: 600,
  };

  const filtered = getFilteredData();
  const teamCount = filtered.nodes.filter((n) => n.type === "team").length;
  const outcomeCount = filtered.nodes.filter((n) => n.type === "outcome").length;
  const expandedOrgLabel =
    expandedOrgId && rawNodes.find((n) => n.id === expandedOrgId && n.type === "team")?.label;
  const expandedTeamLabel =
    expandedTeamId && rawNodes.find((n) => n.id === expandedTeamId && n.type === "team")?.label;
  const focusedOutcomeCount =
    expandedTeamId != null
      ? filtered.nodes.filter(
          (n) =>
            n.type === "outcome" &&
            getOwnedOutcomeIdsForTeam(expandedTeamId, filtered.links).has(n.id),
        ).length
      : 0;

  const resetGraphZoom = () => {
    const el = svgRef.current;
    if (!el || !zoomBehaviorRef.current) return;
    zoomTransformRef.current = d3.zoomIdentity;
    d3.select(el).transition().duration(200).call(zoomBehaviorRef.current.transform, d3.zoomIdentity);
    setZoomPct(100);
  };

  const nudgeZoom = (factor) => {
    const el = svgRef.current;
    if (!el || !zoomBehaviorRef.current) return;
    const svg = d3.select(el);
    svg.transition().duration(150).call(zoomBehaviorRef.current.scaleBy, factor);
  };

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        background: GRAPH.bg,
        color: GRAPH.text,
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        overflow: "hidden",
      }}
    >
      {/* Collapsed rail — reopen filters */}
      {!leftSidebarOpen && (
        <div
          style={{
            width: 40,
            flexShrink: 0,
            background: PANEL.bg,
            borderRight: `1px solid ${PANEL.border}`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            paddingTop: 14,
            boxShadow: "2px 0 8px rgba(15,23,42,0.04)",
          }}
        >
          <button
            type="button"
            aria-label="Open filters and legend"
            title="Open filters"
            onClick={() => setLeftSidebarOpen(true)}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: `1px solid ${PANEL.border}`,
              background: PANEL.surface,
              color: PANEL.text,
              cursor: "pointer",
              fontSize: 14,
              lineHeight: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            »
          </button>
        </div>
      )}

      {/* Left Sidebar — light theme */}
      {leftSidebarOpen && (
      <div
        style={{
          width: 280,
          flexShrink: 0,
          background: PANEL.bg,
          borderRight: `1px solid ${PANEL.border}`,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          color: PANEL.text,
          boxShadow: "2px 0 12px rgba(15,23,42,0.04)",
        }}
      >
        {/* Header */}
        <div style={{ padding: "18px 16px 14px", borderBottom: `1px solid ${PANEL.border}`, background: PANEL.bg }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: 10,
                background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.team})`,
                boxShadow: `0 0 12px ${COLORS.accent}55`,
              }}
            />
            <div>
              <div style={{ fontSize: 12, color: PANEL.text, fontWeight: 700, letterSpacing: "-0.02em" }}>Network of Teams</div>
              <div style={{ fontSize: 10, color: COLORS.accent, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", marginTop: 2 }}>
                Explorer
              </div>
            </div>
            </div>
            <button
              type="button"
              aria-label="Collapse filters panel"
              title="Hide filters"
              onClick={() => setLeftSidebarOpen(false)}
              style={{
                flexShrink: 0,
                width: 30,
                height: 30,
                borderRadius: 8,
                border: `1px solid ${PANEL.border}`,
                background: PANEL.surface,
                color: PANEL.textMuted,
                cursor: "pointer",
                fontSize: 14,
                lineHeight: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              «
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: 16, background: PANEL.bg }}>
          {/* Primary filters */}
          <div style={{ marginBottom: 16 }}>
            <div style={sidebarHeading}>Primary filters</div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ fontSize: 9, color: PANEL.textMuted, textTransform: "uppercase", letterSpacing: "0.12em" }}>Team</div>
                {filters.team && <button type="button" onClick={() => setFilters(f => ({ ...f, team: "" }))} style={{ fontSize: 9, color: COLORS.accent, background: "none", border: "none", cursor: "pointer", padding: 0 }}>Clear</button>}
              </div>
              <select value={filters.team} onChange={e => setFilters(f => ({ ...f, team: e.target.value }))}
                style={{ width: "100%", background: PANEL.inputBg, border: `1px solid ${PANEL.border}`, color: filters.team ? PANEL.text : PANEL.textMuted, padding: "7px 10px", borderRadius: 6, fontSize: 11, cursor: "pointer", outline: "none" }}>
                <option value="">All teams</option>
                {TEAM_SELECT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              {(filters.team || (filters.individual && INDIVIDUAL_TO_TEAM[filters.individual])) && (
                <div style={{ marginTop: 8, padding: "6px 8px", background: COLORS.accent + "15", borderRadius: 4, fontSize: 9, color: COLORS.accent, border: `1px solid ${COLORS.accent}30` }}>
                  Cross-team alignment links stay visible
                </div>
              )}
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ fontSize: 9, color: PANEL.textMuted, textTransform: "uppercase", letterSpacing: "0.12em" }}>Confidence level</div>
                <button type="button" onClick={() => setFilters(f => ({ ...f, confidence: { "on-track": true, challenge: true, "off-track": true, draft: true } }))} style={{ fontSize: 9, color: COLORS.accent, background: "none", border: "none", cursor: "pointer", padding: 0 }}>Clear</button>
              </div>
              {confidenceLevels.map(c => (
                <label key={c.key} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginBottom: 6, userSelect: "none" }}>
                  <div onClick={() => toggleConfidence(c.key)} style={{ width: 14, height: 14, borderRadius: 3, border: `2px solid ${c.color}`, background: filters.confidence[c.key] ? c.color : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, cursor: "pointer" }}>
                    {filters.confidence[c.key] && <div style={{ width: 6, height: 6, background: "#ffffff", borderRadius: 1 }} />}
                  </div>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: c.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: PANEL.text, flex: 1, lineHeight: 1.35 }}>
                    {c.label}
                    {c.scoreRange != null && (
                      <span style={{ color: PANEL.textMuted, fontWeight: 400 }}> ({c.scoreRange})</span>
                    )}
                  </span>
                </label>
              ))}
            </div>

            <div style={{ marginBottom: 4 }}>
              <div style={{ fontSize: 9, color: PANEL.textMuted, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 8 }}>Time frame</div>
              <select value={filters.timeFrame} onChange={e => setFilters(f => ({ ...f, timeFrame: e.target.value }))}
                style={{ width: "100%", background: PANEL.inputBg, border: `1px solid ${PANEL.border}`, color: PANEL.text, padding: "7px 10px", borderRadius: 6, fontSize: 11, cursor: "pointer", outline: "none" }}>
                {timeFrameOptions.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
          </div>

          {/* Advanced filters (collapsed by default) */}
          <div style={{ borderTop: `1px solid ${PANEL.border}`, paddingTop: 12, marginBottom: 12 }}>
            <button
              type="button"
              onClick={() => setAdvancedFiltersOpen((o) => !o)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "none",
                border: "none",
                color: PANEL.text,
                cursor: "pointer",
                padding: "4px 0 8px",
                fontSize: 10,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
              }}
            >
              <span>Advanced filters</span>
              <span style={{ color: PANEL.textMuted, fontSize: 11 }}>{advancedFiltersOpen ? "\u25BE" : "\u25B8"}</span>
            </button>
            {advancedFiltersOpen && (
              <div>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div style={{ fontSize: 9, color: PANEL.textMuted, textTransform: "uppercase", letterSpacing: "0.12em" }}>Individual</div>
                    {filters.individual && <button type="button" onClick={() => setFilters(f => ({ ...f, individual: "" }))} style={{ fontSize: 9, color: COLORS.accent, background: "none", border: "none", cursor: "pointer", padding: 0 }}>Clear</button>}
                  </div>
                  <select value={filters.individual} onChange={e => setFilters(f => ({ ...f, individual: e.target.value }))}
                    style={{ width: "100%", background: PANEL.inputBg, border: `1px solid ${PANEL.border}`, color: filters.individual ? PANEL.text : PANEL.textMuted, padding: "7px 10px", borderRadius: 6, fontSize: 11, cursor: "pointer", outline: "none" }}>
                    <option value="">All individuals</option>
                    {individuals.map(i => <option key={i}>{i}</option>)}
                  </select>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 9, color: PANEL.textMuted, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 8 }}>Collaborators</div>
                  <select
                    multiple
                    size={Math.min(8, Math.max(3, COLLABORATOR_OPTIONS.length))}
                    value={filters.selectedCollaborators}
                    onChange={(e) => {
                      const opts = [...e.target.selectedOptions].map((o) => o.value);
                      setFilters((f) => ({ ...f, selectedCollaborators: opts }));
                    }}
                    style={{ width: "100%", minHeight: 72, background: PANEL.inputBg, border: `1px solid ${PANEL.border}`, color: PANEL.text, padding: "6px 8px", borderRadius: 6, fontSize: 10, outline: "none" }}
                  >
                    {COLLABORATOR_OPTIONS.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <div style={{ fontSize: 9, color: PANEL.textMuted, marginTop: 6 }}>Ctrl/Cmd+click to select several.</div>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, cursor: "pointer", userSelect: "none" }}>
                    <input
                      type="checkbox"
                      checked={filters.includeDeactivated}
                      onChange={(e) => setFilters((f) => ({ ...f, includeDeactivated: e.target.checked }))}
                    />
                    <span style={{ fontSize: 10, color: PANEL.textMuted }}>Include deactivated users and archived teams</span>
                  </label>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div style={{ fontSize: 9, color: PANEL.textMuted, textTransform: "uppercase", letterSpacing: "0.12em" }}>Labels</div>
                    {filters.selectedLabels.length > 0 && (
                      <button type="button" onClick={() => setFilters((f) => ({ ...f, selectedLabels: [] }))} style={{ fontSize: 9, color: COLORS.accent, background: "none", border: "none", cursor: "pointer", padding: 0 }}>Clear</button>
                    )}
                  </div>
                  <select
                    multiple
                    size={Math.min(8, Math.max(3, ALL_LABELS.length))}
                    value={filters.selectedLabels}
                    onChange={(e) => {
                      const opts = [...e.target.selectedOptions].map((o) => o.value);
                      setFilters((f) => ({ ...f, selectedLabels: opts }));
                    }}
                    style={{ width: "100%", minHeight: 64, background: PANEL.inputBg, border: `1px solid ${PANEL.border}`, color: PANEL.text, padding: "6px 8px", borderRadius: 6, fontSize: 10, outline: "none" }}
                  >
                    {ALL_LABELS.map((lb) => (
                      <option key={lb} value={lb}>{lb}</option>
                    ))}
                  </select>
                  <div style={{ fontSize: 9, color: PANEL.textMuted, marginTop: 6 }}>Ctrl/Cmd+click to select several.</div>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 9, color: PANEL.textMuted, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 8 }}>Changes since</div>
                  <input
                    type="date"
                    value={filters.changesSince}
                    onChange={(e) => setFilters((f) => ({ ...f, changesSince: e.target.value }))}
                    style={{ width: "100%", boxSizing: "border-box", background: PANEL.inputBg, border: `1px solid ${PANEL.border}`, color: PANEL.text, padding: "7px 10px", borderRadius: 6, fontSize: 11, outline: "none" }}
                  />
                  {filters.changesSince && (
                    <button type="button" onClick={() => setFilters((f) => ({ ...f, changesSince: "" }))} style={{ marginTop: 6, fontSize: 9, color: COLORS.accent, background: "none", border: "none", cursor: "pointer", padding: 0 }}>Clear date</button>
                  )}
                </div>

                <div style={{ marginBottom: 4 }}>
                  <div style={{ fontSize: 9, color: PANEL.textMuted, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 8 }}>Level</div>
                  {[{ key: "team", label: "Team" }, { key: "organization", label: "Organization" }].map(l => (
                    <label key={l.key} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginBottom: 6, userSelect: "none" }}>
                      <div onClick={() => setFilters(f => ({ ...f, level: { ...f.level, [l.key]: !f.level[l.key] } }))} style={{ width: 14, height: 14, borderRadius: 3, border: `2px solid ${COLORS.accent}`, background: filters.level[l.key] ? COLORS.accent : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, cursor: "pointer" }}>
                        {filters.level[l.key] && <div style={{ width: 6, height: 6, background: "#ffffff", borderRadius: 1 }} />}
                      </div>
                      <span style={{ fontSize: 11, color: PANEL.text }}>{l.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Layers (collapsed by default) */}
          <div style={{ borderTop: `1px solid ${PANEL.border}`, paddingTop: 12 }}>
            <button
              type="button"
              onClick={() => setLayersOpen((o) => !o)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "none",
                border: "none",
                color: PANEL.text,
                cursor: "pointer",
                padding: "4px 0 8px",
                fontSize: 10,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
              }}
            >
              <span>Layers</span>
              <span style={{ color: PANEL.textMuted, fontSize: 11 }}>{layersOpen ? "\u25BE" : "\u25B8"}</span>
            </button>
            {layersOpen && (
              <div>
                <p style={{ fontSize: 9, color: PANEL.textMuted, lineHeight: 1.45, margin: "0 0 10px" }}>
                  Strategic priorities are not drawn on the map; they appear under each outcome in the right panel.
                </p>
                {[
                  { key: "showMeasures", label: "Measures", color: COLORS.measure },
                  { key: "highlightMyTeam", label: "Highlight My Team", color: COLORS.teamHighlight },
                ].map(l => (
                  <label key={l.key} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginBottom: 6, userSelect: "none" }}>
                    <div onClick={() => setFilters(f => ({ ...f, [l.key]: !f[l.key] }))} style={{ width: 14, height: 14, borderRadius: 3, border: `2px solid ${l.color}`, background: filters[l.key] ? l.color : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, cursor: "pointer" }}>
                      {filters[l.key] && <div style={{ width: 6, height: 6, background: "#ffffff", borderRadius: 1 }} />}
                    </div>
                    <span style={{ fontSize: 11, color: PANEL.text }}>{l.label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Legend — collapsible, compact; scroll inside when open so filters stay primary */}
          <div style={{ borderTop: `1px solid ${PANEL.border}`, paddingTop: 12, marginTop: 4 }}>
            <button
              type="button"
              onClick={() => setLegendExpanded((o) => !o)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "none",
                border: "none",
                color: PANEL.textMuted,
                cursor: "pointer",
                padding: "4px 0 8px",
                fontSize: 9,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.12em",
              }}
            >
              <span>Map legend</span>
              <span style={{ fontSize: 11 }}>{legendExpanded ? "\u25BE" : "\u25B8"}</span>
            </button>
            {legendExpanded && (
              <div style={{ maxHeight: 200, overflow: "auto", paddingBottom: 4 }}>
                <GraphLegendPanel compact />
              </div>
            )}
          </div>
        </div>
      </div>
      )}

      {/* Main graph + detail — flex row so the panel does not cover the SVG */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "row",
          minWidth: 0,
          overflow: "hidden",
        }}
      >
      {/* Main Graph Area */}
      <div
        style={{
          flex: 1,
          position: "relative",
          minWidth: 0,
          overflow: "hidden",
          background: GRAPH.bg,
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6)",
        }}
      >
        {/* Top bar: two rows so long org names and stats never share one flex row (avoids overlap). */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            background: "rgba(255,255,255,0.88)",
            backdropFilter: "blur(10px)",
            borderBottom: `1px solid ${GRAPH.grid}`,
            display: "flex",
            flexDirection: "column",
            gap: 6,
            padding: "10px 20px",
            zIndex: 10,
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
              rowGap: 8,
              minWidth: 0,
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 700, color: GRAPH.text, letterSpacing: "-0.02em", flexShrink: 0 }}>
              Network of Teams
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "1 1 180px", minWidth: 140, maxWidth: "100%" }}>
              <input
                type="search"
                value={filters.keyword}
                onChange={(e) => setFilters((f) => ({ ...f, keyword: e.target.value }))}
                placeholder="Organization, team, or outcome…"
                aria-label="Search graph"
                style={{
                  flex: 1,
                  minWidth: 0,
                  width: "100%",
                  background: "#fff",
                  border: `1px solid ${GRAPH.grid}`,
                  color: GRAPH.text,
                  padding: "8px 12px",
                  borderRadius: 8,
                  fontSize: 12,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
              {filters.keyword ? (
                <button
                  type="button"
                  onClick={() => setFilters((f) => ({ ...f, keyword: "" }))}
                  style={{ fontSize: 11, color: COLORS.accent, background: "none", border: "none", cursor: "pointer", padding: "4px 0", whiteSpace: "nowrap", fontWeight: 500, flexShrink: 0 }}
                >
                  Clear
                </button>
              ) : null}
            </div>
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: expandedTeamId ? COLORS.onTrack : GRAPH.textMuted,
                background: expandedTeamId ? "rgba(63,185,80,0.12)" : "rgba(100,116,139,0.1)",
                padding: "4px 10px",
                borderRadius: 20,
                flexShrink: 0,
                border: `1px solid ${expandedTeamId ? "rgba(63,185,80,0.25)" : GRAPH.grid}`,
              }}
            >
              {expandedTeamId ? "Team focus on" : "Pick a team"}
            </span>
            <div style={{ fontSize: 11, color: GRAPH.textMuted, lineHeight: 1.35, flexShrink: 0 }}>
              <span style={{ color: GRAPH.text, fontWeight: 600 }}>{teamCount}</span> teams
              <span style={{ margin: "0 6px", color: GRAPH.grid }}>·</span>
              {expandedTeamId != null ? (
                <>
                  <span style={{ color: GRAPH.text, fontWeight: 600 }}>{focusedOutcomeCount}</span> outcomes on graph
                  <span style={{ margin: "0 6px", color: GRAPH.grid }}>·</span>
                </>
              ) : null}
              <span style={{ color: GRAPH.text, fontWeight: 600 }}>{outcomeCount}</span> outcomes in view
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", flexShrink: 0 }}>
              {expandedTeamId ? (
                <button
                  type="button"
                  onClick={() => {
                    setExpandedTeamId(null);
                    setExpandedMeasures({});
                  }}
                  style={{
                    fontSize: 11,
                    fontWeight: 500,
                    color: GRAPH.text,
                    background: "#fff",
                    border: `1px solid ${GRAPH.grid}`,
                    padding: "6px 12px",
                    borderRadius: 8,
                    cursor: "pointer",
                  }}
                >
                  Clear outcome focus
                </button>
              ) : null}
              {expandedOrgId ? (
                <button
                  type="button"
                  onClick={() => setExpandedOrgId(null)}
                  style={{
                    fontSize: 11,
                    fontWeight: 500,
                    color: GRAPH.text,
                    background: "#fff",
                    border: `1px solid ${COLORS.accent}55`,
                    padding: "6px 12px",
                    borderRadius: 8,
                    cursor: "pointer",
                  }}
                >
                  Organizations only
                </button>
              ) : null}
              <button
                type="button"
                onClick={resetGraphZoom}
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  color: GRAPH.text,
                  background: "#fff",
                  border: `1px solid ${GRAPH.grid}`,
                  padding: "6px 14px",
                  borderRadius: 8,
                  cursor: "pointer",
                }}
              >
                Reset zoom
              </button>
            </div>
          </div>
          <div
            style={{
              fontSize: 10,
              color: GRAPH.textMuted,
              lineHeight: 1.45,
              minWidth: 0,
              wordBreak: "break-word",
              overflowWrap: "anywhere",
              paddingBottom: 2,
            }}
          >
            {expandedOrgLabel ? (
              <>
                Sub-teams under <span style={{ color: GRAPH.text, fontWeight: 600 }}>{expandedOrgLabel}</span>
              </>
            ) : (
              <>Divisions on the inner ring</>
            )}
            {expandedTeamLabel ? (
              <>
                {" · "}
                Outcomes for <span style={{ color: GRAPH.text, fontWeight: 600 }}>{expandedTeamLabel}</span>
              </>
            ) : (
              <>
                {" · "}
                <span style={{ color: GRAPH.textMuted }}>Click a team to show outcomes</span>
              </>
            )}
            <span style={{ color: GRAPH.grid }}> · </span>
            {filters.timeFrame}
          </div>
        </div>

        <div
          ref={chartContainerRef}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 104,
            bottom: 0,
            minHeight: 160,
            touchAction: "none",
            overscrollBehavior: "contain",
          }}
        >
          <svg
            ref={svgRef}
            tabIndex={0}
            role="img"
            aria-label="Network map: wheel to zoom, drag to pan, drag nodes to reposition."
            style={{
              width: "100%",
              height: "100%",
              display: "block",
              background: GRAPH.bg,
              shapeRendering: "geometricPrecision",
              outline: "none",
            }}
          />
        </div>

        <div
          style={{
            position: "absolute",
            bottom: 16,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 10,
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "rgba(255,255,255,0.95)",
            border: `1px solid ${GRAPH.grid}`,
            borderRadius: 8,
            padding: "6px 10px",
            fontFamily: "Inter, system-ui, sans-serif",
            boxShadow: "0 4px 12px rgba(15,23,42,0.06)",
          }}
        >
          <button
            type="button"
            onClick={() => nudgeZoom(1 / 1.1)}
            style={{ border: `1px solid ${GRAPH.grid}`, background: "#fff", borderRadius: 4, width: 28, height: 28, cursor: "pointer", fontSize: 16, lineHeight: 1 }}
          >
            −
          </button>
          <span style={{ fontSize: 11, color: GRAPH.text, minWidth: 44, textAlign: "center" }}>{zoomPct}%</span>
          <button
            type="button"
            onClick={() => nudgeZoom(1.1)}
            style={{ border: `1px solid ${GRAPH.grid}`, background: "#fff", borderRadius: 4, width: 28, height: 28, cursor: "pointer", fontSize: 16, lineHeight: 1 }}
          >
            +
          </button>
          <button
            type="button"
            onClick={resetGraphZoom}
            style={{ border: "none", background: "none", color: COLORS.accent, fontSize: 11, cursor: "pointer", padding: "0 4px" }}
          >
            Reset
          </button>
        </div>

      </div>

      {/* Right Detail Panel */}
      {selectedNode && (
        <div style={{ width: 280, flexShrink: 0, minHeight: 0, alignSelf: "stretch", background: PANEL.bg, borderLeft: `1px solid ${PANEL.border}`, padding: 20, overflow: "auto", boxShadow: "-2px 0 12px rgba(15,23,42,0.04)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 9, color: PANEL.textMuted, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 4 }}>
                {selectedNode.type === "team" ? (selectedNode.parentId ? "Sub-team" : "Organization") : selectedNode.type}
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: PANEL.text, lineHeight: 1.4 }}>{selectedNode.label}</div>
              {selectedNode.type === "team" && selectedNode.parentId && (
                <div style={{ fontSize: 10, color: PANEL.textMuted, marginTop: 6 }}>
                  Sub-team of {rawNodes.find((n) => n.id === selectedNode.parentId)?.label ?? selectedNode.parentId}
                </div>
              )}
              {selectedNode.type === "team" && selectedNode.abbrev && !selectedNode.parentId && (
                <div style={{ fontSize: 10, color: PANEL.textMuted, marginTop: 4 }}>Team list icon · {selectedNode.abbrev}</div>
              )}
            </div>
            <button onClick={() => setSelectedNode(null)} style={{ background: "none", border: "none", color: PANEL.textMuted, fontSize: 16, cursor: "pointer", padding: 0, lineHeight: 1, marginLeft: 8 }}>×</button>
          </div>

          {selectedNode.type === "outcome" && (
            <div style={{ marginBottom: 16 }}>
              {(() => {
                const confColor = getConfidenceAccent(selectedNode) ?? COLORS.draft;
                return (
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 6, background: confColor + "20", border: `1px solid ${confColor}40`, marginBottom: 12 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: confColor }} />
                <span style={{ fontSize: 11, color: confColor, fontWeight: 600, textTransform: "capitalize" }}>{selectedNode.confidence?.replace("-", " ")}</span>
              </div>
                );
              })()}
              <p style={{ fontSize: 12, color: PANEL.text, lineHeight: 1.55, margin: "0 0 14px", fontWeight: 500 }}>
                {selectedNode.label}
              </p>
              <p style={{ fontSize: 11, color: PANEL.textMuted, lineHeight: 1.5, margin: "0 0 14px" }}>
                Planned for {filters.timeFrame.toLowerCase()}. The badge above reflects pace vs. the plan; the bar below is illustrative progress.
              </p>
              <div style={{ marginBottom: 14 }}>
                <div style={{ ...sectionHeading, color: PANEL.textMuted, marginBottom: 6 }}>Owner team</div>
                <div style={{ fontSize: 12, color: PANEL.text }}>{teamLabelById(selectedNode.owner)}</div>
              </div>
              <div style={{ marginBottom: 14 }}>
                <div style={{ ...sectionHeading, color: PANEL.textMuted, marginBottom: 6 }}>Cross-team alignment</div>
                <p style={{ fontSize: 10, color: PANEL.textMuted, lineHeight: 1.45, margin: "0 0 8px" }}>
                  Teams that committed beyond the owner (not drawn as lines on the map).
                </p>
                {(() => {
                  const alignedTeams = alignmentTeamsForOutcome(selectedNode.id);
                  if (alignedTeams.length === 0) {
                    return (
                      <p style={{ fontSize: 11, color: PANEL.textMuted, fontStyle: "italic", margin: 0, lineHeight: 1.45 }}>
                        No other teams have aligned to this outcome.
                      </p>
                    );
                  }
                  return (
                  <div>
                    {alignedTeams.map((t) => (
                      <div
                        key={t.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedNode(t)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSelectedNode(t);
                          }
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "6px 8px",
                          borderRadius: 4,
                          marginBottom: 4,
                          cursor: "pointer",
                          background: "transparent",
                          transition: "background 0.15s",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = PANEL.surface;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "transparent";
                        }}
                      >
                        <div
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: 0,
                            background: getNodeColor(t, { highlightMyTeam: false }),
                            flexShrink: 0,
                          }}
                        />
                        <span style={{ fontSize: 11, color: PANEL.text, flex: 1 }}>{t.label}</span>
                        <span style={{ fontSize: 9, color: PANEL.textMuted, background: PANEL.surface, padding: "1px 6px", borderRadius: 8 }}>aligned</span>
                      </div>
                    ))}
                  </div>
                  );
                })()}
              </div>
              <div style={{ marginBottom: 14 }}>
                <div style={{ ...sectionHeading, color: PANEL.textMuted, marginBottom: 6 }}>Progress</div>
                <div style={{ height: 8, borderRadius: 4, background: PANEL.border, overflow: "hidden" }}>
                  <div
                    style={{
                      width: `${outcomeProgressPct(selectedNode)}%`,
                      height: "100%",
                      background: getConfidenceAccent(selectedNode) ?? COLORS.challenge,
                      borderRadius: 4,
                    }}
                  />
                </div>
                <div style={{ fontSize: 10, color: PANEL.textMuted, marginTop: 6 }}>{outcomeProgressPct(selectedNode)}% complete (illustrative)</div>
              </div>
              {measuresForOutcome(selectedNode.id).length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ ...sectionHeading, color: PANEL.textMuted, marginBottom: 8 }}>Measures</div>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {measuresForOutcome(selectedNode.id).map((m) => (
                      <li key={m.id} style={{ fontSize: 11, color: PANEL.text, marginBottom: 8, lineHeight: 1.4 }}>
                        {m.label}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {(() => {
                const stratNodes = rawLinks
                  .filter((l) => l.type === "strategic" && l.target === selectedNode.id)
                  .map((l) => rawNodes.find((n) => n.id === l.source))
                  .filter(Boolean);
                if (!stratNodes.length) return null;
                return (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ ...sectionHeading, color: PANEL.textMuted, marginBottom: 6 }}>Strategic priorities</div>
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                      {stratNodes.map((n) => (
                        <li key={n.id} style={{ fontSize: 11, color: PANEL.text, marginBottom: 6, lineHeight: 1.4 }}>
                          {n.label}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })()}
            </div>
          )}

          {selectedNode.type === "measure" && (
            <p style={{ fontSize: 11, color: PANEL.textMuted, lineHeight: 1.55, margin: "0 0 16px" }}>
              Measure linked from its parent outcome. Expand an outcome with <strong style={{ color: PANEL.text }}>+</strong> on the graph to see measure nodes.
            </p>
          )}

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 9, color: PANEL.textMuted, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 8 }}>Connections</div>
            {rawLinks
              .filter((l) => {
                if (l.source !== selectedNode.id && l.target !== selectedNode.id) return false;
                if (selectedNode.type === "outcome" && (l.type === "strategic" || l.type === "aligned")) return false;
                return true;
              })
              .map((l, i) => {
              const otherId = l.source === selectedNode.id ? l.target : l.source;
              const other = rawNodes.find(n => n.id === otherId);
              if (!other) return null;
              return (
                <div key={i} onClick={() => setSelectedNode(other)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 4, marginBottom: 4, cursor: "pointer", background: "transparent", transition: "background 0.15s" }}
                  onMouseEnter={e => e.currentTarget.style.background = PANEL.surface}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <div style={{ width: 6, height: 6, borderRadius: other.type === "team" ? 0 : "50%", background: getNodeColor(other, { highlightMyTeam: false }), flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: PANEL.text, flex: 1 }}>{other.label}</span>
                  <span style={{ fontSize: 9, color: PANEL.textMuted, background: PANEL.surface, padding: "1px 6px", borderRadius: 8 }}>{l.type}</span>
                </div>
              );
            })}
          </div>

          {selectedNode.type === "team" && (() => {
            const scope = collectDescendantTeamIds(selectedNode.id);
            const ownsCount = rawLinks.filter((l) => l.type === "owns" && scope.has(l.source)).length;
            const alignedCount = rawLinks.filter((l) => l.type === "aligned" && scope.has(l.source)).length;
            return (
              <div style={{ padding: "10px 12px", background: COLORS.accent + "10", borderRadius: 6, border: `1px solid ${COLORS.accent}30` }}>
                <div style={{ fontSize: 9, color: COLORS.accent, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.1em" }}>Summary</div>
                <div style={{ fontSize: 11, color: PANEL.text }}>
                  {ownsCount} outcomes owned, {alignedCount} cross-team alignments
                  {scope.size > 1 && <span style={{ color: PANEL.textMuted }}> (includes sub-teams)</span>}
                </div>
                {!selectedNode.parentId && (
                  <div style={{ fontSize: 10, color: PANEL.textMuted, marginTop: 8, lineHeight: 1.45 }}>
                    Confidence totals in the left sidebar count every outcome in this explorer, including drafts owned at org level. Click a team on the map to turn on <strong style={{ color: PANEL.text }}>Team focus</strong> (see the chip in the bar) and show only outcomes <strong style={{ color: PANEL.text }}>owned</strong> by that team (including its sub-teams). Open an outcome for cross-team alignment.
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  </div>
  );
}
