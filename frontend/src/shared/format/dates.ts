let activeLocale = "en-US";

export function setLocale(lang: "en" | "tr") {
  activeLocale = lang === "tr" ? "tr-TR" : "en-US";
}

export function getFormatterLocale(): string {
  return activeLocale;
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-").map(Number);
  if (!year || !month || !day) return dateStr;

  try {
    return new Intl.DateTimeFormat(activeLocale, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(year, month - 1, day));
  } catch {
    return dateStr;
  }
}

export function formatActivityDate(dateStr: string): string {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-").map(Number);
  if (!year || !month || !day) return dateStr;

  const date = new Date(year, month - 1, day);
  const today = new Date();
  const normalizedDate = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
  const normalizedToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const days = Math.round(
    (normalizedDate.getTime() - normalizedToday.getTime()) /
      (1000 * 60 * 60 * 24),
  );

  if (Math.abs(days) <= 3) {
    try {
      return new Intl.RelativeTimeFormat(activeLocale, {
        numeric: "auto",
      }).format(days, "day");
    } catch {
      // Fall through to the stable absolute date format.
    }
  }
  return formatDate(dateStr);
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
