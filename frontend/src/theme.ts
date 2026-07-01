export type ColorScheme = "light" | "dark";
export type ColorSchemePreference = "system" | ColorScheme;

export const COLOR_SCHEME_STORAGE_KEY = "ledger-workbench-color-scheme";

const COLOR_SCHEME_QUERY = "(prefers-color-scheme: dark)";
const SYSTEM_COLOR_SCHEME = "light dark";

export function readColorSchemePreference(): ColorSchemePreference {
  try {
    const value = window.localStorage.getItem(COLOR_SCHEME_STORAGE_KEY);
    if (isColorScheme(value)) {
      return value;
    }
    if (value !== null) {
      window.localStorage.removeItem(COLOR_SCHEME_STORAGE_KEY);
    }
  } catch {
    return "system";
  }

  return "system";
}

export function writeColorSchemePreference(preference: ColorSchemePreference) {
  try {
    if (preference === "system") {
      window.localStorage.removeItem(COLOR_SCHEME_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(COLOR_SCHEME_STORAGE_KEY, preference);
  } catch {
    // Storage can be unavailable in private or locked-down browser contexts.
  }
}

export function getSystemColorScheme(): ColorScheme {
  return window.matchMedia?.(COLOR_SCHEME_QUERY).matches ? "dark" : "light";
}

export function applyColorSchemePreference(preference: ColorSchemePreference) {
  const root = document.documentElement;
  const meta = colorSchemeMeta();

  if (preference === "system") {
    root.removeAttribute("data-theme");
    meta.content = SYSTEM_COLOR_SCHEME;
    return;
  }

  root.dataset.theme = preference;
  meta.content = preference;
}

export function subscribeToSystemColorScheme(listener: () => void) {
  const mediaQuery = window.matchMedia?.(COLOR_SCHEME_QUERY);
  if (!mediaQuery) {
    return () => {};
  }

  mediaQuery.addEventListener("change", listener);
  return () => mediaQuery.removeEventListener("change", listener);
}

function colorSchemeMeta() {
  let meta = document.querySelector<HTMLMetaElement>('meta[name="color-scheme"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "color-scheme";
    document.head.append(meta);
  }
  return meta;
}

function isColorScheme(value: string | null): value is ColorScheme {
  return value === "light" || value === "dark";
}
