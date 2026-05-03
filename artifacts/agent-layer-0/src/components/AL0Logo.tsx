function DottedZero({ color = "#ffffff" }: { color?: string }) {
  // JetBrains Mono "0" has a baked-in slash; capital "O" is identical in shape without it.
  // At weight 800 the O counter's visual center sits at ≈ 50% of the line-box height
  // (verified by rendering at 200 px with pixel-level reference lines).
  return (
    <span style={{ position: "relative", display: "inline-block", color }}>
      O
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "0.12em",
          height: "0.12em",
          borderRadius: "50%",
          background: color,
          display: "block",
          pointerEvents: "none",
        }}
      />
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
