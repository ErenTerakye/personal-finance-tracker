import { money } from "../format/money";
import { useI18n } from "../i18n/I18nProvider";
import { EmptyState } from "../components/feedback";
import type { VariableStyle } from "./geometry";

export function CategoryBars({
  title,
  items,
}: {
  title: string;
  items: { label: string; value: string }[];
}) {
  const { t } = useI18n();

  if (!items.length) {
    return (
      <EmptyState
        title={t("charts.emptyTrendTitle")}
        message={t("charts.emptyTrendMsg")}
      />
    );
  }

  const max = Math.max(1, ...items.map((item) => Math.abs(Number(item.value))));
  return (
    <div className="category-bars" aria-label={title}>
      {items.map((item) => (
        <div
          className="category-bar"
          key={item.label}
          style={
            {
              "--bar-size": `${(Math.abs(Number(item.value)) / max) * 100}%`,
            } as VariableStyle
          }
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
