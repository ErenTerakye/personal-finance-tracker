import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import {
  applyColorSchemePreference,
  getSystemColorScheme,
  readColorSchemePreference,
  subscribeToSystemColorScheme,
  writeColorSchemePreference,
  type ColorScheme,
  type ColorSchemePreference,
} from "../theme";
import { useI18n } from "../i18n";

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
      onClick={() => {
        writeColorSchemePreference(nextPreference);
        setPreference(nextPreference);
      }}
    >
      <Icon aria-hidden="true" size={17} />
      <span className="sr-only">{label}</span>
    </button>
  );
}
