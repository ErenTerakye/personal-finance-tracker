import { ListFilter, RotateCcw } from "lucide-react";
import { useEffect, useId, useState } from "react";
import type { TransactionFilters } from "../../../api/client";
import type { TransactionType } from "../../../types";
import { ActionButton } from "../../../shared/components/actions";
import { PeriodControl } from "../../../shared/components/PeriodControl";
import { Field, FilterBar } from "../../../shared/components/fields";
import { periodLabel } from "../../../shared/format/periods";
import { useDebounce } from "../../../shared/hooks/useDebounce";
import { useI18n } from "../../../shared/i18n/I18nProvider";

export function TransactionFilterForm({
  filters,
  selectedPeriod,
  onChange,
}: {
  filters: TransactionFilters;
  selectedPeriod: { month: number; year: number };
  onChange: (filters: TransactionFilters) => void;
}) {
  const [categorySearch, setCategorySearch] = useState(filters.category || "");
  const [isOpen, setIsOpen] = useState(false);
  const panelId = useId();
  const debouncedCategory = useDebounce(categorySearch, 250);
  const { t } = useI18n();

  useEffect(() => {
    // Keep the debounced input aligned with externally reset filters.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCategorySearch(filters.category || "");
  }, [filters.category]);

  useEffect(() => {
    if (debouncedCategory !== filters.category) {
      onChange({
        ...filters,
        category: debouncedCategory,
      });
    }
  }, [debouncedCategory, filters, onChange]);

  const period = {
    month: Number(filters.month || selectedPeriod.month),
    year: Number(filters.year || selectedPeriod.year),
  };
  const hasActiveFilters = Boolean(
    filters.category ||
    filters.transaction_type ||
    period.month !== selectedPeriod.month ||
    period.year !== selectedPeriod.year,
  );

  function resetFilters() {
    onChange({
      month: selectedPeriod.month,
      year: selectedPeriod.year,
      transaction_type: "",
      category: "",
    });
  }

  return (
    <>
      <button
        className="button secondary transaction-filter-toggle"
        type="button"
        aria-controls={panelId}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      >
        <ListFilter aria-hidden="true" size={18} />
        <span>{t("transactions.filters.open")}</span>
      </button>
      {isOpen ? (
        <div className="transaction-filter-panel" id={panelId}>
          <FilterBar
            title={t("transactions.filterTitle")}
            summary={t("transactions.filterSummary", {
              period: periodLabel(period.month, period.year),
            })}
          >
            <form
              className="filter-form"
              aria-label={t("transactions.filterAria")}
              onSubmit={(event) => {
                event.preventDefault();
              }}
            >
              <PeriodControl
                label={t("transactions.filterPeriod")}
                value={period}
                onChange={(nextPeriod) =>
                  onChange({ ...filters, ...nextPeriod })
                }
              />
              <Field id="filter-category" label={t("common.category")}>
                <input
                  id="filter-category"
                  type="search"
                  list="category-suggestions"
                  value={categorySearch}
                  onChange={(event) => setCategorySearch(event.target.value)}
                />
              </Field>
              <Field id="filter-type" label={t("common.type")}>
                <select
                  id="filter-type"
                  value={filters.transaction_type}
                  onChange={(event) =>
                    onChange({
                      ...filters,
                      transaction_type: event.target.value as
                        TransactionType | "",
                    })
                  }
                >
                  <option value="">{t("common.all")}</option>
                  <option value="expense">{t("common.expense")}</option>
                  <option value="income">{t("common.income")}</option>
                </select>
              </Field>
              <div className="filter-actions">
                <ActionButton
                  icon={RotateCcw}
                  variant="ghost"
                  disabled={!hasActiveFilters}
                  onClick={resetFilters}
                >
                  {t("common.resetFilters")}
                </ActionButton>
              </div>
            </form>
          </FilterBar>
        </div>
      ) : null}
    </>
  );
}
