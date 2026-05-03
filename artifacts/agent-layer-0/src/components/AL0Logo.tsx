function DottedZero({ color = "#ffffff" }: { color?: string }) {
  // Custom-drawn "0" so we don't inherit JetBrains Mono's slashed-zero glyph.
  // Renders as an SVG inline with the surrounding text, sized in em units.
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 60 80"
      style={{
        display: "inline-block",
        width: "0.6em",
        height: "0.8em",
        verticalAlign: "baseline",
        marginBottom: "-0.07em",
        overflow: "visible",
      }}
      role="img"
      aria-label="0"
    >
      {/* Outer ring — the "0" */}
      <rect
        x="6"
        y="6"
        width="48"
        height="68"
        rx="24"
        ry="24"
        fill="none"
        stroke={color}
        strokeWidth="12"
      />
      {/* Centered dot — the "inner eye" */}
      <circle cx="30" cy="40" r="6" fill={color} />
    </svg>
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
