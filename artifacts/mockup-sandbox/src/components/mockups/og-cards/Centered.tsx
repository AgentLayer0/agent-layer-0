export function Centered() {
  return (
    <div className="min-h-screen bg-[#0d0d10] flex items-center justify-center">
      <div
        style={{ width: 1200, height: 630, position: "relative", overflow: "hidden", background: "#0d0d10" }}
      >
        {/* Grid overlay */}
        <svg
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.07 }}
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#E8541C" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>

        {/* Orange top border */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "#E8541C" }} />

        {/* Centered content */}
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 32 }}>
          <img
            src="/__mockup/images/al0-logo.png"
            alt="Agent Layer 0"
            style={{ width: 520, height: "auto", objectFit: "contain" }}
          />
          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 400, fontSize: 22, color: "rgba(255,255,255,0.55)", letterSpacing: "0.02em", margin: 0 }}>
            The governance layer for AI agents.
          </p>
        </div>

        {/* Bottom right domain */}
        <div style={{ position: "absolute", bottom: 28, right: 36 }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, color: "rgba(255,255,255,0.25)", letterSpacing: "0.06em" }}>
            agentlayer0.com
          </span>
        </div>
      </div>
    </div>
  );
}
