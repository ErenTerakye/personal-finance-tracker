import { useEffect, useState } from "react";

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window === "undefined" || typeof window.matchMedia !== "function"
      ? false
      : window.matchMedia(query).matches,
  );

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mediaQuery = window.matchMedia(query);
    const updateMatches = (event: MediaQueryListEvent) =>
      setMatches(event.matches);
    setMatches(mediaQuery.matches);
    mediaQuery.addEventListener("change", updateMatches);
    return () => mediaQuery.removeEventListener("change", updateMatches);
  }, [query]);

  return matches;
}
