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

const MONEY_PATTERN = /^([+-]?)(\d+)(?:\.(\d{0,2}))?$/;

function minorUnits(value: string | number): bigint {
  const text =
    typeof value === "number" && Number.isFinite(value)
      ? value.toFixed(2)
      : String(value).trim();
  const match = MONEY_PATTERN.exec(text);
  if (!match) throw new RangeError(`Invalid money value: ${text}`);
  const [, sign, units, fraction = ""] = match;
  const amount = BigInt(units) * 100n + BigInt(fraction.padEnd(2, "0"));
  return sign === "-" ? -amount : amount;
}

function fromMinorUnits(value: bigint): string {
  const sign = value < 0n ? "-" : "";
  const absolute = value < 0n ? -value : value;
  return `${sign}${absolute / 100n}.${String(absolute % 100n).padStart(2, "0")}`;
}

function exactFormat(formatter: Intl.NumberFormat, value: string | number) {
  // ECMA-402 accepts a decimal StringNumericLiteral without first rounding it to Number.
  const format = formatter.format as (
    input: string | number | bigint,
  ) => string;
  return format(value);
}

export function money(value: string | number): string {
  return exactFormat(
    currency(),
    typeof value === "number" && Number.isFinite(value)
      ? value.toFixed(2)
      : value,
  );
}

export function currencySymbol(): string {
  return (
    currency()
      .formatToParts(0)
      .find((part) => part.type === "currency")?.value ?? activeCurrencyCode
  );
}

export function compactMoney(value: string | number): string {
  return exactFormat(currency("compact"), value);
}

export function signedMoney(value: string | number): string {
  const amount = minorUnits(value);
  const prefix = amount > 0n ? "+" : amount < 0n ? "-" : "";
  return `${prefix}${money(fromMinorUnits(amount < 0n ? -amount : amount))}`;
}

export function sumMoney(values: Iterable<string | number>): string {
  let total = 0n;
  for (const value of values) total += minorUnits(value);
  return fromMinorUnits(total);
}

export function subtractMoney(
  left: string | number,
  right: string | number,
): string {
  return fromMinorUnits(minorUnits(left) - minorUnits(right));
}

export function negateMoney(value: string | number): string {
  return fromMinorUnits(-minorUnits(value));
}

export function compareMoney(
  left: string | number,
  right: string | number,
): number {
  const difference = minorUnits(left) - minorUnits(right);
  return difference > 0n ? 1 : difference < 0n ? -1 : 0;
}

export function absoluteMoney(value: string | number): string {
  const amount = minorUnits(value);
  return fromMinorUnits(amount < 0n ? -amount : amount);
}

export function nonNegativeMoney(value: string | number): string {
  return compareMoney(value, 0) > 0
    ? fromMinorUnits(minorUnits(value))
    : "0.00";
}

export function percent(value: string | number): string {
  return `${Number(value).toFixed(1)}%`;
}
