// Saved expense names and last-used choices, kept only on this device (localStorage).
const MAX = 200;

function key(userId: string) {
  return `expense-tracker:names:v1:${userId}`;
}

export function loadNames(userId: string): string[] {
  try {
    const raw = window.localStorage.getItem(key(userId));
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function rememberName(userId: string, name: string) {
  const n = name.trim();
  if (!n) return;
  try {
    const rest = loadNames(userId).filter((x) => x.toLowerCase() !== n.toLowerCase());
    window.localStorage.setItem(key(userId), JSON.stringify([n, ...rest].slice(0, MAX)));
  } catch {
    /* storage unavailable: suggestions simply won't be saved */
  }
}

export function matchNames(list: string[], typed: string): string[] {
  const q = typed.trim().toLowerCase();
  if (!q) return [];
  return list.filter((n) => {
    const l = n.toLowerCase();
    return l.includes(q) && l !== q;
  });
}

type LastUsed = { categoryId?: string; payment?: string };

export function loadLastUsed(userId: string): LastUsed {
  try {
    return JSON.parse(window.localStorage.getItem(`expense-tracker:last:v1:${userId}`) || '{}') as LastUsed;
  } catch {
    return {};
  }
}

export function saveLastUsed(userId: string, v: LastUsed) {
  try {
    window.localStorage.setItem(`expense-tracker:last:v1:${userId}`, JSON.stringify(v));
  } catch {
    /* ignore */
  }
}

// One-time message shown on the next screen ("Saved", "Moved to Trash").
export function setFlash(msg: string) {
  try {
    window.sessionStorage.setItem('expense-tracker:flash', msg);
  } catch {
    /* ignore */
  }
}

export function takeFlash(): string {
  try {
    const m = window.sessionStorage.getItem('expense-tracker:flash') || '';
    window.sessionStorage.removeItem('expense-tracker:flash');
    return m;
  } catch {
    return '';
  }
}
