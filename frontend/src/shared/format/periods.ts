import { getFormatterLocale } from "./dates";

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

export const monthNames: string[] = new Proxy(monthNamesEn, {
  get(_target, property, receiver) {
    const names = getFormatterLocale().startsWith("tr")
      ? monthNamesTr
      : monthNamesEn;
    return Reflect.get(names, property, receiver);
  },
});
