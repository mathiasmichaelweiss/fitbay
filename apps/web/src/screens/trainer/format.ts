/** fmtD, fmtT, dayKey прототипа. loc: язык интерфейса. */
const L = (loc: string) => (loc === 'de' ? 'de-DE' : 'ru-RU');
export const fmtD = (ts: number, loc: string) => new Date(ts).toLocaleDateString(L(loc), { weekday: 'short', day: 'numeric', month: 'short' });
export const fmtT = (ts: number, loc: string) => new Date(ts).toLocaleTimeString(L(loc), { hour: '2-digit', minute: '2-digit' });
export const dayKey = (ts: number) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
