export function LeftAccent() {
  return (
    <div className="min-h-screen bg-[#0d0d10] flex items-center justify-center">
      <div style={{ width: 1200, height: 630, position: "relative", overflow: "hidden", background: "#0d0d10", display: "flex" }}>
        {/* Photo fills left ~70% */}
        <div style={{ flex: "0 0 840px", position: "relative", overflow: "hidden" }}>
          <img
            src="/__mockup/images/al0-logo.png"
            alt="Agent Layer 0"
            style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center" }}
          />
          {/* Fade right edge into dark */}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to right, transparent 60%, #0d0d10 100%)" }} />
        </div>

        {/* Right strip — just [ AL0 ] */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", paddingRight: 32 }}>
          <span style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontWeight: 800,
            fontSize: 32,
            color: "#E8541C",
            letterSpacing: "0.04em",
            whiteSpace: "nowrap",
          }}>
            [ AL0 ]
          </span>
        </div>
      </div>
    </div>
  );
}
