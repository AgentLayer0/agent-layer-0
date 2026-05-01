interface AL0MarkProps {
  size?: number;
  className?: string;
}

export function AL0Mark({ size = 32, className }: AL0MarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="AL0 mark"
    >
      <rect x="1" y="1" width="30" height="30" rx="5" stroke="#E8541C" strokeWidth="1.5" fill="rgba(232,84,28,0.08)" />
      <rect x="7" y="9" width="18" height="2" rx="1" fill="#E8541C" opacity="0.35" />
      <rect x="7" y="14" width="18" height="2" rx="1" fill="#E8541C" opacity="0.6" />
      <rect x="7" y="19" width="18" height="2.5" rx="1" fill="#E8541C" />
      <circle cx="7" cy="20.25" r="2.5" fill="#E8541C" />
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
    sm: { iconSize: 20, text: "text-sm", sub: "text-xs" },
    md: { iconSize: 26, text: "text-base", sub: "text-sm" },
    lg: { iconSize: 40, text: "text-2xl", sub: "text-base" },
  }[size];

  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      <AL0Mark size={config.iconSize} />
      <div className="flex items-baseline gap-1.5 leading-none">
        <span
          className={`font-mono font-bold tracking-tight text-foreground ${config.text}`}
          style={{ letterSpacing: "-0.02em" }}
        >
          AL<span style={{ color: "#E8541C" }}>0</span>
        </span>
        {showFull && (
          <span
            className={`font-sans font-light text-muted-foreground ${config.sub}`}
            style={{ letterSpacing: "0.04em" }}
          >
            · Agent Layer Zero
          </span>
        )}
      </div>
    </div>
  );
}

interface AL0CTAMarkProps {
  size?: number;
  className?: string;
}

export function AL0CTAMark({ size = 64, className }: AL0CTAMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="AL0 symbol"
    >
      <rect x="2" y="2" width="60" height="60" rx="10" stroke="#E8541C" strokeWidth="2" fill="rgba(232,84,28,0.06)" />
      <rect x="14" y="18" width="36" height="4" rx="2" fill="#E8541C" opacity="0.25" />
      <rect x="14" y="28" width="36" height="4" rx="2" fill="#E8541C" opacity="0.55" />
      <rect x="14" y="38" width="36" height="5" rx="2" fill="#E8541C" />
      <circle cx="14" cy="40.5" r="5" fill="#E8541C" />
      <circle cx="14" cy="40.5" r="2.5" fill="#0d0d12" />
    </svg>
  );
}
