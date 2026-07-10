import { getFormatterLocale } from "./dates";

let activeCurrencyCode = "USD";

export function setCurrency(code: string) {
  activeCurrencyCode = code || "USD";
}

function currency(notation?: "compact") {
  return new Intl.NumberFormat(getFormatterLocale(), {
    style: "currency",
    currency: activeCurrencyCode,
    notation,
    maximumFractionDigits: notation === "compact" ? 1 : undefined,
  });
}

export function money(value: string | number): string {
  return currency().format(Number(value));
}

export function compactMoney(value: string | number): string {
  return currency("compact").format(Number(value));
}

export function signedMoney(value: string | number): string {
  const amount = Number(value);
  const prefix = amount > 0 ? "+" : amount < 0 ? "-" : "";
  return `${prefix}${currency().format(Math.abs(amount))}`;
}

export function percent(value: string | number): string {
  return `${Number(value).toFixed(1)}%`;
}
