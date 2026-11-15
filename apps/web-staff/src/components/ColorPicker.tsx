const PRESETS = [
  '#f5b301',
  '#ff9d2e',
  '#ff6b35',
  '#ef4444',
  '#ec4899',
  '#a855f7',
  '#6366f1',
  '#3b82f6',
  '#06b6d4',
  '#10b981',
  '#22c55e',
  '#14b8a6',
  '#ffffff',
];

export default function ColorPicker({ label, value, onChange }: { label: string; value: string; onChange: (c: string) => void }) {
  return (
    <div style={{ marginTop: 16 }}>
      <label>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 10 }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            background: value,
            boxShadow: `0 0 22px ${value}66, 0 0 6px ${value}44`,
            border: '1px solid rgba(255,255,255,.15)',
            flexShrink: 0,
          }}
        />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {PRESETS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onChange(c)}
              title={c}
              style={{
                width: 26,
                height: 26,
                borderRadius: '50%',
                background: c,
                border: value === c ? '2px solid #fff' : '2px solid rgba(255,255,255,.12)',
                boxShadow: value === c ? `0 0 10px ${c}` : undefined,
                cursor: 'pointer',
                transition: 'transform .15s',
              }}
            />
          ))}
          <label
            title="Color personalizado"
            style={{
              position: 'relative',
              width: 26,
              height: 26,
              borderRadius: '50%',
              border: '2px dashed rgba(255,255,255,.3)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            }}
          >
            <span style={{ fontSize: 14, color: '#8b95a6', lineHeight: 1 }}>+</span>
            <input
              type="color"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }}
            />
          </label>
        </div>
      </div>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder="#f5b301" style={{ marginTop: 10, textTransform: 'uppercase' }} />
    </div>
  );
}
