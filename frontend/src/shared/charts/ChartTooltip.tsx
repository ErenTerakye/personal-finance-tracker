import {
  type Dispatch,
  type FocusEvent,
  type KeyboardEvent,
  type RefObject,
  type SetStateAction,
  useEffect,
  useState,
} from "react";
import { periodLabel } from "../format/periods";
import {
  formatMetricValue,
  metrics,
  type MetricTone,
  type TooltipData,
  type TrendMonth,
  type VariableStyle,
} from "./geometry";

export function useChartTooltip(
  chartRef: RefObject<HTMLElement | null>,
  dependencies: unknown[],
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

    document.addEventListener("pointerdown", closeFromOutside, {
      capture: true,
    });
    window.addEventListener("scroll", closeOnScroll, {
      capture: true,
      passive: true,
    });
    return () => {
      document.removeEventListener("pointerdown", closeFromOutside, {
        capture: true,
      });
      window.removeEventListener("scroll", closeOnScroll, { capture: true });
    };
  }, [active?.pinned, chartRef]);

  return [active, setActive];
}

export function ChartTooltip({ active }: { active: TooltipData | null }) {
  if (!active) {
    return null;
  }

  return (
    <output
      className={`chart-tooltip ${active.tone}`}
      style={
        {
          "--tooltip-x": `${active.x}px`,
          "--tooltip-y": `${active.y}px`,
        } as VariableStyle
      }
    >
      <span>{active.title}</span>
      <strong>{active.value}</strong>
      <em>{active.label}</em>
      <small>{active.detail}</small>
    </output>
  );
}

export function trendTooltip(
  node: HTMLElement,
  item: TrendMonth,
  metric: (typeof metrics)[number],
  tone: MetricTone,
  label: string,
  t: (key: string, variables?: Record<string, string | number>) => string,
  pinned = false,
): TooltipData {
  const nodeRect = node.getBoundingClientRect();
  const chartRect = node.closest(".cashflow-trend")?.getBoundingClientRect();
  const x = chartRect
    ? nodeRect.left + nodeRect.width / 2 - chartRect.left
    : nodeRect.width / 2;
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
    pinned,
  };
}

export function svgTooltip(
  chartRef: RefObject<HTMLElement | null>,
  svgRef: RefObject<SVGSVGElement | null>,
  svgX: number,
  svgY: number,
  data: Omit<TooltipData, "x" | "y">,
): TooltipData {
  const chartRect = chartRef.current?.getBoundingClientRect();
  const svgRect = svgRef.current?.getBoundingClientRect();
  if (!chartRect || !svgRect) {
    return { ...data, x: svgX, y: svgY };
  }

  return {
    ...data,
    x: svgRect.left + (svgX / 720) * svgRect.width - chartRect.left,
    y: svgRect.top + (svgY / 300) * svgRect.height - chartRect.top,
  };
}

export function handleTooltipBlur(
  setActive: Dispatch<SetStateAction<TooltipData | null>>,
) {
  return (event: FocusEvent<HTMLElement | SVGCircleElement>) => {
    if (
      !event.currentTarget.parentElement?.contains(
        event.relatedTarget as Node | null,
      )
    ) {
      setActive((current) => (current?.pinned ? current : null));
    }
  };
}

export function handleTooltipKeyDown(
  event: KeyboardEvent<HTMLElement | SVGCircleElement>,
  setActive: Dispatch<SetStateAction<TooltipData | null>>,
) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    setActive((current) => (current ? { ...current, pinned: true } : current));
    return;
  }
  if (event.key === "Escape") {
    setActive(null);
    event.currentTarget.blur();
  }
}
