let currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD"
});

let compactCurrency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1
});

export function setCurrency(code: string) {
  currency = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: code
  });
  compactCurrency = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: code,
    notation: "compact",
    maximumFractionDigits: 1
  });
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
  return `${monthNames[month].slice(0, 3)} ${String(year).slice(2)}`;
}

export const monthNames = [
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
  "December"
];
