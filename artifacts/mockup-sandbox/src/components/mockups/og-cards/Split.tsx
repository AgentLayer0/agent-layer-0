export function Split() {
  return (
    <div className="min-h-screen bg-[#0d0d10] flex items-center justify-center">
      <div
        style={{ width: 1200, height: 630, position: "relative", overflow: "hidden", background: "#0d0d10", display: "flex" }}
      >
        {/* Left half — copy */}
        <div style={{ width: 560, display: "flex", flexDirection: "column", justifyContent: "center", padding: "64px 56px 64px 64px", gap: 24, flexShrink: 0 }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 11, color: "#E8541C", letterSpacing: "0.2em", textTransform: "uppercase" }}>
            Now in early access
          </span>
          <h1 style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 800, fontSize: 36, color: "#ffffff", margin: 0, lineHeight: 1.15 }}>
            The governance layer for AI agents.
          </h1>
          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 400, fontSize: 15, color: "rgba(255,255,255,0.45)", margin: 0, lineHeight: 1.6 }}>
            Voting, delegation limits, treasury approvals, and auditable upgrades — in minutes.
          </p>
          <div style={{ marginTop: 8 }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: "rgba(255,255,255,0.22)", letterSpacing: "0.06em" }}>
              agentlayer0.com
            </span>
          </div>
        </div>

        {/* Divider */}
        <div style={{ width: 1, background: "rgba(232,84,28,0.2)", flexShrink: 0 }} />

        {/* Right half — logo */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(232,84,28,0.03)" }}>
          <img
            src="/__mockup/images/al0-logo.png"
            alt="Agent Layer 0"
            style={{ width: "80%", height: "auto", objectFit: "contain" }}
          />
        </div>
      </div>
    </div>
  );
}
