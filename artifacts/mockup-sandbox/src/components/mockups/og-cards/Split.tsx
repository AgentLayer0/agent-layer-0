export function Split() {
  const nodes = [
    { id: "agent_01", x: 155, y: 80,  primary: true },
    { id: "agent_04", x: 480, y: 55,  primary: false },
    { id: "agent_07", x: 590, y: 220, primary: false },
    { id: "agent_02", x: 320, y: 190, primary: true },
    { id: "agent_11", x: 100, y: 280, primary: false },
    { id: "agent_06", x: 430, y: 360, primary: false },
    { id: "agent_09", x: 200, y: 430, primary: false },
    { id: "agent_03", x: 530, y: 480, primary: true },
    { id: "agent_13", x: 80,  y: 500, primary: false },
    { id: "agent_05", x: 310, y: 530, primary: false },
  ];

  const edges = [
    [0, 3], [0, 4], [1, 2], [1, 3], [2, 3], [2, 6],
    [3, 4], [3, 5], [3, 6], [5, 7], [5, 9], [6, 8],
    [7, 9], [8, 9], [4, 5],
  ];

  return (
    <div className="min-h-screen bg-[#0d0d10] flex items-center justify-center">
      <div style={{ width: 1200, height: 630, position: "relative", overflow: "hidden", background: "#0d0d10", display: "flex" }}>

        {/* Left half — copy */}
        <div style={{ width: 560, display: "flex", flexDirection: "column", justifyContent: "center", padding: "64px 56px 64px 64px", gap: 24, flexShrink: 0 }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 11, color: "#E8541C", letterSpacing: "0.2em", textTransform: "uppercase" }}>
            Agent Layer 0
          </span>
          <h1 style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 800, fontSize: 36, color: "#ffffff", margin: 0, lineHeight: 1.15 }}>
            The governance layer for AI agents.
          </h1>
          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 400, fontSize: 15, color: "rgba(255,255,255,0.45)", margin: 0, lineHeight: 1.6 }}>
            Voting, delegation limits, treasury approvals, and auditable upgrades in minutes.
          </p>
          <div style={{ marginTop: 8 }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: "rgba(255,255,255,0.22)", letterSpacing: "0.06em" }}>
              agentlayer0.com
            </span>
          </div>
        </div>

        {/* Divider */}
        <div style={{ width: 1, background: "rgba(232,84,28,0.2)", flexShrink: 0 }} />

        {/* Right half — agent network */}
        <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
          <svg
            viewBox="0 0 640 630"
            width="640"
            height="630"
            style={{ position: "absolute", inset: 0 }}
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              {/* Pulse animation keyframes via style */}
              <style>{`
                @keyframes pulse { 0%,100%{opacity:.18} 50%{opacity:.55} }
                @keyframes travel {
                  0%   { opacity: 0; offset-distance: 0% }
                  10%  { opacity: 1 }
                  90%  { opacity: 1 }
                  100% { opacity: 0; offset-distance: 100% }
                }
                .edge { animation: pulse 3s ease-in-out infinite; }
                .edge:nth-child(2n)  { animation-delay: -1.1s; }
                .edge:nth-child(3n)  { animation-delay: -2.2s; }
                .edge:nth-child(5n)  { animation-delay: -0.7s; }
                .node-ring { animation: pulse 2.5s ease-in-out infinite; }
              `}</style>
            </defs>

            {/* Edges */}
            {edges.map(([a, b], i) => {
              const na = nodes[a], nb = nodes[b];
              const isPrimary = na.primary || nb.primary;
              return (
                <line
                  key={i}
                  className="edge"
                  x1={na.x + 32} y1={na.y + 16}
                  x2={nb.x + 32} y2={nb.y + 16}
                  stroke={isPrimary ? "#E8541C" : "rgba(255,255,255,0.25)"}
                  strokeWidth={isPrimary ? 1.5 : 1}
                  strokeDasharray={isPrimary ? "none" : "4 6"}
                />
              );
            })}

            {/* Traveling message dots on a few key edges */}
            {[[0,3],[2,5],[3,7],[1,2],[6,8]].map(([a, b], i) => {
              const na = nodes[a], nb = nodes[b];
              const x1 = na.x + 32, y1 = na.y + 16;
              const x2 = nb.x + 32, y2 = nb.y + 16;
              const pathId = `p${i}`;
              const dur = [2.4, 3.1, 2.8, 3.6, 2.1][i];
              const delay = [0, -1.2, -0.6, -2.1, -1.8][i];
              return (
                <g key={`msg-${i}`}>
                  <path id={pathId} d={`M ${x1} ${y1} L ${x2} ${y2}`} fill="none" stroke="none" />
                  <circle r="3.5" fill="#E8541C" opacity="0.9">
                    <animateMotion dur={`${dur}s`} begin={`${delay}s`} repeatCount="indefinite" calcMode="linear">
                      <mpath href={`#${pathId}`} />
                    </animateMotion>
                    <animate attributeName="opacity" values="0;1;1;0" dur={`${dur}s`} begin={`${delay}s`} repeatCount="indefinite" />
                  </circle>
                </g>
              );
            })}

            {/* Nodes */}
            {nodes.map((n, i) => (
              <g key={n.id} transform={`translate(${n.x}, ${n.y})`}>
                {n.primary && (
                  <rect
                    className="node-ring"
                    x="-4" y="-4" width="72" height="40" rx="4"
                    fill="none"
                    stroke="#E8541C"
                    strokeWidth="1"
                  />
                )}
                <rect
                  x="0" y="0" width="64" height="32" rx="3"
                  fill={n.primary ? "rgba(232,84,28,0.15)" : "rgba(255,255,255,0.05)"}
                  stroke={n.primary ? "rgba(232,84,28,0.6)" : "rgba(255,255,255,0.15)"}
                  strokeWidth="1"
                />
                <text
                  x="32" y="20"
                  textAnchor="middle"
                  fontFamily="'JetBrains Mono', monospace"
                  fontWeight={n.primary ? "700" : "400"}
                  fontSize="9"
                  fill={n.primary ? "#E8541C" : "rgba(255,255,255,0.55)"}
                >
                  {n.id}
                </text>
              </g>
            ))}
          </svg>
        </div>
      </div>
    </div>
  );
}
