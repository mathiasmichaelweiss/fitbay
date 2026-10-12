/** Кольцо прогресса. value 0..1+, при перевыполнении кольцо красное. */
export function Ring({ value, size = 168, stroke = 14, children }: { value: number; size?: number; stroke?: number; children?: React.ReactNode }) {
  const r = (size - stroke) / 2;
  const len = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  const over = value > 1;
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={over ? 'var(--red)' : 'var(--orange)'}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={len}
          strokeDashoffset={len * (1 - v)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset .4s ease' }}
        />
      </svg>
      <div className="ring__center">{children}</div>
    </div>
  );
}

/** Горизонтальная полоска для БЖУ. */
export function Bar({ label, eaten, goal, color, unit }: { label: string; eaten: number; goal: number; color: string; unit: string }) {
  const v = goal > 0 ? Math.min(1, eaten / goal) : 0;
  return (
    <div className="bar">
      <div className="bar__head">
        <span>{label}</span>
        <span className="bar__nums">
          {eaten} / {goal} {unit}
        </span>
      </div>
      <div className="bar__track">
        <div className="bar__fill" style={{ width: `${v * 100}%`, background: eaten > goal ? 'var(--red)' : color }} />
      </div>
    </div>
  );
}
