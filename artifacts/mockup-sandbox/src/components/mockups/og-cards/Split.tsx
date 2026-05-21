export function Split() {
  return (
    <div className="min-h-screen bg-[#0d0d10] flex items-center justify-center">
      <div style={{ width: 1200, height: 630, position: "relative", overflow: "hidden", background: "#0d0d10" }}>
        {/* Photo fills 80% of the height, centered */}
        <img
          src="/__mockup/images/al0-logo.png"
          alt="Agent Layer 0"
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "90%",
            height: "auto",
            objectFit: "contain",
          }}
        />
        {/* Dark frame overlay — thin edges */}
        <div style={{ position: "absolute", inset: 0, boxShadow: "inset 0 0 80px 40px #0d0d10", pointerEvents: "none" }} />
        {/* Orange top bar */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: "#E8541C" }} />
        {/* [ AL0 ] bottom left */}
        <div style={{ position: "absolute", bottom: 28, left: 36 }}>
          <span style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontWeight: 800,
            fontSize: 20,
            color: "rgba(232,84,28,0.8)",
            letterSpacing: "0.06em",
          }}>
            [ AL0 ]
          </span>
        </div>
      </div>
    </div>
  );
}
