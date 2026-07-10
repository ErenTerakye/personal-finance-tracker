import type { CSSProperties, PointerEvent } from "react";
import { money, signedMoney } from "../format/money";
import type { DashboardData } from "../../types";

export type TrendMonth = DashboardData["trend"]["months"][number];
export type MetricKey = "total_income" | "total_expenses" | "net_savings";
export type MetricTone = "cash" | "expenses" | "net" | "warning";
export type TooltipData = {
  id: string;
  title: string;
  label: string;
  value: string;
  detail: string;
  tone: MetricTone;
  x: number;
  y: number;
  guideX?: number;
  pinned?: boolean;
};
export type VariableStyle = CSSProperties &
  Record<`--${string}`, string | number>;

export const metrics: { key: MetricKey; tone: MetricTone }[] = [
  { key: "total_income", tone: "cash" },
  { key: "total_expenses", tone: "expenses" },
  { key: "net_savings", tone: "net" },
];

export function formatMetricValue(item: TrendMonth, key: MetricKey): string {
  return key === "net_savings" ? signedMoney(item[key]) : money(item[key]);
}

export function pointerSvgY(
  event: PointerEvent<SVGSVGElement>,
  rect: DOMRect,
): number {
  return ((event.clientY - rect.top) / Math.max(rect.height, 1)) * 300;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
