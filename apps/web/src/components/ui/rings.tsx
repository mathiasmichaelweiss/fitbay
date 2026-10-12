/**
 * «Круги питания» прототипа: порт capsSvg (SHAPE = "sq"). Квадратные капсулы, вложенные друг в друга,
 * каждая заполняется от верхней середины в обе стороны. Цвета RC прототипа.
 */
export interface RingItem {
  v: number;
  g: number;
  c: string;
}

export function CapsRings({ items, size, label }: { items: RingItem[]; size: number; label?: string }) {
  const n = items.length;
  const w = size * 0.085 * (n > 3 ? 0.76 : 1);
  const step = w * 1.5;
  const cx = size / 2;
  const paths: { d: string; c: string; fr: number; key: string }[] = [];
  items.forEach((x, i) => {
    const pad = w / 2 + 1 + i * step;
    const L = pad, R = size - pad, T = pad, B = size - pad;
    const r = Math.max(w / 2, (size - w - 2) * 0.42 - i * step);
    const fr = Math.max(0, Math.min(1, x.g ? x.v / x.g : 0));
    const a = `M${cx} ${T}H${R - r}A${r} ${r} 0 0 1 ${R} ${T + r}V${B - r}A${r} ${r} 0 0 1 ${R - r} ${B}H${cx}`;
    const b = `M${cx} ${T}H${L + r}A${r} ${r} 0 0 0 ${L} ${T + r}V${B - r}A${r} ${r} 0 0 0 ${L + r} ${B}H${cx}`;
    paths.push({ d: a, c: x.c, fr, key: `${i}a` }, { d: b, c: x.c, fr, key: `${i}b` });
  });
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} className="flex-none">
      {paths.map((p) => (
        <g key={p.key}>
          <path d={p.d} fill="none" stroke={p.c} strokeOpacity={0.18} strokeWidth={w} />
          {p.fr > 0 && (
            <path d={p.d} fill="none" stroke={p.c} strokeWidth={w} strokeLinecap="round" pathLength={100} strokeDasharray={`${100 * p.fr} 100`} className="transition-[stroke-dasharray] duration-500" />
          )}
        </g>
      ))}
    </svg>
  );
}

export const RC = { k: 'var(--ring-k)', p: 'var(--ring-p)', c: 'var(--ring-c)', f: 'var(--ring-f)' } as const;
