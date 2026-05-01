import React from 'react';

export function Layers() {
  const orange = '#E8541C';
  const darkBg = '#0d0d10';

  return (
    <div style={{ background: darkBg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px' }}>
      <div className="flex flex-col items-center gap-6">
        
        {/* Icon Frame */}
        <div className="relative flex flex-col justify-between w-28 h-28 rounded-[1.25rem] border-[1.5px] border-white/10 bg-gradient-to-b from-white/[0.03] to-transparent p-5 shadow-inner">
          
          {/* Top Bar (Low Opacity) */}
          <div className="w-full h-1.5 rounded-full bg-white/15"></div>
          
          {/* Middle Bar (Medium Opacity) */}
          <div className="w-full h-1.5 rounded-full bg-white/40"></div>
          
          {/* Bottom Bar (Full Orange + Circle) */}
          <div className="w-full h-1.5 rounded-full relative flex items-center" style={{ backgroundColor: orange }}>
            {/* Active Node Circle */}
            <div 
              className="absolute -left-1 w-3.5 h-3.5 rounded-full bg-white shadow-[0_0_8px_rgba(232,84,28,0.8)]"
            ></div>
          </div>
          
        </div>

        {/* Wordmark */}
        <div className="text-3xl tracking-tight flex items-center" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
          <span className="font-extrabold text-white tracking-tight">AL</span>
          <span className="font-extrabold" style={{ color: orange }}>0</span>
        </div>
      </div>
    </div>
  );
}
