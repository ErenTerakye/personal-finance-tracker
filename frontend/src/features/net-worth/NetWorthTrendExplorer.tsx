import {
  type CSSProperties,
  type PointerEvent,
  type RefObject,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { formatDate } from "../../shared/format/dates";
import { money, signedMoney } from "../../shared/format/money";
import { useI18n } from "../../shared/i18n/I18nProvider";
import type { NetWorthHistory } from "../../types";

export function TrendExplorer({ history }: { history: NetWorthHistory }) {
  const { t } = useI18n();
  const [selected, setSelected] = useState(
    Math.max(0, history.points.length - 1),
  );
  const [tooltip, setTooltip] = useState<{
    index: number;
    x: number;
    y: number;
    pinned: boolean;
  } | null>(null);
  const figureRef = useRef<HTMLElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const pointRefs = useRef<(SVGCircleElement | null)[]>([]);

  useEffect(() => {
    // New history data resets keyboard selection and any stale chart tooltip together.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelected(Math.max(0, history.points.length - 1));
    setTooltip(null);
  }, [history]);

  useEffect(() => {
    if (!tooltip?.pinned) return;

    function dismissPinnedTooltip(event: globalThis.PointerEvent) {
      if (!figureRef.current?.contains(event.target as Node)) {
        setTooltip(null);
      }
    }

    document.addEventListener("pointerdown", dismissPinnedTooltip, {
      capture: true,
    });
    return () => {
      document.removeEventListener("pointerdown", dismissPinnedTooltip, {
        capture: true,
      });
    };
  }, [tooltip?.pinned]);

  const chart = useMemo(() => buildChart(history), [history]);
  const selectedPoint = history.points[selected];

  if (!selectedPoint) {
    return (
      <section
        className="wealth-trend-card"
        aria-labelledby="wealth-trend-title"
      >
        <h2 id="wealth-trend-title">{t("netWorth.history.title")}</h2>
        <p className="wealth-muted">{t("netWorth.history.noComparison")}</p>
      </section>
    );
  }

  function selectPoint(index: number, moveFocus = false) {
    const next = Math.max(0, Math.min(history.points.length - 1, index));
    setSelected(next);
    if (moveFocus) {
      pointRefs.current[next]?.focus();
      showTooltipAtPoint(next);
    }
  }

  function showTooltipAtPoint(index: number, pinned = false) {
    const point = chart.points[index];
    const figureRect = figureRef.current?.getBoundingClientRect();
    const rendered = renderedChartPoint(svgRef, chart, point.x, point.y);
    if (!figureRect || !rendered) return;
    setTooltip({
      index,
      x: rendered.x - figureRect.left,
      y: rendered.y - figureRect.top,
      pinned,
    });
  }

  function selectNearestPoint(
    event: PointerEvent<SVGSVGElement>,
    pinned = false,
  ) {
    const svgRect = event.currentTarget.getBoundingClientRect();
    if (!svgRect.width || !svgRect.height) return;

    const scale = Math.min(
      svgRect.width / chart.width,
      svgRect.height / chart.height,
    );
    const offsetX = (svgRect.width - chart.width * scale) / 2;
    const viewBoxX = (event.clientX - svgRect.left - offsetX) / scale;
    const ratio =
      (viewBoxX - chart.plotLeft) / (chart.plotRight - chart.plotLeft);
    const index = Math.max(
      0,
      Math.min(
        history.points.length - 1,
        Math.round(ratio * Math.max(history.points.length - 1, 1)),
      ),
    );
    if (tooltip?.index === index && tooltip.pinned === pinned) return;
    setSelected((current) => (current === index ? current : index));
    showTooltipAtPoint(index, pinned);
  }

  return (
    <section className="wealth-trend-card" aria-labelledby="wealth-trend-title">
      <header className="wealth-card-heading">
        <div>
          <p className="eyebrow">{t("netWorth.history.eyebrow")}</p>
          <h2 id="wealth-trend-title">{t("netWorth.history.title")}</h2>
        </div>
        <div className="trend-selection">
          <span>{formatDate(selectedPoint.as_of)}</span>
          <strong>{signedMoney(selectedPoint.total_net_worth)}</strong>
        </div>
      </header>
      <figure className="wealth-chart" ref={figureRef}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${chart.width} ${chart.height}`}
          role="img"
          aria-labelledby="net-worth-chart-title net-worth-chart-desc"
          onPointerMove={(event) => {
            if (event.pointerType !== "touch" || tooltip?.pinned) {
              selectNearestPoint(event, Boolean(tooltip?.pinned));
            }
          }}
          onPointerDown={(event) =>
            selectNearestPoint(event, event.pointerType === "touch")
          }
          onPointerLeave={() => {
            if (!tooltip?.pinned) setTooltip(null);
          }}
        >
          <title id="net-worth-chart-title">
            {t("netWorth.history.chartTitle")}
          </title>
          <desc id="net-worth-chart-desc">
            {t("netWorth.history.chartDesc")}
          </desc>
          <defs>
            <linearGradient id="net-worth-area" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.2" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>
          {chart.yTicks.map((tick) => (
            <g className="chart-grid-line" key={tick.value}>
              <line
                x1={chart.plotLeft}
                x2={chart.plotRight}
                y1={tick.y}
                y2={tick.y}
              />
              <text x={chart.plotLeft - 12} y={tick.y + 4}>
                {formatAxisValue(tick.value, chart.tickStep)}
              </text>
            </g>
          ))}
          {chart.zeroY !== null ? (
            <line
              className="net-worth-zero-line"
              x1={chart.plotLeft}
              x2={chart.plotRight}
              y1={chart.zeroY}
              y2={chart.zeroY}
            />
          ) : null}
          <path className="net-worth-area" d={chart.areaPath} />
          <path className="net-worth-line" d={chart.linePath} pathLength="1" />
          <line
            className="chart-selection-line"
            x1={chart.points[selected].x}
            x2={chart.points[selected].x}
            y1={chart.plotTop}
            y2={chart.plotBottom}
          />
          {chart.points.map((point, index) => (
            <circle
              key={point.data.as_of}
              ref={(node) => {
                pointRefs.current[index] = node;
              }}
              className={selected === index ? "is-selected" : ""}
              cx={point.x}
              cy={point.y}
              r={selected === index ? 7 : 4.5}
              tabIndex={selected === index ? 0 : -1}
              role="button"
              aria-pressed={selected === index}
              aria-label={t("netWorth.history.pointLabel", {
                date: formatDate(point.data.as_of),
                amount: money(point.data.total_net_worth),
              })}
              style={
                {
                  "--point-delay": `${Math.min(index, 12) * 24}ms`,
                } as CSSProperties
              }
              onBlur={() =>
                setTooltip((current) => (current?.pinned ? current : null))
              }
              onFocus={() => {
                setSelected(index);
                showTooltipAtPoint(index);
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowLeft") {
                  event.preventDefault();
                  selectPoint(index - 1, true);
                }
                if (event.key === "ArrowRight") {
                  event.preventDefault();
                  selectPoint(index + 1, true);
                }
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  selectPoint(index);
                  showTooltipAtPoint(index, true);
                }
                if (event.key === "Escape") {
                  setTooltip(null);
                  event.currentTarget.blur();
                }
              }}
            />
          ))}
          {chart.xLabels.map((label) => (
            <text
              className="chart-date-label"
              key={`${label.text}-${label.x}`}
              x={label.x}
              y={chart.height - 10}
              textAnchor={label.anchor}
            >
              {label.text}
            </text>
          ))}
        </svg>
        <figcaption className="sr-only">
          {t("netWorth.history.selected", {
            date: formatDate(selectedPoint.as_of),
            amount: money(selectedPoint.total_net_worth),
          })}
        </figcaption>
        <output
          className="wealth-chart-tooltip"
          hidden={!tooltip}
          aria-hidden="true"
          style={
            {
              "--tooltip-x": `${tooltip?.x ?? 0}px`,
              "--tooltip-y": `${tooltip?.y ?? 0}px`,
            } as CSSProperties
          }
        >
          <span>{formatDate(selectedPoint.as_of)}</span>
          <strong>{signedMoney(selectedPoint.total_net_worth)}</strong>
          <dl>
            <div>
              <dt>{t("netWorth.assets")}</dt>
              <dd>{money(selectedPoint.total_assets)}</dd>
            </div>
            <div>
              <dt>{t("netWorth.liabilities")}</dt>
              <dd>{money(selectedPoint.total_liabilities)}</dd>
            </div>
          </dl>
        </output>
      </figure>
      <details className="wealth-chart-table">
        <summary>{t("netWorth.history.tableToggle")}</summary>
        <div className="table-scroll">
          <table>
            <caption>{t("netWorth.history.tableCaption")}</caption>
            <thead>
              <tr>
                <th scope="col">{t("common.date")}</th>
                <th scope="col">{t("netWorth.assets")}</th>
                <th scope="col">{t("netWorth.liabilities")}</th>
                <th scope="col">{t("netWorth.total")}</th>
              </tr>
            </thead>
            <tbody>
              {history.points.map((point) => (
                <tr key={point.as_of}>
                  <th scope="row">{formatDate(point.as_of)}</th>
                  <td>{money(point.total_assets)}</td>
                  <td>{money(point.total_liabilities)}</td>
                  <td>{signedMoney(point.total_net_worth)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}

function buildChart(history: NetWorthHistory) {
  const width = 820;
  const height = 350;
  const plotLeft = 76;
  const plotRight = width - 24;
  const plotTop = 22;
  const plotBottom = height - 42;
  const rawValues = history.points.map((point) =>
    Number(point.total_net_worth),
  );
  const scaleValues = rawValues.length ? rawValues : [0];
  const rawMin = Math.min(...scaleValues);
  const rawMax = Math.max(...scaleValues);
  const scaleMin = Math.min(0, rawMin);
  const scaleMax = Math.max(0, rawMax);
  const scaleSpan = scaleMax - scaleMin || 1;
  const tickStep = niceStep(scaleSpan / 4);
  const min = Math.floor(scaleMin / tickStep) * tickStep;
  let max = Math.ceil(scaleMax / tickStep) * tickStep;
  if (min === max) max = tickStep;
  const span = max - min;
  const x = (index: number) =>
    history.points.length === 1
      ? (plotLeft + plotRight) / 2
      : plotLeft +
        (index / (history.points.length - 1)) * (plotRight - plotLeft);
  const y = (value: number) =>
    plotTop + ((max - value) / span) * (plotBottom - plotTop);
  const points = history.points.map((data, index) => ({
    data,
    x: x(index),
    y: y(Number(data.total_net_worth)),
  }));
  const linePath = points
    .map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`)
    .join(" ");
  const areaPath = points.length
    ? `${linePath} L ${points.at(-1)?.x ?? plotRight} ${y(0)} L ${
        points[0].x
      } ${y(0)} Z`
    : "";
  const yTicks = Array.from(
    { length: Math.round(span / tickStep) + 1 },
    (_, index) => {
      const value = Number((max - tickStep * index).toPrecision(12));
      return { value, y: y(value) };
    },
  );
  const labelIndexes = Array.from(
    new Set([
      0,
      Math.floor((history.points.length - 1) / 2),
      history.points.length - 1,
    ]),
  ).filter((index) => index >= 0);
  const xLabels = labelIndexes.map((index) => ({
    text: formatShortDate(history.points[index].as_of),
    x: x(index),
    anchor:
      index === 0
        ? ("start" as const)
        : index === history.points.length - 1
          ? ("end" as const)
          : ("middle" as const),
  }));

  return {
    width,
    height,
    plotLeft,
    plotRight,
    plotTop,
    plotBottom,
    points,
    linePath,
    areaPath,
    yTicks,
    tickStep,
    xLabels,
    zeroY: y(0),
  };
}

function niceStep(value: number) {
  const magnitude = 10 ** Math.floor(Math.log10(Math.max(value, 1e-9)));
  const normalized = value / magnitude;
  const factor =
    normalized <= 1
      ? 1
      : normalized <= 2
        ? 2
        : normalized <= 2.5
          ? 2.5
          : normalized <= 5
            ? 5
            : 10;
  return factor * magnitude;
}

function formatAxisValue(value: number, step: number) {
  const fractionDigits = step >= 1 ? 0 : Math.ceil(-Math.log10(step));
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

function renderedChartPoint(
  svgRef: RefObject<SVGSVGElement | null>,
  chart: ReturnType<typeof buildChart>,
  x: number,
  y: number,
) {
  const rect = svgRef.current?.getBoundingClientRect();
  if (!rect?.width || !rect.height) return null;
  const scale = Math.min(rect.width / chart.width, rect.height / chart.height);
  return {
    x: rect.left + (rect.width - chart.width * scale) / 2 + x * scale,
    y: rect.top + (rect.height - chart.height * scale) / 2 + y * scale,
  };
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}
