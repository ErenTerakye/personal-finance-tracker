import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import {
  applyColorSchemePreference,
  getSystemColorScheme,
  readColorSchemePreference,
  subscribeToSystemColorScheme,
  writeColorSchemePreference,
  type ColorScheme,
  type ColorSchemePreference,
} from "./preference";
import { applyThemeChangeWithTransition } from "./transition";
import { useI18n } from "../i18n/I18nProvider";

export function ThemeToggle() {
  const { t } = useI18n();
  const [preference, setPreference] = useState<ColorSchemePreference>(() =>
    readColorSchemePreference(),
  );
  const [systemScheme, setSystemScheme] = useState<ColorScheme>(() =>
    getSystemColorScheme(),
  );
  const manual = preference !== "system";
  const nextPreference: ColorSchemePreference = manual
    ? "system"
    : systemScheme === "dark"
      ? "light"
      : "dark";
  const label = manual
    ? t("theme.system")
    : systemScheme === "dark"
      ? t("theme.light")
      : t("theme.dark");
  const currentScheme: ColorScheme =
    preference === "system" ? systemScheme : preference;
  const Icon = currentScheme === "dark" ? Sun : Moon;

  useEffect(() => {
    applyColorSchemePreference(preference);
  }, [preference]);

  useEffect(
    () =>
      subscribeToSystemColorScheme(() => {
        setSystemScheme(getSystemColorScheme());
      }),
    [],
  );

  return (
    <button
      className="theme-toggle"
      type="button"
      aria-label={label}
      title={label}
      onClick={(event) => {
        applyThemeChangeWithTransition(event.currentTarget, () => {
          writeColorSchemePreference(nextPreference);
          applyColorSchemePreference(nextPreference);
          flushSync(() => setPreference(nextPreference));
        });
      }}
    >
      <span className="theme-toggle-icon" aria-hidden="true">
        <Icon size={17} />
      </span>
      <span className="sr-only">{label}</span>
    </button>
  );
}
