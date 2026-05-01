import React from "react";

export function Circuit() {
  return (
    <div
      style={{
        background: "#0d0d10",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px",
      }}
    >
      <div className="flex flex-col items-center gap-4">
        {/* Logo Mark */}
        <div className="relative flex items-center justify-center w-[80px] h-[80px]">
          <svg
            viewBox="0 0 100 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-full h-full"
          >
            {/* Orbit ring */}
            <circle
              cx="50"
              cy="50"
              r="35"
              stroke="#E8541C"
              strokeWidth="0.5"
              strokeOpacity="0.4"
              strokeDasharray="2 4"
            />
            
            {/* Connection Lines */}
            <path
              d="M50 50 L20 35 M50 50 L80 35 M50 50 L50 85 M50 50 L15 70"
              stroke="#E8541C"
              strokeWidth="1.5"
              strokeOpacity="0.6"
            />

            {/* Central Node */}
            <circle cx="50" cy="50" r="12" fill="#E8541C" />
            
            {/* Inner detail on central node */}
            <circle cx="50" cy="50" r="4" fill="#0d0d10" opacity="0.5" />

            {/* Outer Nodes */}
            {/* Top Left */}
            <circle cx="20" cy="35" r="5" fill="#E8541C" fillOpacity="0.7" />
            {/* Top Right */}
            <circle cx="80" cy="35" r="6" fill="#E8541C" fillOpacity="0.8" />
            {/* Bottom */}
            <circle cx="50" cy="85" r="4" fill="#E8541C" fillOpacity="0.6" />
            {/* Bottom Left (offset) */}
            <circle cx="15" cy="70" r="3" fill="#E8541C" fillOpacity="0.5" />
          </svg>
        </div>

        {/* Wordmark */}
        <div
          className="text-2xl font-bold tracking-widest"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          <span className="text-white">AL</span>
          <span style={{ color: "#E8541C" }}>0</span>
        </div>
      </div>
    </div>
  );
}
