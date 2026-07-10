import { type PointerEvent, useId, useRef } from "react";
import { percent } from "../format/money";
import { periodLabel } from "../format/periods";
import { useI18n } from "../i18n/I18nProvider";
import { EmptyState } from "../components/feedback";
import { ChartDataTable } from "./ChartDataTable";
import {
  ChartTooltip,
  handleTooltipBlur,
  handleTooltipKeyDown,
  svgTooltip,
  useChartTooltip,
} from "./ChartTooltip";
import {
  clamp,
  formatMetricValue,
  metrics,
  pointerSvgY,
  type MetricKey,
  type TrendMonth,
} from "./geometry";

export function TrendLines({ months }: { months: TrendMonth[] }) {
  const titleId = useId();
  const descId = useId();
  const chartRef = useRef<HTMLElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [active, setActive] = useChartTooltip(chartRef, [months]);
  const { t } = useI18n();

  if (!months.length) {
    return (
      <EmptyState
        title={t("charts.emptyLineTitle")}
        message={t("charts.emptyLineMsg")}
      />
    );
  }

  const values = months.flatMap((item) => [
    Number(item.total_income),
    Number(item.total_expenses),
    Number(item.net_savings),
  ]);
  const min = Math.min(0, ...values);
  const max = Math.max(1, ...values);
  const span = max - min || 1;
  const x = (index: number) =>
    56 + (index * 612) / Math.max(months.length - 1, 1);
  const y = (value: number) => 250 - ((value - min) / span) * 190;
  const points = (key: MetricKey) =>
    months
      .map((item, index) => `${x(index)},${y(Number(item[key]))}`)
      .join(" ");

  function activateTrendPoint(
    item: TrendMonth,
    index: number,
    metric: (typeof metrics)[number],
    pinned = false,
  ) {
    const tone =
      metric.key === "net_savings" && Number(item.net_savings) < 0
        ? "warning"
        : metric.tone;
    const labelKey =
      metric.key === "total_income"
        ? "income"
        : metric.key === "total_expenses"
          ? "expenses"
          : "net";
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
        pinned,
      }),
    );
  }

  function activateNearestPoint(
    event: PointerEvent<SVGSVGElement>,
    pinned = false,
  ) {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - rect.left) / Math.max(rect.width, 1);
    const viewBoxX = ratio * 720;
    const index = clamp(
      Math.round(((viewBoxX - 56) / 612) * Math.max(months.length - 1, 1)),
      0,
      months.length - 1,
    );
    const item = months[index];
    const nearestMetric = metrics.reduce(
      (nearest, metric) => {
        const distance = Math.abs(
          y(Number(item[metric.key])) - pointerSvgY(event, rect),
        );
        return distance < nearest.distance ? { metric, distance } : nearest;
      },
      { metric: metrics[0], distance: Number.POSITIVE_INFINITY },
    );

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
        onPointerDown={(event) =>
          activateNearestPoint(event, event.pointerType === "touch")
        }
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
          <line
            className="chart-guide"
            x1={active.guideX}
            x2={active.guideX}
            y1="42"
            y2="250"
          />
        ) : null}
        <polyline
          className="chart-line cash-line"
          points={points("total_income")}
        />
        <polyline
          className="chart-line expenses-line"
          points={points("total_expenses")}
        />
        <polyline
          className="chart-line net-line"
          points={points("net_savings")}
        />
        {metrics.map((metric) =>
          months.map((item, index) => {
            const tone =
              metric.key === "net_savings" && Number(item.net_savings) < 0
                ? "warning"
                : metric.tone;
            const pointId = `trend-${item.label}-${metric.key}`;
            const isActive = active?.id === pointId;
            const labelKey =
              metric.key === "total_income"
                ? "income"
                : metric.key === "total_expenses"
                  ? "expenses"
                  : "net";
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
                aria-pressed={isActive && Boolean(active?.pinned)}
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
          }),
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
      <ChartDataTable months={months} />
    </figure>
  );
}
