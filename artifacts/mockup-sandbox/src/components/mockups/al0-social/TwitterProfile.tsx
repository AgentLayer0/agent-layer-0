export function TwitterProfile() {
  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background: "#0d0d10",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        position: "relative",
        fontFamily: '"JetBrains Mono", monospace',
      }}
    >
      {/* Subtle radial glow */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 50% 50%, rgba(232,84,28,0.10) 0%, transparent 65%)",
          pointerEvents: "none",
        }}
      />

      {/* Grid pattern — very subtle */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(to right, rgba(232,84,28,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(232,84,28,0.05) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          maskImage: "radial-gradient(circle at 50% 50%, #000 20%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(circle at 50% 50%, #000 20%, transparent 75%)",
        }}
      />

      {/* Mark */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "14px",
          fontSize: "108px",
          fontWeight: 800,
          letterSpacing: "-0.04em",
          lineHeight: 1,
          position: "relative",
          zIndex: 1,
        }}
      >
        <span style={{ color: "#E8541C", opacity: 0.9 }}>[</span>
        <span style={{ color: "#ffffff" }}>0</span>
        <span style={{ color: "#E8541C", opacity: 0.9 }}>]</span>
      </div>
    </div>
  );
}
