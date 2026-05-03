function DottedZero({ color = "#ffffff" }: { color?: string }) {
  // "0" in transparent keeps the exact advance width and line metrics of the font.
  // The SVG fills that character cell and draws a clean ring + dot in the cap-height zone.
  // Cap height in JetBrains Mono ≈ 73% of em; baseline ≈ 76.5% from the top of the 1em box.
  // So the glyph body spans viewBox rows ~3 → ~77 (in a 0-100 viewBox).
  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      <span style={{ color: "transparent" }} aria-hidden="true">0</span>
      <svg
        aria-label="0"
        role="img"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          overflow: "visible",
        }}
      >
        {/* Ring centred in the cap-height zone (y: 3–77 of 100) */}
        <rect
          x="10"
          y="4"
          width="80"
          height="72"
          rx="36"
          ry="36"
          fill="none"
          stroke={color}
          strokeWidth="20"
        />
        {/* Centered dot */}
        <circle cx="50" cy="40" r="6" fill={color} />
      </svg>
    </span>
  );
}

interface AL0WordmarkProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  showFull?: boolean;
}

export function AL0Wordmark({ size = "md", className, showFull = false }: AL0WordmarkProps) {
  const config = {
    sm: { fontSize: "14px", gap: "5px", tagSize: "8px", tagSpacing: "0.3em" },
    md: { fontSize: "20px", gap: "8px", tagSize: "9px", tagSpacing: "0.35em" },
    lg: { fontSize: "30px", gap: "12px", tagSize: "10px", tagSpacing: "0.4em" },
  }[size];

  return (
    <div className={className} style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "4px" }}>
      <div
        style={{
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: config.fontSize,
          fontWeight: 800,
          letterSpacing: "-0.04em",
          display: "flex",
          alignItems: "center",
          gap: config.gap,
          lineHeight: 1,
        }}
      >
        <span style={{ color: "#E8541C", opacity: 0.9 }}>[</span>
        <span style={{ color: "#ffffff" }}>AL<DottedZero /></span>
        <span style={{ color: "#E8541C", opacity: 0.9 }}>]</span>
      </div>
      {showFull && (
        <div
          style={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: config.tagSize,
            fontWeight: 600,
            letterSpacing: config.tagSpacing,
            color: "#E8541C",
            opacity: 0.75,
            paddingLeft: "0.15em",
          }}
        >
          AGENT LAYER ZERO
        </div>
      )}
    </div>
  );
}

interface AL0CTAMarkProps {
  size?: number;
  className?: string;
}

export function AL0CTAMark({ size = 64, className }: AL0CTAMarkProps) {
  const gap = Math.round(size * 0.22);
  const tagSize = Math.max(10, Math.round(size * 0.15));

  return (
    <div className={className} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
      <div
        style={{
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: `${size}px`,
          fontWeight: 800,
          letterSpacing: "-0.04em",
          display: "flex",
          alignItems: "center",
          gap: `${gap}px`,
          lineHeight: 1,
        }}
      >
        <span style={{ color: "#E8541C", opacity: 0.9 }}>[</span>
        <span style={{ color: "#ffffff" }}>AL<DottedZero /></span>
        <span style={{ color: "#E8541C", opacity: 0.9 }}>]</span>
      </div>
      <div
        style={{
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: `${tagSize}px`,
          fontWeight: 600,
          letterSpacing: "0.4em",
          color: "#E8541C",
          opacity: 0.75,
          paddingLeft: "0.4em",
        }}
      >
        AGENT LAYER ZERO
      </div>
    </div>
  );
}
