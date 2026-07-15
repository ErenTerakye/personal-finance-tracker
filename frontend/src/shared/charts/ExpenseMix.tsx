import { useId, useState } from "react";
import { money } from "../format/money";
import { useI18n } from "../i18n/I18nProvider";
import { EmptyState } from "../components/feedback";
import type { VariableStyle } from "./geometry";

const MAX_VISIBLE_CATEGORIES = 5;

type ExpenseSlice = {
  label: string;
  value: number;
  share: number;
  offset: number;
};

export function ExpenseMix({
  title,
  items,
  onClickCategory,
}: {
  title: string;
  items: { label: string; value: string }[];
  onClickCategory?: (category: string) => void;
}) {
  const { t } = useI18n();
  const chartId = useId();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [activeLegendIndex, setActiveLegendIndex] = useState<number | null>(
    null,
  );
  const positiveItems = items
    .map((item) => ({ label: item.label, value: Math.abs(Number(item.value)) }))
    .filter((item) => Number.isFinite(item.value) && item.value > 0)
    .sort((a, b) => b.value - a.value);

  if (!positiveItems.length) {
    return (
      <EmptyState
        title={t("charts.emptyMixTitle")}
        message={t("charts.emptyMixMsg")}
      />
    );
  }

  const largest = positiveItems.slice(0, MAX_VISIBLE_CATEGORIES);
  const remaining = positiveItems.slice(MAX_VISIBLE_CATEGORIES);
  const visible = remaining.length
    ? [
        ...largest,
        {
          label: t("charts.otherCategories"),
          value: remaining.reduce((sum, item) => sum + item.value, 0),
        },
      ]
    : largest;

  const total = visible.reduce((sum, item) => sum + item.value, 0);
  const slices = visible.reduce<ExpenseSlice[]>((result, item) => {
    const share = (item.value / total) * 100;
    const previous = result.at(-1);
    const offset = previous ? previous.offset + previous.share : 0;
    return [...result, { ...item, share, offset }];
  }, []);
  const activeSlice = activeIndex === null ? null : slices[activeIndex];

  return (
    <figure className="expense-mix" aria-labelledby={`${chartId}-caption`}>
      <span id={`${chartId}-title`} className="sr-only">
        {title}
      </span>
      <div className="expense-mix-visual">
        <svg
          className="expense-mix-chart"
          viewBox="0 0 120 120"
          role="group"
          focusable="false"
          aria-labelledby={`${chartId}-title ${chartId}-description`}
          onPointerLeave={() => setActiveIndex(null)}
        >
          <desc id={`${chartId}-description`}>
            {t("charts.mixDescription", { count: slices.length })}
          </desc>
          <circle className="expense-mix-track" cx="60" cy="60" r="42" />
          {slices.map((slice, index) => (
            <circle
              className="expense-mix-slice"
              cx="60"
              cy="60"
              r="42"
              pathLength="100"
              key={slice.label}
              role="button"
              tabIndex={0}
              aria-label={t("charts.mixSliceLabel", {
                category: slice.label,
                amount: money(slice.value),
                share: slice.share.toFixed(1),
              })}
              data-active={activeIndex === index ? "true" : undefined}
              onPointerEnter={() => setActiveIndex(index)}
              onFocus={() => setActiveIndex(index)}
              onBlur={() => setActiveIndex(null)}
              onClick={(e) => {
                e.currentTarget.blur();
                onClickCategory?.(slice.label);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onClickCategory?.(slice.label);
                }
              }}
              style={
                {
                  "--slice-size": slice.share,
                  "--slice-offset": -slice.offset,
                  "--slice-index": index,
                } as VariableStyle
              }
            />
          ))}
        </svg>
        <div className="expense-mix-total" aria-hidden="true">
          <span>{activeSlice?.label ?? t("charts.total")}</span>
          <strong>{money(activeSlice?.value ?? total)}</strong>
          {activeSlice ? <small>{activeSlice.share.toFixed(1)}%</small> : null}
        </div>
      </div>

      <figcaption id={`${chartId}-caption`}>
        <ul
          className="expense-mix-legend"
          onPointerMove={(event) => {
            if (event.pointerType === "touch") {
              return;
            }

            const buttons = Array.from(
              event.currentTarget.querySelectorAll<HTMLButtonElement>(
                ".expense-mix-legend-btn",
              ),
            );
            const nearestIndex = buttons.reduce(
              (nearest, button, index) => {
                const rect = button.getBoundingClientRect();
                const distance = Math.abs(
                  event.clientY - (rect.top + rect.height / 2),
                );
                return distance < nearest.distance
                  ? { index, distance }
                  : nearest;
              },
              { index: 0, distance: Number.POSITIVE_INFINITY },
            ).index;

            setActiveIndex((current) =>
              current === nearestIndex ? current : nearestIndex,
            );
            setActiveLegendIndex((current) =>
              current === nearestIndex ? current : nearestIndex,
            );
          }}
          onPointerLeave={() => {
            setActiveIndex(null);
            setActiveLegendIndex(null);
          }}
        >
          {slices.map((slice, index) => (
            <li
              key={slice.label}
              style={{ "--slice-index": index } as VariableStyle}
            >
              <button
                type="button"
                className="expense-mix-legend-btn"
                data-active={activeLegendIndex === index ? "true" : undefined}
                onClick={() => onClickCategory?.(slice.label)}
                onPointerEnter={() => {
                  setActiveIndex(index);
                  setActiveLegendIndex(index);
                }}
                onFocus={() => setActiveIndex(index)}
                onBlur={() => setActiveIndex(null)}
              >
                <span className="expense-mix-key" aria-hidden="true" />
                <span>{slice.label}</span>
                <strong>{money(slice.value)}</strong>
                <small>{slice.share.toFixed(1)}%</small>
              </button>
            </li>
          ))}
        </ul>
      </figcaption>

      <details className="chart-data expense-mix-data">
        <summary>{t("charts.dataTable")}</summary>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">{t("common.category")}</th>
                <th scope="col">{t("common.amount")}</th>
                <th scope="col">{t("charts.share")}</th>
              </tr>
            </thead>
            <tbody>
              {slices.map((slice) => (
                <tr key={slice.label}>
                  <th scope="row">{slice.label}</th>
                  <td>{money(slice.value)}</td>
                  <td>{slice.share.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
