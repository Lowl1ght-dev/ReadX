export type ThemePreference = "system" | "light" | "dark";

const KEYS = {
  name: "readx-settings-display-name",
  theme: "readx-settings-theme",
  reduceMotion: "readx-settings-reduce-motion",
} as const;

export function readDisplayName(): string {
  try {
    const v = localStorage.getItem(KEYS.name);
    return typeof v === "string" ? v : "";
  } catch {
    return "";
  }
}

export function writeDisplayName(value: string): void {
  try {
    localStorage.setItem(KEYS.name, value);
  } catch {
    /* private mode */
  }
}

export function readThemePreference(): ThemePreference {
  try {
    const v = localStorage.getItem(KEYS.theme);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    /* */
  }
  return "dark";
}

export function writeThemePreference(theme: ThemePreference): void {
  try {
    localStorage.setItem(KEYS.theme, theme);
  } catch {
    /* */
  }
}

export function readReduceMotion(): boolean {
  try {
    return localStorage.getItem(KEYS.reduceMotion) === "1";
  } catch {
    return false;
  }
}

export function writeReduceMotion(on: boolean): void {
  try {
    localStorage.setItem(KEYS.reduceMotion, on ? "1" : "0");
  } catch {
    /* */
  }
}

export function resolveEffectiveTheme(pref: ThemePreference): "light" | "dark" {
  if (pref === "light") return "light";
  if (pref === "dark") return "dark";
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** data-theme-pref — выбор пользователя; data-theme — фактическая светлая/тёмная подложка */
export function applyThemePreferenceToDocument(pref: ThemePreference): void {
  const root = document.documentElement;
  root.dataset.themePref = pref;
  root.dataset.theme = resolveEffectiveTheme(pref);
}

export function applyReduceMotionToDocument(on: boolean): void {
  document.documentElement.dataset.reduceMotion = on ? "1" : "0";
}
