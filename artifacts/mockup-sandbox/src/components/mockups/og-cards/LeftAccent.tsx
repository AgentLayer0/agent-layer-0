export function LeftAccent() {
  return (
    <div className="min-h-screen bg-[#0d0d10] flex items-center justify-center">
      <div
        style={{ width: 1200, height: 630, position: "relative", overflow: "hidden", background: "#0d0d10", display: "flex" }}
      >
        {/* Left orange bar */}
        <div style={{ width: 6, background: "#E8541C", flexShrink: 0 }} />

        {/* Main content */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "52px 64px 52px 72px" }}>
          {/* Top: label */}
          <div>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 11, color: "#E8541C", letterSpacing: "0.2em", textTransform: "uppercase" }}>
              Agent Layer 0
            </span>
          </div>

          {/* Middle: logo + tagline */}
          <div style={{ display: "flex", flexDirection: "column", gap: 36 }}>
            <img
              src="/__mockup/images/al0-logo.png"
              alt="Agent Layer 0"
              style={{ width: 400, height: "auto", objectFit: "contain" }}
            />
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <p style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 28, color: "#ffffff", margin: 0, lineHeight: 1.2 }}>
                The governance layer for AI agents.
              </p>
              <p style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 400, fontSize: 16, color: "rgba(255,255,255,0.4)", margin: 0, lineHeight: 1.5 }}>
                Voting. Delegation. Treasury approvals. Powered by UrVote.
              </p>
            </div>
          </div>

          {/* Bottom: domain */}
          <div>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: "rgba(255,255,255,0.22)", letterSpacing: "0.06em" }}>
              agentlayer0.com
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
