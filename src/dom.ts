type Props = Partial<Record<string, unknown>>;

/** document.createElement with properties and children. */
export function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Props = {}, ...children: (Node | string | null | undefined | false)[]): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined) continue;
    if (k.startsWith('data-') || k.startsWith('aria-')) e.setAttribute(k, String(v));
    else (e as unknown as Record<string, unknown>)[k] = v;
  }
  for (const c of children) if (c !== null && c !== undefined && c !== false) e.append(c);
  return e;
}

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Seconds with one decimal: 12.3 s */
export const secs = (ms: number) => `${(ms / 1000).toFixed(1)} s`;

/** localStorage that never throws (private windows, blocked storage). */
export const store = {
  get<T>(key: string, fallback: T): T {
    try {
      const v = localStorage.getItem(key);
      return v === null ? fallback : (JSON.parse(v) as T);
    } catch {
      return fallback;
    }
  },
  set(key: string, value: unknown): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // not kept
    }
  },
};

export function shuffle<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
