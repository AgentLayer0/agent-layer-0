import React from "react";

export function Typographic() {
  return (
    <div
      style={{
        background: "#0d0d10",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px",
        gap: "80px",
      }}
    >
      {/* Primary Mark - Large */}
      <div className="flex flex-col items-center">
        <div
          className="flex items-center text-white"
          style={{ fontFamily: '"JetBrains Mono", monospace' }}
        >
          <span
            className="font-extrabold"
            style={{
              fontSize: "140px",
              lineHeight: "1",
              letterSpacing: "-0.12em",
              paddingRight: "16px",
            }}
          >
            AL
          </span>
          <div
            className="relative flex items-center justify-center shrink-0"
            style={{ width: "96px", height: "112px", marginTop: "12px" }}
          >
            <svg
              viewBox="0 0 100 120"
              className="w-full h-full"
              style={{
                fill: "none",
                stroke: "#E8541C",
                strokeWidth: "14",
                strokeLinecap: "square",
              }}
            >
              {/* Boxy engineered zero */}
              <rect x="7" y="7" width="86" height="106" />
              {/* Center dot */}
              <rect x="42" y="52" width="16" height="16" style={{ fill: "#E8541C", stroke: "none" }} />
            </svg>
          </div>
        </div>
        {/* Geometric rule */}
        <div
          className="w-full mt-4"
          style={{ height: "4px", background: "#E8541C", width: "240px", alignSelf: 'flex-start', marginLeft: '8px' }}
        ></div>
      </div>

      {/* Secondary Mark - Small */}
      <div className="flex flex-col items-center">
        <div
          className="flex items-center text-white"
          style={{ fontFamily: '"JetBrains Mono", monospace' }}
        >
          <span
            className="font-extrabold"
            style={{
              fontSize: "36px",
              lineHeight: "1",
              letterSpacing: "-0.12em",
              paddingRight: "4px",
            }}
          >
            AL
          </span>
          <div
            className="relative flex items-center justify-center shrink-0"
            style={{ width: "24px", height: "28px", marginTop: "2px" }}
          >
            <svg
              viewBox="0 0 100 120"
              className="w-full h-full"
              style={{
                fill: "none",
                stroke: "#E8541C",
                strokeWidth: "14",
                strokeLinecap: "square",
              }}
            >
              <rect x="7" y="7" width="86" height="106" />
              <rect x="42" y="52" width="16" height="16" style={{ fill: "#E8541C", stroke: "none" }} />
            </svg>
          </div>
        </div>
        <div
          className="w-full mt-1"
          style={{ height: "2px", background: "#E8541C", width: "64px", alignSelf: 'flex-start', marginLeft: '2px' }}
        ></div>
      </div>
    </div>
  );
}
