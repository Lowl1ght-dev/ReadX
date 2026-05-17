const STORAGE_KEY = "pdf-reader-recent-v1";
export const MAX_RECENT = 60;

export type RecentEntry = {
  /** Полный путь — только в Electron; по нему можно открыть снова */
  path?: string;
  name: string;
  openedAt: number;
  size?: number;
  lastModified?: number;
};

function entryKey(e: RecentEntry): string {
  if (e.path) return `p:${e.path}`;
  return `f:${e.name}:${e.size ?? 0}:${e.lastModified ?? 0}`;
}

export function readRecent(): RecentEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (x): x is RecentEntry =>
        Boolean(x) &&
        typeof (x as RecentEntry).name === "string" &&
        typeof (x as RecentEntry).openedAt === "number",
    );
  } catch {
    return [];
  }
}

export function writeRecent(entries: RecentEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    /* квота или приватный режим */
  }
}

export function addRecentEntry(current: RecentEntry[], entry: Omit<RecentEntry, "openedAt">): RecentEntry[] {
  const full: RecentEntry = { ...entry, openedAt: Date.now() };
  const k = entryKey(full);
  const filtered = current.filter((e) => entryKey(e) !== k);
  return [full, ...filtered].slice(0, MAX_RECENT);
}

export function removeRecentEntry(current: RecentEntry[], entry: RecentEntry): RecentEntry[] {
  const k = entryKey(entry);
  return current.filter((e) => entryKey(e) !== k);
}

export function formatRecentTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 45_000) return "только что";
  if (diff < 3600_000) {
    const m = Math.floor(diff / 60_000);
    return `${m} мин. назад`;
  }
  if (diff < 86400_000) {
    const h = Math.floor(diff / 3600_000);
    return `${h} ч. назад`;
  }
  const d = Math.floor(diff / 86400_000);
  if (d === 1) return "вчера";
  if (d < 7) return `${d} дн. назад`;
  try {
    return new Intl.DateTimeFormat("ru", { day: "numeric", month: "short", year: "numeric" }).format(new Date(ts));
  } catch {
    return new Date(ts).toLocaleDateString("ru");
  }
}
