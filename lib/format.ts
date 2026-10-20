export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const PAYMENTS = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'transfer', label: 'Transfer' }
] as const;

export function paymentLabel(v: string): string {
  return PAYMENTS.find((p) => p.value === v)?.label ?? v;
}

export function yen(n: number): string {
  return '¥' + Math.round(n).toLocaleString('en-US');
}

/** Today's date in Japan as YYYY-MM-DD. */
export function tokyoToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

export function tokyoYearMonth(): { y: number; m: number } {
  const [y, m] = tokyoToday().split('-').map(Number);
  return { y, m: m - 1 };
}

const pad = (n: number) => String(n).padStart(2, '0');

/** First day of the month and first day of the next month (m is 0–11). */
export function monthRange(y: number, m: number): [string, string] {
  const ny = m === 11 ? y + 1 : y;
  const nm = m === 11 ? 0 : m + 1;
  return [`${y}-${pad(m + 1)}-01`, `${ny}-${pad(nm + 1)}-01`];
}

export function yearRange(y: number): [string, string] {
  return [`${y}-01-01`, `${y + 1}-01-01`];
}

function parts(d: string) {
  const [y, m, day] = d.split('-').map(Number);
  return { y, m: m - 1, day };
}

/** "Mon, Oct 19" */
export function dayLabel(d: string): string {
  const { y, m, day } = parts(d);
  return `${DAYS[new Date(Date.UTC(y, m, day)).getUTCDay()]}, ${SHORT_MONTHS[m]} ${day}`;
}

/** "Oct 19" */
export function shortDate(d: string): string {
  const { m, day } = parts(d);
  return `${SHORT_MONTHS[m]} ${day}`;
}

export function monthOf(d: string): number {
  return parts(d).m;
}

/** Accepts "1,240" or "１２４０" and returns 1240, or NaN. */
export function parseAmount(s: string): number {
  const ascii = s.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
  const digits = ascii.replace(/[,\s¥￥]/g, '');
  if (!/^\d+$/.test(digits)) return NaN;
  return Number(digits);
}
