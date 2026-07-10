import {
  CSSProperties,
  Dispatch,
  FocusEvent,
  KeyboardEvent,
  PointerEvent,
  RefObject,
  SetStateAction,
  useEffect,
  useId,
  useRef,
  useState
} from "react";
import { compactMoney, money, percent, periodLabel, shortPeriodLabel, signedMoney } from "../format";
import type { DashboardData } from "../types";
import { EmptyState } from "./ui";
import { useI18n } from "../i18n";

type TrendMonth = DashboardData["trend"]["months"][number];
type MetricKey = "total_income" | "total_expenses" | "net_savings";
type MetricTone = "cash" | "expenses" | "net" | "warning";
type TooltipData = {
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

type VariableStyle = CSSProperties & Record<`--${string}`, string | number>;

const MIN_VISIBLE_TREND_SIZE = 6;
const metrics: { key: MetricKey; tone: MetricTone }[] = [
  { key: "total_income", tone: "cash" },
  { key: "total_expenses", tone: "expenses" },
  { key: "net_savings", tone: "net" }
];

export function CashflowTrend({ months }: { months: TrendMonth[] }) {
  const chartRef = useRef<HTMLElement>(null);
  const [active, setActive] = useChartTooltip(chartRef, [months]);
  const { t } = useI18n();

  if (!months.length) {
    return <EmptyState title={t("charts.emptyTrendTitle")} message={t("charts.emptyTrendMsg")} />;
  }

  const max = Math.max(
    1,
    ...months.flatMap((item) => [
      absoluteAmount(item.total_income),
      absoluteAmount(item.total_expenses),
      absoluteAmount(item.net_savings)
    ])
  );

  return (
    <figure className="cashflow-trend" ref={chartRef}>
      <figcaption>
        <strong>{t("charts.title")}</strong>
        <span>{t("charts.desc")}</span>
      </figcaption>
      <ol aria-label={t("charts.title")}>
        {months.map((item) => {
          const positive = Number(item.net_savings) >= 0;
          const formattedNet = signedMoney(item.net_savings);
          const formattedEntries = t("charts.tooltipEntries", { count: item.transaction_count });

          return (
            <li
              key={item.label}
              className={positive ? "positive" : "negative"}
              style={
                {
                  "--income-size": trendSize(item.total_income, max),
                  "--expense-size": trendSize(item.total_expenses, max),
                  "--net-size": trendSize(item.net_savings, max)
                } as VariableStyle
              }
            >
              <time dateTime={`${item.year}-${String(item.month).padStart(2, "0")}`}>
                {shortPeriodLabel(item.month, item.year)}
              </time>
              <div className="trend-bars">
                {metrics.map((metric) => {
                  const tone =
                    metric.key === "net_savings" && !positive ? "warning" : metric.tone;
                  const labelKey = metric.key === "total_income" ? "income" : metric.key === "total_expenses" ? "expenses" : "net";
                  const translatedLabel = t(`charts.${labelKey}`);

                  return (
                    <button
                      key={metric.key}
                      className={`trend-bar ${tone}`}
                      type="button"
                      aria-label={`${translatedLabel} for ${periodLabel(item.month, item.year)}: ${formatMetricValue(item, metric.key)}`}
                      onBlur={handleTooltipBlur(setActive)}
                      onFocus={(event) =>
                        setActive(trendTooltip(event.currentTarget, item, metric, tone, translatedLabel, t))
                      }
                      onKeyDown={(event) => handleTooltipKeyDown(event, setActive)}
                      onPointerDown={(event) =>
                        setActive(trendTooltip(event.currentTarget, item, metric, tone, translatedLabel, t, event.pointerType === "touch"))
                      }
                      onPointerEnter={(event) => {
                        if (event.pointerType !== "touch") {
                          setActive(trendTooltip(event.currentTarget, item, metric, tone, translatedLabel, t));
                        }
                      }}
                      onPointerLeave={(event) => {
                        if (event.pointerType !== "touch") {
                          setActive((current) => (current?.pinned ? current : null));
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
    </figure>
  );
}

function trendSize(value: string | number, max: number): string {
  const amount = absoluteAmount(value);
  if (amount === 0) {
    return "0%";
  }
  return `${Math.max(MIN_VISIBLE_TREND_SIZE, (amount / max) * 100)}%`;
}

function absoluteAmount(value: string | number): number {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.abs(amount) : 0;
}

export function TrendLines({ months }: { months: TrendMonth[] }) {
  const titleId = useId();
  const descId = useId();
  const chartRef = useRef<HTMLElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [active, setActive] = useChartTooltip(chartRef, [months]);
  const { t } = useI18n();

  if (!months.length) {
    return <EmptyState title={t("charts.emptyLineTitle")} message={t("charts.emptyLineMsg")} />;
  }

  const values = months.flatMap((item) => [
    Number(item.total_income),
    Number(item.total_expenses),
    Number(item.net_savings)
  ]);
  const min = Math.min(0, ...values);
  const max = Math.max(1, ...values);
  const span = max - min || 1;
  const x = (index: number) => 56 + (index * 612) / Math.max(months.length - 1, 1);
  const y = (value: number) => 250 - ((value - min) / span) * 190;
  const points = (key: MetricKey) =>
    months.map((item, index) => `${x(index)},${y(Number(item[key]))}`).join(" ");

  function activateTrendPoint(item: TrendMonth, index: number, metric: (typeof metrics)[number], pinned = false) {
    const tone = metric.key === "net_savings" && Number(item.net_savings) < 0 ? "warning" : metric.tone;
    const labelKey = metric.key === "total_income" ? "income" : metric.key === "total_expenses" ? "expenses" : "net";
    const translatedLabel = t(`charts.${labelKey}`);
    const pctVal = percent(item.savings_rate);

    setActive(
      svgTooltip(chartRef, svgRef, x(index), y(Number(item[metric.key])), {
        id: `trend-${item.label}-${metric.key}`,
        title: periodLabel(item.month, item.year),
        label: translatedLabel,
        value: formatMetricValue(item, metric.key),
        detail: t("charts.tooltipSavingsRate", { rate: pctVal }),
        tone,
        guideX: x(index),
        pinned
      })
    );
  }

  function activateNearestPoint(event: PointerEvent<SVGSVGElement>, pinned = false) {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - rect.left) / Math.max(rect.width, 1);
    const viewBoxX = ratio * 720;
    const index = clamp(Math.round(((viewBoxX - 56) / 612) * Math.max(months.length - 1, 1)), 0, months.length - 1);
    const item = months[index];
    const nearestMetric = metrics.reduce((nearest, metric) => {
      const distance = Math.abs(y(Number(item[metric.key])) - pointerSvgY(event, rect));
      return distance < nearest.distance ? { metric, distance } : nearest;
    }, { metric: metrics[0], distance: Number.POSITIVE_INFINITY });

    activateTrendPoint(item, index, nearestMetric.metric, pinned);
  }

  return (
    <figure className="line-chart" ref={chartRef}>
      <svg
        ref={svgRef}
        role="group"
        aria-labelledby={`${titleId} ${descId}`}
        viewBox="0 0 720 300"
        preserveAspectRatio="xMidYMid meet"
        onPointerDown={(event) => activateNearestPoint(event, event.pointerType === "touch")}
        onPointerMove={(event) => {
          if (event.pointerType === "touch" && active?.pinned) {
            activateNearestPoint(event, true);
          }
        }}
      >
        <title id={titleId}>{t("charts.ariaTitle")}</title>
        <desc id={descId}>{t("charts.ariaDesc")}</desc>
        <line className="axis" x1="56" x2="680" y1="250" y2="250" />
        <line className="axis" x1="56" x2="56" y1="42" y2="250" />
        {typeof active?.guideX === "number" ? (
          <line className="chart-guide" x1={active.guideX} x2={active.guideX} y1="42" y2="250" />
        ) : null}
        <polyline className="chart-line cash-line" points={points("total_income")} />
        <polyline className="chart-line expenses-line" points={points("total_expenses")} />
        <polyline className="chart-line net-line" points={points("net_savings")} />
        {metrics.map((metric) =>
          months.map((item, index) => {
            const tone = metric.key === "net_savings" && Number(item.net_savings) < 0 ? "warning" : metric.tone;
            const pointId = `trend-${item.label}-${metric.key}`;
            const isActive = active?.id === pointId;
            const labelKey = metric.key === "total_income" ? "income" : metric.key === "total_expenses" ? "expenses" : "net";
            const translatedLabel = t(`charts.${labelKey}`);

            return (
              <circle
                key={pointId}
                className={`chart-point ${tone} ${isActive ? "active" : ""}`.trim()}
                cx={x(index)}
                cy={y(Number(item[metric.key]))}
                r="5"
                tabIndex={0}
                role="button"
                aria-label={`${translatedLabel} for ${periodLabel(item.month, item.year)}: ${formatMetricValue(item, metric.key)}`}
                onBlur={handleTooltipBlur(setActive)}
                onFocus={() => activateTrendPoint(item, index, metric)}
                onKeyDown={(event) => handleTooltipKeyDown(event, setActive)}
                onPointerEnter={(event) => {
                  if (event.pointerType !== "touch") {
                    activateTrendPoint(item, index, metric);
                  }
                }}
                onPointerDown={(event) => {
                  if (event.pointerType === "touch") {
                    event.stopPropagation();
                    activateTrendPoint(item, index, metric, true);
                  }
                }}
                onPointerLeave={(event) => {
                  if (event.pointerType !== "touch") {
                    setActive((current) => (current?.pinned ? current : null));
                  }
                }}
              />
            );
          })
        )}
        {months.map((item, index) => (
          <g key={item.label}>
            <text x={x(index)} y="282" textAnchor="middle">
              {item.label.slice(5)}
            </text>
          </g>
        ))}
      </svg>
      <figcaption>
        <span className="legend cash">{t("charts.income")}</span>
        <span className="legend expenses">{t("charts.expenses")}</span>
        <span className="legend net">{t("charts.net")}</span>
      </figcaption>
      <ChartTooltip active={active} />
    </figure>
  );
}

export function CategoryBars({
  title,
  items
}: {
  title: string;
  items: { label: string; value: string }[];
}) {
  const { t } = useI18n();

  if (!items.length) {
    return <EmptyState title={t("charts.emptyTrendTitle")} message={t("charts.emptyTrendMsg")} />;
  }

  const max = Math.max(1, ...items.map((item) => Math.abs(Number(item.value))));
  return (
    <div className="category-bars" aria-label={title}>
      {items.map((item) => (
        <div
          className="category-bar"
          key={item.label}
          style={{ "--bar-size": `${(Math.abs(Number(item.value)) / max) * 100}%` } as VariableStyle}
        >
          <span>{item.label}</span>
          <div aria-hidden="true">

            <span />
          </div>
          <strong>{money(item.value)}</strong>
        </div>
      ))}
    </div>
  );
}

export function KpiCard({
  label,
  value,
  detail,
  tone = "neutral",
  featured = false
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: "cash" | "expenses" | "warning" | "neutral";
  featured?: boolean;
}) {
  return (
    <article className={`kpi-card ${tone} ${featured ? "featured" : ""}`.trim()}>
      <span>{label}</span>
      <strong>{value}</strong>
      {detail ? <em>{detail}</em> : null}
    </article>
  );
}

export function compactValue(value: string | number): string {
  return compactMoney(value);
}

function useChartTooltip(
  chartRef: RefObject<HTMLElement | null>,
  dependencies: unknown[]
): [TooltipData | null, Dispatch<SetStateAction<TooltipData | null>>] {
  const [active, setActive] = useState<TooltipData | null>(null);

  useEffect(() => {
    setActive(null);
  }, dependencies);

  useEffect(() => {
    if (!active?.pinned) {
      return;
    }

    function closeFromOutside(event: globalThis.PointerEvent) {
      if (!chartRef.current?.contains(event.target as Node)) {
        setActive(null);
      }
    }

    function closeOnScroll() {
      setActive(null);
    }

    document.addEventListener("pointerdown", closeFromOutside, { capture: true });
    window.addEventListener("scroll", closeOnScroll, { capture: true, passive: true });
    return () => {
      document.removeEventListener("pointerdown", closeFromOutside, { capture: true });
      window.removeEventListener("scroll", closeOnScroll, { capture: true });
    };
  }, [active?.pinned, chartRef]);

  return [active, setActive];
}

function ChartTooltip({ active }: { active: TooltipData | null }) {
  if (!active) {
    return null;
  }

  return (
    <output
      className={`chart-tooltip ${active.tone}`}
      style={{ "--tooltip-x": `${active.x}px`, "--tooltip-y": `${active.y}px` } as VariableStyle}
    >
      <span>{active.title}</span>
      <strong>{active.value}</strong>
      <em>{active.label}</em>
      <small>{active.detail}</small>
    </output>
  );
}

function trendTooltip(
  node: HTMLElement,
  item: TrendMonth,
  metric: (typeof metrics)[number],
  tone: MetricTone,
  label: string,
  t: (key: string, variables?: Record<string, string | number>) => string,
  pinned = false
): TooltipData {
  const nodeRect = node.getBoundingClientRect();
  const chartRect = node.closest(".cashflow-trend")?.getBoundingClientRect();
  const x = chartRect ? nodeRect.left + nodeRect.width / 2 - chartRect.left : nodeRect.width / 2;
  const y = chartRect ? nodeRect.top - chartRect.top : 0;

  return {
    id: `trend-${item.label}-${metric.key}`,
    title: periodLabel(item.month, item.year),
    label,
    value: formatMetricValue(item, metric.key),
    detail: t("charts.tooltipEntries", { count: item.transaction_count }),
    tone,
    x,
    y,
    pinned
  };
}

function svgTooltip(
  chartRef: RefObject<HTMLElement | null>,
  svgRef: RefObject<SVGSVGElement | null>,
  svgX: number,
  svgY: number,
  data: Omit<TooltipData, "x" | "y">
): TooltipData {
  const chartRect = chartRef.current?.getBoundingClientRect();
  const svgRect = svgRef.current?.getBoundingClientRect();
  if (!chartRect || !svgRect) {
    return { ...data, x: svgX, y: svgY };
  }

  return {
    ...data,
    x: svgRect.left + (svgX / 720) * svgRect.width - chartRect.left,
    y: svgRect.top + (svgY / 300) * svgRect.height - chartRect.top
  };
}

function handleTooltipBlur(
  setActive: Dispatch<SetStateAction<TooltipData | null>>
) {
  return (event: FocusEvent<HTMLElement | SVGCircleElement>) => {
    if (!event.currentTarget.parentElement?.contains(event.relatedTarget as Node | null)) {
      setActive((current) => (current?.pinned ? current : null));
    }
  };
}

function handleTooltipKeyDown(
  event: KeyboardEvent<HTMLElement | SVGCircleElement>,
  setActive: Dispatch<SetStateAction<TooltipData | null>>
) {
  if (event.key === "Escape") {
    setActive(null);
    event.currentTarget.blur();
  }
}

function formatMetricValue(item: TrendMonth, key: MetricKey): string {
  if (key === "net_savings") {
    return signedMoney(item[key]);
  }
  return money(item[key]);
}

function pointerSvgY(event: PointerEvent<SVGSVGElement>, rect: DOMRect): number {
  return ((event.clientY - rect.top) / Math.max(rect.height, 1)) * 300;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
