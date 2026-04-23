import { COLORS } from "./constants.js";
import { GRAPH, PANEL } from "./constants.js";
import { hexPoints } from "./appearance.js";

export function LegendNodeGlyph({ nodeKey }) {
  switch (nodeKey) {
    case "hub":
      return (
        <svg width={22} height={22} viewBox="-11 -11 22 22" aria-hidden>
          <circle r={9} fill={GRAPH.hubFill} stroke={GRAPH.hubStroke} strokeWidth={1.8} />
        </svg>
      );
    case "hex":
      return (
        <svg width={22} height={22} viewBox="-12 -12 24 24" aria-hidden>
          <polygon points={hexPoints(10)} fill={`${COLORS.organization}40`} stroke={COLORS.organization} strokeWidth={1.6} />
        </svg>
      );
    case "leaf":
      return (
        <svg width={22} height={22} viewBox="-11 -11 22 22" aria-hidden>
          <circle r={8} fill={`${COLORS.team}38`} stroke={COLORS.team} strokeWidth={1.6} />
        </svg>
      );
    case "outcome":
      return (
        <svg width={22} height={22} viewBox="-11 -11 22 22" aria-hidden>
          <circle r={9} fill={COLORS.challenge} stroke="rgba(255,255,255,0.45)" strokeWidth={1.2} />
        </svg>
      );
    case "measure":
      return (
        <svg width={22} height={22} viewBox="-11 -11 22 22" aria-hidden>
          <circle r={7} fill="#fff" stroke={GRAPH.measureStroke} strokeWidth={1.8} />
        </svg>
      );
    default:
      return null;
  }
}

/** Compact sidebar legend: grouped nodes and lines (fewer rows, same information). */
export function GraphLegendPanel({ compact = false }) {
  const row = {
    display: "flex",
    alignItems: "flex-start",
    gap: compact ? 8 : 10,
    marginBottom: compact ? 6 : 10,
  };
  const section = {
    fontSize: compact ? 8 : 9,
    color: PANEL.textMuted,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    fontWeight: 600,
    marginBottom: compact ? 6 : 8,
    marginTop: 0,
  };
  const fs = compact ? 9 : 10.5;
  const sub = { fontSize: compact ? 8 : 9, color: PANEL.textMuted, lineHeight: 1.4, marginTop: 2 };
  const pad = compact ? "8px 10px 10px" : "12px 12px 12px";
  const glyph = {
    width: compact ? 52 : 56,
    flexShrink: 0,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    transform: compact ? "scale(0.92)" : undefined,
    transformOrigin: "left center",
  };

  return (
    <div
      role="img"
      aria-label="Map legend: organization hub, teams as hex or circle, outcomes by confidence color, measures, and dashed connection lines on the map."
      style={{
        borderRadius: compact ? 8 : 10,
        border: compact ? `1px solid rgba(226, 232, 240, 0.72)` : `1px solid ${PANEL.border}`,
        background: compact ? PANEL.surface : PANEL.bg,
        padding: pad,
        boxSizing: "border-box",
      }}
    >
      <div style={section}>On the map</div>

      <div style={row}>
        <div style={glyph}>
          <LegendNodeGlyph nodeKey="hub" />
        </div>
        <div>
          <div style={{ fontSize: fs, color: PANEL.text, lineHeight: 1.35, fontWeight: 600 }}>Organization hub</div>
          <div style={sub}>Company at the center</div>
        </div>
      </div>

      <div style={row}>
        <div style={{ ...glyph, gap: 6, justifyContent: "flex-start", paddingLeft: 2 }}>
          <LegendNodeGlyph nodeKey="hex" />
          <LegendNodeGlyph nodeKey="leaf" />
        </div>
        <div>
          <div style={{ fontSize: fs, color: PANEL.text, lineHeight: 1.35, fontWeight: 600 }}>Teams</div>
          <div style={sub}>Hex = division · Circle = sub-team</div>
        </div>
      </div>

      <div style={row}>
        <div style={glyph}>
          <LegendNodeGlyph nodeKey="outcome" />
        </div>
        <div>
          <div style={{ fontSize: fs, color: PANEL.text, lineHeight: 1.35, fontWeight: 600 }}>Outcomes</div>
          <div style={sub}>Fill = confidence · % is illustrative delivery (not the 7–10 band)</div>
        </div>
      </div>

      <div style={{ ...row, marginBottom: 0 }}>
        <div style={glyph}>
          <LegendNodeGlyph nodeKey="measure" />
        </div>
        <div>
          <div style={{ fontSize: fs, color: PANEL.text, lineHeight: 1.35, fontWeight: 600 }}>Measures</div>
          <div style={sub}>Expand an outcome with + to show linked metrics</div>
        </div>
      </div>

      <div style={{ ...section, marginTop: compact ? 8 : 14, marginBottom: compact ? 5 : 8 }}>Lines</div>

      <div style={{ ...row, marginBottom: 0 }}>
        <div style={{ width: compact ? 36 : 40, flexShrink: 0 }}>
          <svg width="40" height="8" viewBox="0 0 40 8" aria-hidden>
            <line
              x1="2"
              y1="4"
              x2="38"
              y2="4"
              stroke={GRAPH.link}
              strokeWidth="1.35"
              strokeDasharray={GRAPH.linkDash}
              strokeLinecap="round"
            />
          </svg>
        </div>
        <div style={{ fontSize: fs, color: PANEL.textMuted, lineHeight: 1.45, fontWeight: 500 }}>
          Dashed lines connect the hub, teams, outcomes, and measures.
        </div>
      </div>
    </div>
  );
}
