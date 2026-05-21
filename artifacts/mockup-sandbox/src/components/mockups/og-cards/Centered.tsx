export function Centered() {
  return (
    <div className="min-h-screen bg-[#0d0d10] flex items-center justify-center">
      <div style={{ width: 1200, height: 630, position: "relative", overflow: "hidden", background: "#0d0d10" }}>
        {/* Full-bleed photo */}
        <img
          src="/__mockup/images/al0-logo.png"
          alt="Agent Layer 0"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center" }}
        />
        {/* Subtle dark vignette so the photo reads cleanly */}
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at center, transparent 30%, rgba(13,13,16,0.45) 100%)" }} />
      </div>
    </div>
  );
}
