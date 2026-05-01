import React from 'react';

export function Bracket() {
  return (
    <div style={{ background: '#0d0d10', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
        <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '72px', fontWeight: 800, letterSpacing: '-0.04em', display: 'flex', alignItems: 'center', gap: '16px', lineHeight: 1 }}>
          <span style={{ color: '#E8541C', opacity: 0.9 }}>[</span>
          <span style={{ color: '#ffffff', paddingBottom: '4px' }}>AL0</span>
          <span style={{ color: '#E8541C', opacity: 0.9 }}>]</span>
        </div>
        <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '11px', fontWeight: 600, letterSpacing: '0.4em', color: '#E8541C', opacity: 0.8, marginLeft: '0.4em' }}>
          AGENT LAYER ZERO
        </div>
      </div>
    </div>
  );
}
