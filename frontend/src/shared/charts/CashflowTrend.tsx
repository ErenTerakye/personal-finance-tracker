import { type PointerEvent, useEffect, useRef, useState } from "react";
import { signedMoney } from "../format/money";
import { periodLabel, shortPeriodLabel } from "../format/periods";
import { useI18n } from "../i18n/I18nProvider";
import { EmptyState } from "../components/feedback";
import { ChartDataTable } from "./ChartDataTable";
import {
  ChartTooltip,
  handleTooltipBlur,
  handleTooltipKeyDown,
  trendTooltip,
  useChartTooltip,
} from "./ChartTooltip";
import {
  formatMetricValue,
  metrics,
  type TrendMonth,
  type VariableStyle,
} from "./geometry";

const MIN_VISIBLE_TREND_SIZE = 6;

export function CashflowTrend({ months }: { months: TrendMonth[] }) {
  const chartRef = useRef<HTMLElement>(null);
  const [motionReady, setMotionReady] = useState(false);
  const [active, setActive] = useChartTooltip(chartRef, [months]);
  const { t } = useI18n();

  useEffect(() => {
    let secondFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => setMotionReady(true));
    });
    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
    };
  }, []);

  function activateBar(
    node: HTMLElement,
    item: TrendMonth,
    metric: (typeof metrics)[number],
    tone: (typeof metrics)[number]["tone"] | "warning",
    translatedLabel: string,
    pinned = false,
  ) {
    const next = trendTooltip(
      node,
      item,
      metric,
      tone,
      translatedLabel,
      t,
      pinned,
    );
    setActive((current) =>
      current?.id === next.id && current.pinned === next.pinned
        ? current
        : next,
    );
  }

  function activateNearestBar(
    event: PointerEvent<HTMLDivElement>,
    item: TrendMonth,
    positive: boolean,
  ) {
    if (event.pointerType === "touch") {
      return;
    }

    const buttons = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>(".trend-bar"),
    );
    const nearestIndex = buttons.reduce(
      (nearest, button, index) => {
        const rect = button.getBoundingClientRect();
        const distance = Math.hypot(
          event.clientX - (rect.left + rect.width / 2),
          event.clientY - (rect.top + rect.height / 2),
        );
        return distance < nearest.distance ? { index, distance } : nearest;
      },
      { index: 0, distance: Number.POSITIVE_INFINITY },
    ).index;
    const metric = metrics[nearestIndex];
    const node = buttons[nearestIndex];
    if (!metric || !node) {
      return;
    }

    const tone =
      metric.key === "net_savings" && !positive ? "warning" : metric.tone;
    const labelKey =
      metric.key === "total_income"
        ? "income"
        : metric.key === "total_expenses"
          ? "expenses"
          : "net";

    activateBar(
      node.querySelector<HTMLElement>("span") ?? node,
      item,
      metric,
      tone,
      t(`charts.${labelKey}`),
    );
  }

  if (!months.length) {
    return (
      <EmptyState
        title={t("charts.emptyTrendTitle")}
        message={t("charts.emptyTrendMsg")}
      />
    );
  }

  const max = Math.max(
    1,
    ...months.flatMap((item) => [
      absoluteAmount(item.total_income),
      absoluteAmount(item.total_expenses),
      absoluteAmount(item.net_savings),
    ]),
  );

  return (
    <figure
      className={`cashflow-trend${motionReady ? " is-motion-ready" : ""}`}
      ref={chartRef}
      aria-label={t("charts.ariaTitle")}
    >
      <ol aria-label={t("charts.title")}>
        {months.map((item, monthIndex) => {
          const positive = Number(item.net_savings) >= 0;
          const formattedNet = signedMoney(item.net_savings);
          const formattedEntries = t("charts.tooltipEntries", {
            count: item.transaction_count,
          });

          return (
            <li
              key={monthIndex}
              className={positive ? "positive" : "negative"}
              style={
                {
                  "--income-size": trendSize(item.total_income, max),
                  "--expense-size": trendSize(item.total_expenses, max),
                  "--net-size": trendSize(item.net_savings, max),
                  "--income-scale": trendScale(item.total_income, max),
                  "--expense-scale": trendScale(item.total_expenses, max),
                  "--net-scale": trendScale(item.net_savings, max),
                } as VariableStyle
              }
            >
              <time
                dateTime={`${item.year}-${String(item.month).padStart(2, "0")}`}
              >
                {shortPeriodLabel(item.month, item.year)}
              </time>
              <div
                className="trend-bars"
                onPointerMove={(event) =>
                  activateNearestBar(event, item, positive)
                }
                onPointerLeave={(event) => {
                  if (event.pointerType !== "touch") {
                    setActive((current) => (current?.pinned ? current : null));
                  }
                }}
              >
                {metrics.map((metric) => {
                  const barId = `trend-${item.label}-${metric.key}`;
                  const isActive = active?.id === barId;
                  const tone =
                    metric.key === "net_savings" && !positive
                      ? "warning"
                      : metric.tone;
                  const labelKey =
                    metric.key === "total_income"
                      ? "income"
                      : metric.key === "total_expenses"
                        ? "expenses"
                        : "net";
                  const translatedLabel = t(`charts.${labelKey}`);

                  return (
                    <button
                      key={metric.key}
                      className={`trend-bar ${tone} ${isActive ? "active" : ""}`.trim()}
                      type="button"
                      aria-label={`${translatedLabel} for ${periodLabel(item.month, item.year)}: ${formatMetricValue(item, metric.key)}`}
                      onBlur={handleTooltipBlur(setActive)}
                      onFocus={(event) =>
                        activateBar(
                          event.currentTarget,
                          item,
                          metric,
                          tone,
                          translatedLabel,
                        )
                      }
                      onKeyDown={(event) =>
                        handleTooltipKeyDown(event, setActive)
                      }
                      onPointerDown={(event) => {
                        if (event.pointerType === "touch") {
                          activateBar(
                            event.currentTarget,
                            item,
                            metric,
                            tone,
                            translatedLabel,
                            true,
                          );
                        }
                      }}
                    >
                      <span aria-hidden="true" />
                    </button>
                  );
                })}
              </div>
              <strong>{formattedNet}</strong>
              <span>{formattedEntries}</span>
            </li>
          );
        })}
      </ol>
      <ChartTooltip active={active} />
      <ChartDataTable months={months} />
    </figure>
  );
}

function trendSize(value: string | number, max: number): string {
  return `${trendScale(value, max) * 100}%`;
}

function trendScale(value: string | number, max: number): number {
  const amount = absoluteAmount(value);
  if (amount === 0) {
    return 0;
  }
  return Math.max(MIN_VISIBLE_TREND_SIZE / 100, amount / max);
}

function absoluteAmount(value: string | number): number {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.abs(amount) : 0;
}
