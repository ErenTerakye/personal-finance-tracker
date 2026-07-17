import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  applyColorSchemePreference,
  getSystemColorScheme,
  readColorSchemePreference,
  subscribeToSystemColorScheme,
  writeColorSchemePreference,
  type ColorScheme,
  type ColorSchemePreference,
} from "./preference";

type ThemeContextValue = {
  preference: ColorSchemePreference;
  scheme: ColorScheme;
  setScheme: (scheme: ColorScheme) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState<ColorSchemePreference>(() =>
    readColorSchemePreference(),
  );
  const [systemScheme, setSystemScheme] = useState<ColorScheme>(() =>
    getSystemColorScheme(),
  );

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

  const setScheme = (nextScheme: ColorScheme) => {
    writeColorSchemePreference(nextScheme);
    applyColorSchemePreference(nextScheme);
    setPreference(nextScheme);
  };

  return (
    <ThemeContext.Provider
      value={{
        preference,
        scheme: preference === "system" ? systemScheme : preference,
        setScheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used within ThemeProvider");
  return value;
}
