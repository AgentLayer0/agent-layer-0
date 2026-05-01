export function TwitterCover() {
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
      {/* Grid pattern */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(to right, rgba(232,84,28,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(232,84,28,0.06) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          maskImage:
            "radial-gradient(ellipse 80% 90% at 50% 50%, #000 40%, transparent 100%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 80% 90% at 50% 50%, #000 40%, transparent 100%)",
        }}
      />

      {/* Orange glow */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 60% 80% at 50% 50%, rgba(232,84,28,0.07) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      {/* Horizontal rule top */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "2px",
          background:
            "linear-gradient(to right, transparent, #E8541C, transparent)",
          opacity: 0.6,
        }}
      />

      {/* Horizontal rule bottom */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: "2px",
          background:
            "linear-gradient(to right, transparent, rgba(232,84,28,0.4), transparent)",
        }}
      />

      {/* Center content */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "20px",
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* Main mark */}
        <div
          style={{
            fontSize: "96px",
            fontWeight: 800,
            letterSpacing: "-0.04em",
            display: "flex",
            alignItems: "center",
            gap: "20px",
            lineHeight: 1,
          }}
        >
          <span style={{ color: "#E8541C", opacity: 0.9 }}>[</span>
          <span style={{ color: "#ffffff" }}>AL0</span>
          <span style={{ color: "#E8541C", opacity: 0.9 }}>]</span>
        </div>

        {/* Divider */}
        <div
          style={{
            width: "240px",
            height: "1px",
            background:
              "linear-gradient(to right, transparent, rgba(232,84,28,0.5), transparent)",
          }}
        />

        {/* Tagline */}
        <div
          style={{
            fontSize: "13px",
            fontWeight: 600,
            letterSpacing: "0.45em",
            color: "#E8541C",
            opacity: 0.75,
            paddingLeft: "0.45em",
          }}
        >
          AGENT LAYER ZERO
        </div>
      </div>

      {/* Bottom-right: powered by */}
      <div
        style={{
          position: "absolute",
          bottom: "22px",
          right: "32px",
          fontSize: "10px",
          letterSpacing: "0.25em",
          color: "rgba(232,84,28,0.45)",
          fontWeight: 500,
        }}
      >
        POWERED BY URVOTE
      </div>

      {/* Top-left: version tag */}
      <div
        style={{
          position: "absolute",
          top: "22px",
          left: "32px",
          fontSize: "10px",
          letterSpacing: "0.2em",
          color: "rgba(255,255,255,0.2)",
          fontWeight: 500,
        }}
      >
        V 1.0.0
      </div>
    </div>
  );
}
