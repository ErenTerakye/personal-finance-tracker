let activeLocale = "en-US";
let activeCurrencyCode = "USD";

let currency = new Intl.NumberFormat(activeLocale, {
  style: "currency",
  currency: activeCurrencyCode,
});

let compactCurrency = new Intl.NumberFormat(activeLocale, {
  style: "currency",
  currency: activeCurrencyCode,
  notation: "compact",
  maximumFractionDigits: 1,
});

function updateFormatters() {
  currency = new Intl.NumberFormat(activeLocale, {
    style: "currency",
    currency: activeCurrencyCode,
  });
  compactCurrency = new Intl.NumberFormat(activeLocale, {
    style: "currency",
    currency: activeCurrencyCode,
    notation: "compact",
    maximumFractionDigits: 1,
  });
  monthNames = activeLocale.startsWith("tr") ? monthNamesTr : monthNamesEn;
}

export function setCurrency(code: string) {
  activeCurrencyCode = code || "USD";
  updateFormatters();
}

export function setLocale(lang: "en" | "tr") {
  activeLocale = lang === "tr" ? "tr-TR" : "en-US";
  updateFormatters();
}

export function money(value: string | number): string {
  return currency.format(Number(value));
}

export function compactMoney(value: string | number): string {
  return compactCurrency.format(Number(value));
}

export function signedMoney(value: string | number): string {
  const amount = Number(value);
  const prefix = amount > 0 ? "+" : amount < 0 ? "-" : "";
  return `${prefix}${currency.format(Math.abs(amount))}`;
}

export function percent(value: string | number): string {
  return `${Number(value).toFixed(1)}%`;
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-").map(Number);
  if (!year || !month || !day) return dateStr;

  const dateObj = new Date(year, month - 1, day);
  try {
    const dtf = new Intl.DateTimeFormat(activeLocale, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    return dtf.format(dateObj);
  } catch {
    return dateStr;
  }
}

export function formatActivityDate(dateStr: string): string {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-").map(Number);
  if (!year || !month || !day) return dateStr;

  const dateObj = new Date(year, month - 1, day);
  const todayObj = new Date();

  const d1 = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
  const d2 = new Date(todayObj.getFullYear(), todayObj.getMonth(), todayObj.getDate());

  const diffTime = d1.getTime() - d2.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (Math.abs(diffDays) <= 3) {
    try {
      const rtf = new Intl.RelativeTimeFormat(activeLocale, { numeric: "auto" });
      return rtf.format(diffDays, "day");
    } catch {}
  }

  return formatDate(dateStr);
}


export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function currentPeriod(): { month: number; year: number } {
  const now = new Date();
  return { month: now.getMonth() + 1, year: now.getFullYear() };
}

export function periodLabel(month: number, year: number): string {
  return `${monthNames[month]} ${year}`;
}

export function shortPeriodLabel(month: number, year: number): string {
  // Safe slice for Turkish month names
  return `${monthNames[month].slice(0, 3)} ${String(year).slice(2)}`;
}

const monthNamesEn = [
  "",
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const monthNamesTr = [
  "",
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
];

export let monthNames = monthNamesEn;
