import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import {
  applyColorSchemePreference,
  getSystemColorScheme,
  readColorSchemePreference,
  subscribeToSystemColorScheme,
  writeColorSchemePreference,
  type ColorScheme,
  type ColorSchemePreference
} from "../theme";

export function ThemeToggle() {
  const [preference, setPreference] = useState<ColorSchemePreference>(() =>
    readColorSchemePreference()
  );
  const [systemScheme, setSystemScheme] = useState<ColorScheme>(() => getSystemColorScheme());
  const manual = preference !== "system";
  const nextPreference: ColorSchemePreference = manual
    ? "system"
    : systemScheme === "dark"
      ? "light"
      : "dark";
  const label = manual
    ? "Use system color setting"
    : systemScheme === "dark"
      ? "Use light mode"
      : "Use dark mode";
  const currentScheme: ColorScheme = preference === "system" ? systemScheme : preference;
  const Icon = currentScheme === "dark" ? Sun : Moon;

  useEffect(() => {
    applyColorSchemePreference(preference);
  }, [preference]);

  useEffect(
    () =>
      subscribeToSystemColorScheme(() => {
        setSystemScheme(getSystemColorScheme());
      }),
    []
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
