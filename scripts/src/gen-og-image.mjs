import { execSync } from "child_process";
import { writeFileSync, unlinkSync } from "fs";
import { resolve } from "path";

const W = 1200, H = 630;

// Agent network — positions within a 640x630 right panel
const nodes = [
  { id: "agent_01", x: 120, y:  70, primary: true  },
  { id: "agent_04", x: 400, y:  50, primary: false },
  { id: "agent_07", x: 520, y: 195, primary: false },
  { id: "agent_02", x: 270, y: 175, primary: true  },
  { id: "agent_11", x:  55, y: 255, primary: false },
  { id: "agent_06", x: 375, y: 330, primary: false },
  { id: "agent_09", x: 160, y: 400, primary: false },
  { id: "agent_03", x: 470, y: 455, primary: true  },
  { id: "agent_13", x:  50, y: 475, primary: false },
  { id: "agent_05", x: 270, y: 510, primary: false },
];

const edges = [
  [0,3],[0,4],[1,2],[1,3],[2,3],[2,6],
  [3,4],[3,5],[3,6],[5,7],[5,9],[6,8],
  [7,9],[8,9],[4,5],
];

// Offset all node x positions into the right panel (start at x=570 in the full 1200w canvas)
const RX = 10; // padding within right panel

function nx(n) { return 560 + RX + n.x + 32; }
function ny(n) { return n.y + 16; }

const edgeSvg = edges.map(([a, b]) => {
  const na = nodes[a], nb = nodes[b];
  const primary = na.primary || nb.primary;
  const dash = primary ? "" : `stroke-dasharray="5 7"`;
  const color = primary ? "#E8541C" : "rgba(255,255,255,0.22)";
  const width = primary ? "1.5" : "1";
  return `<line x1="${nx(na)}" y1="${ny(na)}" x2="${nx(nb)}" y2="${ny(nb)}" stroke="${color}" stroke-width="${width}" ${dash}/>`;
}).join("\n    ");

// Frozen message dots — pick a mid-point on 5 selected edges
const msgDots = [[0,3,0.38],[2,5,0.62],[3,7,0.45],[1,2,0.7],[6,8,0.3]].map(([a,b,t]) => {
  const na = nodes[a], nb = nodes[b];
  const mx = nx(na) + (nx(nb) - nx(na)) * t;
  const my = ny(na) + (ny(nb) - ny(na)) * t;
  return `<circle cx="${mx.toFixed(1)}" cy="${my.toFixed(1)}" r="3.5" fill="#E8541C" opacity="0.9"/>`;
}).join("\n    ");

const nodeSvg = nodes.map(n => {
  const px = 560 + RX + n.x;
  const py = n.y;
  const bg   = n.primary ? "rgba(232,84,28,0.15)" : "rgba(255,255,255,0.05)";
  const stroke = n.primary ? "rgba(232,84,28,0.7)" : "rgba(255,255,255,0.18)";
  const textFill = n.primary ? "#E8541C" : "rgba(255,255,255,0.55)";
  const fw = n.primary ? "bold" : "normal";
  const ring = n.primary
    ? `<rect x="${px-4}" y="${py-4}" width="72" height="40" rx="4" fill="none" stroke="#E8541C" stroke-width="1" opacity="0.35"/>`
    : "";
  return `
    ${ring}
    <rect x="${px}" y="${py}" width="64" height="32" rx="3" fill="${bg}" stroke="${stroke}" stroke-width="1"/>
    <text x="${px+32}" y="${py+20.5}" text-anchor="middle" font-family="'DejaVu Sans Mono', monospace" font-size="9" font-weight="${fw}" fill="${textFill}">${n.id}</text>`;
}).join("\n");

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">

  <!-- Background -->
  <rect width="${W}" height="${H}" fill="#0d0d10"/>

  <!-- Right panel subtle tint -->
  <rect x="561" y="0" width="639" height="${H}" fill="rgba(232,84,28,0.015)"/>

  <!-- ── LEFT HALF ── -->
  <!-- Label -->
  <text x="64" y="100" font-family="'DejaVu Sans Mono', monospace" font-size="11" font-weight="bold"
        fill="#E8541C" letter-spacing="3">AGENT LAYER 0</text>

  <!-- Headline -->
  <text font-family="'DejaVu Sans Mono', monospace" font-size="40" font-weight="bold" fill="#ffffff">
    <tspan x="64" dy="155">The governance</tspan>
    <tspan x="64" dy="52">layer for AI agents.</tspan>
  </text>

  <!-- Body -->
  <text font-family="'DejaVu Sans Mono', monospace" font-size="15" fill="rgba(255,255,255,0.45)">
    <tspan x="64" dy="340">Voting, delegation limits,</tspan>
    <tspan x="64" dy="22">treasury approvals, and auditable</tspan>
    <tspan x="64" dy="22">upgrades in minutes.</tspan>
  </text>

  <!-- Domain -->
  <text x="64" y="${H - 36}" font-family="'DejaVu Sans Mono', monospace" font-size="13"
        fill="rgba(255,255,255,0.22)" letter-spacing="2">agentlayer0.com</text>

  <!-- ── DIVIDER ── -->
  <line x1="560" y1="0" x2="560" y2="${H}" stroke="rgba(232,84,28,0.3)" stroke-width="1"/>

  <!-- ── RIGHT HALF — agent network ── -->
  ${edgeSvg}
  ${msgDots}
  ${nodeSvg}

</svg>`;

const svgPath = resolve("artifacts/agent-layer-0/public/og-source.svg");
const pngPath = resolve("artifacts/agent-layer-0/public/og-image.png");

writeFileSync(svgPath, svg, "utf8");
execSync(`magick -background "#0d0d10" -density 144 "${svgPath}" -resize ${W}x${H}! "${pngPath}"`);
unlinkSync(svgPath);

console.log(`Written: ${pngPath}`);
