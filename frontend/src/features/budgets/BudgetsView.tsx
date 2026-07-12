import { FormEvent, useEffect, useRef, useState } from "react";
import { Download, PiggyBank, Trash2, Upload } from "lucide-react";
import type { BudgetFilters } from "../../api/client";
import { artifactUrls } from "../../api/artifacts";
import { CsvImportDialog } from "../../shared/components/CsvImportDialog";
import { ActionButton, DownloadLink } from "../../shared/components/actions";
import { ModalDialog } from "../../shared/components/dialogs";
import { ErrorBanner } from "../../shared/components/feedback";
import { PageHeader, Panel } from "../../shared/components/lists";
import { money } from "../../shared/format/money";
import { periodLabel } from "../../shared/format/periods";
import type { BudgetInput, BudgetRecord } from "../../types";
import { localizedNotice } from "../../shared/i18n/notices";
import { useI18n } from "../../shared/i18n/I18nProvider";
import {
  defaultBudget,
  readBudgetFilters,
  writeBudgetFilters,
} from "./budgetForm";
import {
  useBudgetImport,
  useBudgets,
  useDeleteBudget,
  useSaveBudget,
} from "./useBudgets";
import { BudgetFilterForm } from "./components/BudgetFilterForm";
import { BudgetFormDialog } from "./components/BudgetFormDialog";
import { usePeriodTransition } from "../../shared/hooks/usePeriodTransition";
import { RollingNumber } from "../../shared/components/RollingNumber";

type BudgetDialog = "create" | "edit" | null;

export function BudgetsView({
  selectedPeriod,
  setSelectedPeriod,
  setNotice,
  createRequestId,
}: {
  selectedPeriod: { month: number; year: number };
  setSelectedPeriod: (period: { month: number; year: number }) => void;
  setNotice: (notice: string) => void;
  createRequestId: number;
}) {
  const [filters, setFilters] = useState<BudgetFilters>(() =>
    readBudgetFilters(selectedPeriod),
  );
  const [form, setForm] = useState<BudgetInput>(defaultBudget(selectedPeriod));
  const [dialog, setDialog] = useState<BudgetDialog>(null);
  const [pendingDelete, setPendingDelete] = useState<BudgetRecord | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const handledCreateRequest = useRef(0);
  const { t, tUpper } = useI18n();
  const budgetResource = useBudgets(filters, selectedPeriod);
  const requestedPeriod = {
    month: Number(filters.month || selectedPeriod.month),
    year: Number(filters.year || selectedPeriod.year),
  };
  const periodTransition = usePeriodTransition(requestedPeriod, budgetResource);
  const budgets = periodTransition.data?.budgets ?? [];
  const statuses = periodTransition.data?.statuses ?? [];
  const [sortBy, setSortBy] = useState<"priority" | "category" | "spent">(
    "priority",
  );
  const visibleStatuses = statuses.filter((status) =>
    filters.category
      ? status.budget.category
          .toLocaleLowerCase()
          .includes(filters.category.toLocaleLowerCase())
      : true,
  );
  const prioritizedStatuses = [...visibleStatuses].sort((a, b) => {
    if (sortBy === "category") {
      return a.budget.category.localeCompare(b.budget.category);
    }
    if (sortBy === "spent") {
      return Number(b.actual_expenses) - Number(a.actual_expenses);
    }
    const priority = (value: string) =>
      value === "over budget" ? 2 : value === "near limit" ? 1 : 0;
    return (
      priority(b.status) - priority(a.status) ||
      Number(b.percent_used) - Number(a.percent_used)
    );
  });
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const loading = budgetResource.status === "loading";
  const initialLoading = loading && !periodTransition.data;
  const saveMutation = useSaveBudget((response, input) => {
    setNotice(localizedNotice(response, t));
    setSelectedPeriod({ month: input.month, year: input.year });
    setFilters({ month: input.month, year: input.year, category: "" });
    setForm(defaultBudget(input));
    setDialog(null);
    budgetResource.refetch();
  });
  const deleteMutation = useDeleteBudget((response) => {
    setNotice(localizedNotice(response, t));
    setPendingDelete(null);
    budgetResource.refetch();
  });
  const importMutation = useBudgetImport((response) => {
    setNotice(localizedNotice(response, t));
    budgetResource.refetch();
  });

  useEffect(() => {
    setFilters((current) => ({
      ...current,
      month: selectedPeriod.month,
      year: selectedPeriod.year,
    }));
  }, [selectedPeriod.month, selectedPeriod.year]);

  useEffect(() => {
    if (createRequestId <= handledCreateRequest.current) return;
    handledCreateRequest.current = createRequestId;
    openCreate();
  }, [createRequestId]);

  function openCreate() {
    setForm(
      defaultBudget({
        month: Number(filters.month || selectedPeriod.month),
        year: Number(filters.year || selectedPeriod.year),
      }),
    );
    saveMutation.reset();
    setDialog("create");
  }

  function openEdit(budget: BudgetRecord) {
    setForm({
      category: budget.category,
      amount: budget.amount,
      month: budget.month,
      year: budget.year,
    });
    saveMutation.reset();
    setDialog("edit");
  }

  function saveBudget(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void saveMutation.mutate(form);
  }

  function confirmDelete() {
    if (!pendingDelete) {
      return;
    }
    void deleteMutation.mutate(pendingDelete.id);
  }

  async function importBudgets(csvText: string) {
    importMutation.reset();
    await importMutation.mutate(csvText);
  }

  const pressureDetail = initialLoading
    ? t("budgets.pressureLoading")
    : `${periodTransition.presentedPeriod?.month ?? requestedPeriod.month}/${periodTransition.presentedPeriod?.year ?? requestedPeriod.year}`;

  const recordsDetail = initialLoading
    ? t("budgets.recordsLoading")
    : t("budgets.recordsCount", { count: budgets.length });
  const totalPlanned = statuses.reduce(
    (sum, status) => sum + Number(status.budget.amount),
    0,
  );
  const coveredSpending = statuses.reduce(
    (sum, status) => sum + Number(status.actual_expenses),
    0,
  );
  const totalSpent = Number(periodTransition.data?.totalExpenses ?? 0);
  const previousStatuses = periodTransition.previousData?.statuses ?? statuses;
  const previousPlanned = previousStatuses.reduce(
    (sum, status) => sum + Number(status.budget.amount),
    0,
  );
  const previousCovered = previousStatuses.reduce(
    (sum, status) => sum + Number(status.actual_expenses),
    0,
  );
  const previousSpent = Number(
    periodTransition.previousData?.totalExpenses ?? totalSpent,
  );
  const previousRemaining = previousPlanned - previousCovered;
  const previousUncovered = Math.max(0, previousSpent - previousCovered);
  const remaining = totalPlanned - coveredSpending;
  const uncovered = Math.max(0, totalSpent - coveredSpending);
  const selectedStatus = statuses.find(
    (status) => status.budget.category === selectedCategory,
  );
  const hasCategoryFilter = Boolean(filters.category?.trim());

  return (
    <div
      className={`period-view budgets-period-view${periodTransition.pending ? " is-period-pending" : ""}`}
      aria-busy={periodTransition.pending}
    >
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {!periodTransition.pending && periodTransition.presentedPeriod
          ? t("common.periodLoaded", {
              period: periodLabel(
                periodTransition.presentedPeriod.month,
                periodTransition.presentedPeriod.year,
              ),
            })
          : ""}
      </p>
      <PageHeader
        eyebrow={tUpper("budgets.title")}
        title={t("budgets.title")}
        summary={t("budgets.summary")}
        actions={
          <div className="action-cluster">
            <ActionButton icon={PiggyBank} onClick={openCreate}>
              {t("common.setBudget")}
            </ActionButton>
            <ActionButton
              icon={Upload}
              variant="secondary"
              onClick={() => setImportOpen(true)}
            >
              {t("common.importCsv")}
            </ActionButton>
          </div>
        }
      />

      {budgetResource.status === "error" ? (
        <ErrorBanner message={budgetResource.error.message} />
      ) : null}

      <section className="budget-layout">
        <Panel
          title={t("budgets.plannedVsSpent")}
          detail={pressureDetail}
          className="budget-summary-panel"
        >
          {initialLoading ? (
            <p className="loading-state">{t("budgets.pressureLoading")}</p>
          ) : (
            <dl className="budget-totals">
              <div className="budget-total budget-total-planned">
                <dt>{t("budgets.totalPlanned")}</dt>
                <dd>
                  <RollingNumber
                    value={totalPlanned}
                    previousValue={previousPlanned}
                    format={money}
                  />
                </dd>
              </div>
              <div className="budget-total budget-total-spent">
                <dt>{t("budgets.totalSpent")}</dt>
                <dd>
                  <RollingNumber
                    value={totalSpent}
                    previousValue={previousSpent}
                    format={money}
                  />
                </dd>
              </div>
              <div
                className={`budget-total ${remaining >= 0 ? "budget-total-positive" : "budget-total-warning"}`}
              >
                <dt>
                  {t(remaining >= 0 ? "budgets.remaining" : "budgets.overPlan")}
                </dt>
                <dd>
                  <RollingNumber
                    value={Math.abs(remaining)}
                    previousValue={Math.abs(previousRemaining)}
                    format={money}
                  />
                </dd>
              </div>
              <div
                className={`budget-total ${uncovered > 0 ? "budget-total-warning" : "budget-total-positive"}`}
              >
                <dt>{t("budgets.uncovered")}</dt>
                <dd>
                  <RollingNumber
                    value={uncovered}
                    previousValue={previousUncovered}
                    format={money}
                  />
                </dd>
              </div>
            </dl>
          )}
        </Panel>

        <BudgetFilterForm
          filters={filters}
          selectedPeriod={selectedPeriod}
          onChange={(next) => {
            writeBudgetFilters(next);
            setFilters(next);
          }}
        />

        <Panel
          title={t("budgets.pressureTitle")}
          detail={recordsDetail}
          className="records-panel"
          actions={
            <div className="action-cluster">
              <label htmlFor="budget-sort">{t("budgets.sortBy")}</label>
              <select
                id="budget-sort"
                value={sortBy}
                onChange={(event) =>
                  setSortBy(event.target.value as typeof sortBy)
                }
              >
                <option value="priority">{t("budgets.sortPriority")}</option>
                <option value="spent">{t("budgets.sortSpent")}</option>
                <option value="category">{t("budgets.sortCategory")}</option>
              </select>
              <DownloadLink
                icon={Download}
                href={artifactUrls.budgetsCsv(filters)}
                download
                variant="secondary"
              >
                {t("common.exportCsv")}
              </DownloadLink>
            </div>
          }
        >
          {initialLoading ? (
            <p className="loading-state">{t("budgets.recordsLoading")}</p>
          ) : hasCategoryFilter && visibleStatuses.length === 0 ? (
            <p className="quiet-state">{t("budgets.empty.noMatch")}</p>
          ) : statuses.length === 0 && totalSpent > 0 ? (
            <p className="quiet-state">{t("budgets.empty.uncovered")}</p>
          ) : statuses.length === 0 ? (
            <p className="quiet-state">{t("budgets.empty.noPlan")}</p>
          ) : (
            <div className="budget-category-list">
              {prioritizedStatuses.map((status) => {
                const isSelected = selectedCategory === status.budget.category;
                const over = Number(status.remaining) < 0;
                return (
                  <article
                    className={`budget-category-row ${status.status.replaceAll(" ", "-")}`}
                    key={status.budget.id}
                  >
                    <button
                      type="button"
                      aria-label={`${status.budget.category}, ${status.status}, ${status.percent_used}% used`}
                      aria-expanded={isSelected}
                      onClick={() =>
                        setSelectedCategory(
                          isSelected ? null : status.budget.category,
                        )
                      }
                    >
                      <span>
                        <strong>{status.budget.category}</strong>
                        <em>{status.status}</em>
                      </span>
                      <span>
                        {money(status.actual_expenses)} of{" "}
                        {money(status.budget.amount)}
                      </span>
                      <span>
                        {over
                          ? `${money(Math.abs(Number(status.remaining)))} over`
                          : `${money(status.remaining)} remaining`}
                      </span>
                    </button>
                    <progress
                      max="100"
                      value={Math.min(Number(status.percent_used), 100)}
                      aria-label={`${status.budget.category} budget used ${status.percent_used}%`}
                    />
                  </article>
                );
              })}
            </div>
          )}
        </Panel>

        {selectedStatus ? (
          <aside
            className="budget-category-detail"
            aria-labelledby="selected-budget-title"
          >
            <h2 id="selected-budget-title">{selectedStatus.budget.category}</h2>
            <p>
              {money(selectedStatus.actual_expenses)} spent ·{" "}
              {selectedStatus.percent_used}% of plan
            </p>
            <div className="action-cluster">
              <button
                className="button primary"
                type="button"
                onClick={() => openEdit(selectedStatus.budget)}
              >
                Edit {selectedStatus.budget.category} budget
              </button>
              <button
                className="button danger"
                type="button"
                onClick={() => setPendingDelete(selectedStatus.budget)}
              >
                Delete budget
              </button>
            </div>
          </aside>
        ) : null}
      </section>

      <CsvImportDialog
        open={importOpen}
        title={t("csv.importBudgetTitle")}
        description={t("csv.importBudgetDesc")}
        result={
          importMutation.status === "success" ? importMutation.data : null
        }
        error={
          importMutation.status === "error" ? importMutation.error.message : ""
        }
        uploading={importMutation.status === "pending"}
        onClose={() => setImportOpen(false)}
        onImport={importBudgets}
        onReset={() => {
          importMutation.reset();
        }}
      />

      <BudgetFormDialog
        open={dialog !== null}
        mode={dialog ?? "create"}
        form={form}
        error={
          saveMutation.status === "error" ? saveMutation.error.message : ""
        }
        saving={saveMutation.status === "pending"}
        onClose={() => setDialog(null)}
        onSubmit={saveBudget}
        onChange={setForm}
      />

      <ModalDialog
        open={pendingDelete !== null}
        title={t("budgets.dialog.deleteTitle")}
        description={
          pendingDelete
            ? `${pendingDelete.category} ${money(pendingDelete.amount)}`
            : undefined
        }
        onClose={() => {
          setPendingDelete(null);
          deleteMutation.reset();
        }}
      >
        {deleteMutation.status === "error" ? (
          <ErrorBanner message={deleteMutation.error.message} />
        ) : null}
        <p className="dialog-copy">{t("budgets.dialog.deleteConfirmText")}</p>
        <div className="dialog-actions">
          <button
            className="button secondary"
            type="button"
            onClick={() => setPendingDelete(null)}
          >
            {t("common.cancel")}
          </button>
          <button
            className="button danger"
            type="button"
            disabled={deleteMutation.status === "pending"}
            onClick={confirmDelete}
          >
            <Trash2 aria-hidden="true" size={18} />
            <span>{t("budgets.dialog.deleteBtn")}</span>
          </button>
        </div>
      </ModalDialog>
    </div>
  );
}
