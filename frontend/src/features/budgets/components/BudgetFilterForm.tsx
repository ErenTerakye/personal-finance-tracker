import { Filter, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import type { BudgetFilters } from "../../../api/client";
import { ActionButton, IconButton } from "../../../shared/components/actions";
import { PeriodControl } from "../../../shared/components/PeriodControl";
import { Field, FilterBar } from "../../../shared/components/fields";
import { periodLabel } from "../../../shared/format/periods";
import { useI18n } from "../../../shared/i18n/I18nProvider";

export function BudgetFilterForm({
  filters,
  selectedPeriod,
  onChange,
}: {
  filters: BudgetFilters;
  selectedPeriod: { month: number; year: number };
  onChange: (filters: BudgetFilters) => void;
}) {
  const [draft, setDraft] = useState(filters);
  const { t } = useI18n();

  useEffect(() => {
    setDraft(filters);
  }, [filters]);

  const period = {
    month: Number(draft.month || selectedPeriod.month),
    year: Number(draft.year || selectedPeriod.year),
  };
  const hasActiveFilters = Boolean(
    draft.category ||
    period.month !== selectedPeriod.month ||
    period.year !== selectedPeriod.year,
  );

  function resetFilters() {
    const reset: BudgetFilters = {
      month: selectedPeriod.month,
      year: selectedPeriod.year,
      category: "",
    };
    setDraft(reset);
    onChange(reset);
  }

  return (
    <FilterBar
      title={t("budgets.filterTitle")}
      summary={t("budgets.filterSummary", {
        period: periodLabel(period.month, period.year),
      })}
    >
      <form
        className="filter-form"
        aria-label={t("budgets.filterAria")}
        onSubmit={(event) => {
          event.preventDefault();
          onChange(draft);
        }}
      >
        <PeriodControl
          label={t("budgets.filterPeriod")}
          value={period}
          onChange={(nextPeriod) => setDraft({ ...draft, ...nextPeriod })}
        />
        <Field id="budget-filter-category" label={t("common.category")}>
          <input
            id="budget-filter-category"
            type="search"
            value={draft.category}
            onChange={(event) =>
              setDraft({ ...draft, category: event.target.value })
            }
          />
        </Field>
        <div className="filter-actions">
          <ActionButton icon={Filter} type="submit">
            {t("common.applyFilters")}
          </ActionButton>
          {hasActiveFilters ? (
            <IconButton
              icon={RotateCcw}
              label={t("common.resetFilters")}
              variant="ghost"
              onClick={resetFilters}
            />
          ) : null}
        </div>
      </form>
    </FilterBar>
  );
}
