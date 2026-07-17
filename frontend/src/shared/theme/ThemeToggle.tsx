import { Moon, Sun } from "lucide-react";
import { useI18n } from "../i18n/I18nProvider";
import { useTheme } from "./ThemeProvider";

export function ThemeToggle() {
  const { t } = useI18n();
  const { scheme, setScheme } = useTheme();
  const nextScheme = scheme === "dark" ? "light" : "dark";
  const label = t(`theme.${nextScheme}`);
  const Icon = scheme === "dark" ? Sun : Moon;

  return (
    <button
      className="theme-toggle"
      type="button"
      aria-label={label}
      onClick={() => setScheme(nextScheme)}
    >
      <span className="theme-toggle-icon" aria-hidden="true" key={scheme}>
        <Icon size={17} />
      </span>
      <span className="sr-only">{label}</span>
    </button>
  );
}

export function LangToggle() {
  const { locale, setLocale, t } = useI18n();
  const nextLocale = locale === "en" ? "tr" : "en";
  const label =
    nextLocale === "tr"
      ? t("preferences.switchToTurkish")
      : t("preferences.switchToEnglish");

  return (
    <button
      className="lang-toggle"
      type="button"
      aria-label={label}
      onClick={() => setLocale(nextLocale)}
    >
      <span aria-hidden="true">{nextLocale.toUpperCase()}</span>
    </button>
  );
}
