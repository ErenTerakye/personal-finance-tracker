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
}: {
  title: string;
  items: { label: string; value: string }[];
}) {
  const { t } = useI18n();
  const chartId = useId();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
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
      <div className="expense-mix-visual">
        <svg
          className="expense-mix-chart"
          viewBox="0 0 120 120"
          role="group"
          aria-labelledby={`${chartId}-title ${chartId}-description`}
          onPointerLeave={() => setActiveIndex(null)}
        >
          <title id={`${chartId}-title`}>{title}</title>
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
        <ul className="expense-mix-legend">
          {slices.map((slice, index) => (
            <li
              key={slice.label}
              style={{ "--slice-index": index } as VariableStyle}
            >
              <span className="expense-mix-key" aria-hidden="true" />
              <span>{slice.label}</span>
              <strong>{money(slice.value)}</strong>
              <small>{slice.share.toFixed(1)}%</small>
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
