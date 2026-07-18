import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { setLocale as setFormatterLocale } from "../format/dates";
import { en } from "./locales/en";
import { tr } from "./locales/tr";
import type { Language } from "./types";

const i18nContext = createContext<{
  locale: Language;
  setLocale: (locale: Language) => void;
  toggleLocale: () => void;
  t: (key: string, variables?: Record<string, string | number>) => string;
  tUpper: (key: string, variables?: Record<string, string | number>) => string;
} | null>(null);

const STORAGE_KEY = "finance-tracker-language";

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Language>(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "tr" || stored === "en") {
        return stored;
      }
    } catch {}
    if (typeof navigator !== "undefined") {
      const legacyNavigator = navigator as Navigator & {
        userLanguage?: string;
      };
      const lang = navigator.language || legacyNavigator.userLanguage || "";
      if (lang.toLowerCase().startsWith("tr")) {
        return "tr";
      }
    }
    return "en";
  });

  const setLocale = (nextLocale: Language) => {
    setLocaleState(nextLocale);
    try {
      window.localStorage.setItem(STORAGE_KEY, nextLocale);
    } catch {}
  };

  const toggleLocale = () => {
    setLocale(locale === "en" ? "tr" : "en");
  };

  // Synchronously sync the formatter locale on every render to avoid lag/race condition
  setFormatterLocale(locale);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const t = (
    key: string,
    variables?: Record<string, string | number>,
  ): string => {
    const enVal = lookupTranslation(en, key);
    const trVal = lookupTranslation(tr, key);

    let result = locale === "tr" ? trVal : enVal;
    if (result === undefined || result === null) {
      result = enVal;
    }
    if (result === undefined || result === null) {
      return key;
    }

    if (typeof result !== "string") {
      return key;
    }

    if (variables) {
      let interpolated = result;
      for (const [varName, varVal] of Object.entries(variables)) {
        interpolated = interpolated.replace(
          new RegExp(`{${varName}}`, "g"),
          String(varVal),
        );
      }
      return interpolated;
    }

    return result;
  };

  const tUpper = (
    key: string,
    variables?: Record<string, string | number>,
  ): string => {
    const enVal = lookupTranslation(en, key);
    const trVal = lookupTranslation(tr, key);

    let result = locale === "tr" ? trVal : enVal;
    let resolvedLang: Language = locale;
    if (result === undefined || result === null) {
      result = enVal;
      resolvedLang = "en";
    }
    if (result === undefined || result === null) {
      return key.toUpperCase();
    }

    if (typeof result !== "string") {
      return key.toUpperCase();
    }

    let interpolated = result;
    if (variables) {
      for (const [varName, varVal] of Object.entries(variables)) {
        interpolated = interpolated.replace(
          new RegExp(`{${varName}}`, "g"),
          String(varVal),
        );
      }
    }

    return resolvedLang === "tr"
      ? interpolated.toLocaleUpperCase("tr-TR")
      : interpolated.toUpperCase();
  };

  return (
    <i18nContext.Provider
      value={{ locale, setLocale, toggleLocale, t, tUpper }}
    >
      {children}
    </i18nContext.Provider>
  );
}

function lookupTranslation(dictionary: unknown, key: string): unknown {
  let value = dictionary;
  for (const part of key.split(".")) {
    if (typeof value !== "object" || value === null || !(part in value)) {
      return undefined;
    }
    value = (value as Record<string, unknown>)[part];
  }
  return value;
}

export function useI18n() {
  const context = useContext(i18nContext);
  if (!context) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return context;
}
