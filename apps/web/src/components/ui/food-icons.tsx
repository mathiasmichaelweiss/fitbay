/** Иконки посуды (plateSvg прототипа) и заглушка фото блюда (phIcon прототипа). */
export function PlateIcon({ kind }: { kind: string }) {
  const s = { fill: '#333', stroke: 'currentColor' };
  if (kind === 'flat')
    return (
      <svg viewBox="0 0 60 30" className="h-10 w-full" aria-hidden>
        <ellipse cx="30" cy="18" rx="27" ry="8" {...s} />
        <ellipse cx="30" cy="17" rx="16" ry="4.5" fill="none" stroke="currentColor" opacity=".4" />
      </svg>
    );
  if (kind === 'deep')
    return (
      <svg viewBox="0 0 60 30" className="h-10 w-full" aria-hidden>
        <path d="M5 12 Q30 34 55 12" {...s} />
        <ellipse cx="30" cy="12" rx="25" ry="5" {...s} />
      </svg>
    );
  if (kind === 'bowl')
    return (
      <svg viewBox="0 0 60 30" className="h-10 w-full" aria-hidden>
        <path d="M12 8 Q12 28 30 28 Q48 28 48 8" {...s} />
        <ellipse cx="30" cy="8" rx="18" ry="4" {...s} />
      </svg>
    );
  return (
    <svg viewBox="0 0 60 30" className="h-10 w-full" aria-hidden>
      <rect x="10" y="8" width="40" height="18" rx="4" {...s} />
      <rect x="8" y="5" width="44" height="5" rx="2" {...s} />
    </svg>
  );
}

const PAL: [string, string][] = [['#FF5A0A', '#111'], ['#F4EFE6', '#111'], ['#F2B705', '#111'], ['#AFD9DA', '#111'], ['#0B4A2E', '#F4EFE6'], ['#FFC9B5', '#111']];

export function FoodIcon({ name, thumb }: { name: string; thumb?: string }) {
  if (thumb) return <img src={thumb} alt="" className="size-12 flex-none rounded-xl object-cover" />;
  let h = 0;
  for (const ch of String(name || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const [bg, fg] = PAL[h % PAL.length]!;
  return (
    <svg viewBox="0 0 48 48" aria-hidden className="size-12 flex-none rounded-xl" style={{ background: bg }}>
      <circle cx="24" cy="25" r="11" fill="none" stroke={fg} strokeWidth="2.2" />
      <circle cx="24" cy="25" r="6.5" fill="none" stroke={fg} strokeWidth="1.4" opacity=".5" />
      <path d="M9 14v7a2.5 2.5 0 0 0 5 0v-7M11.5 14v21" fill="none" stroke={fg} strokeWidth="2" strokeLinecap="round" />
      <path d="M38 14c-2.5 1.5-3 6-3 9h3v12" fill="none" stroke={fg} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
