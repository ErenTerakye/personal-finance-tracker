import {
  type CSSProperties,
  type FormEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import "./budgets.css";
import "./budgets-overrides.css";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  CircleGauge,
  Download,
  MoreHorizontal,
  PiggyBank,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import type { BudgetFilters } from "../../api/client";
import { artifactUrls } from "../../api/artifacts";
import { CsvImportDialog } from "../../shared/components/CsvImportDialog";
import { ActionButton, DownloadLink } from "../../shared/components/actions";
import { ModalDialog } from "../../shared/components/dialogs";
import { EmptyState, ErrorBanner } from "../../shared/components/feedback";
import { PageHeader } from "../../shared/components/lists";
import { PeriodControl } from "../../shared/components/PeriodControl";
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
  preloadBudgets,
} from "./useBudgets";
import { BudgetFormDialog } from "./components/BudgetFormDialog";
import { usePeriodTransition } from "../../shared/hooks/usePeriodTransition";
import { RollingNumber } from "../../shared/components/RollingNumber";

type BudgetDialog = "create" | "edit" | null;

export function preloadBudgetsView(period: { month: number; year: number }) {
  return preloadBudgets(readBudgetFilters(period), period);
}

export function BudgetsView({
  selectedPeriod,
  setSelectedPeriod,
  setNotice,
  createRequestId,
  locationVersion = 0,
  onReviewTransactions,
}: {
  selectedPeriod: { month: number; year: number };
  setSelectedPeriod: (period: { month: number; year: number }) => void;
  setNotice: (notice: string) => void;
  createRequestId: number;
  locationVersion?: number;
  onReviewTransactions: (category: string, month: number, year: number) => void;
}) {
  const [filters, setFilters] = useState<BudgetFilters>(() =>
    readBudgetFilters(selectedPeriod),
  );
  const [form, setForm] = useState<BudgetInput>(defaultBudget(selectedPeriod));
  const [dialog, setDialog] = useState<BudgetDialog>(null);
  const [pendingDelete, setPendingDelete] = useState<BudgetRecord | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const handledCreateRequest = useRef(0);
  const { t } = useI18n();
  const budgetResource = useBudgets(filters, selectedPeriod);
  const requestedPeriod = {
    month: Number(filters.month || selectedPeriod.month),
    year: Number(filters.year || selectedPeriod.year),
  };
  const periodTransition = usePeriodTransition(requestedPeriod, budgetResource);
  const budgets = periodTransition.data?.budgets ?? [];
  const statuses = periodTransition.data?.statuses ?? [];
  const [sortBy, setSortBy] = useState<"priority" | "category" | "spent">(() =>
    readBudgetSort(),
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
  const [selectedCategory, setSelectedCategory] = useState<string | null>(
    () => readBudgetCategory() || null,
  );
  const [inspectorOpen, setInspectorOpen] = useState(() =>
    Boolean(readBudgetCategory()),
  );
  const inspectorId = useId();
  const inspectorTitleId = useId();
  const categoryButtonRefs = useRef(new Map<string, HTMLButtonElement>());
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
    setInspectorOpen(false);
    setSelectedCategory(null);
    budgetResource.refetch();
  });
  const importMutation = useBudgetImport((response) => {
    setNotice(localizedNotice(response, t));
    budgetResource.refetch();
  });

  useEffect(() => {
    // Prop-to-query synchronization is deliberate; the route owns the selected period.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
    // openCreate must read the latest form and mutation state without retriggering this request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createRequestId]);

  useEffect(() => {
    const nextFilters = readBudgetFilters(selectedPeriod);
    const category = nextFilters.category || null;
    // Browser-history changes intentionally hydrate this feature's complete route state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFilters(nextFilters);
    setSelectedCategory(category);
    setInspectorOpen(Boolean(category));
    setImportOpen(
      new URLSearchParams(window.location.search).get("data") === "import",
    );
  }, [locationVersion, selectedPeriod]);

  useEffect(() => {
    const closeTransientUi = () => {
      setDialog(null);
      setPendingDelete(null);
      setInspectorOpen(false);
      setImportOpen(false);
    };
    window.addEventListener("finance-tracker:route-leave", closeTransientUi);
    return () =>
      window.removeEventListener(
        "finance-tracker:route-leave",
        closeTransientUi,
      );
  }, []);

  useEffect(() => {
    if (!inspectorOpen) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (
        event.key !== "Escape" ||
        event.defaultPrevented ||
        (event.target instanceof Element && event.target.closest("dialog"))
      ) {
        return;
      }
      setInspectorOpen(false);
      categoryButtonRefs.current.get(selectedCategory ?? "")?.focus();
    }

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [inspectorOpen, selectedCategory]);

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
  const previousUncovered = Math.max(0, previousSpent - previousCovered);
  const remaining = totalPlanned - coveredSpending;
  const uncovered = Math.max(0, totalSpent - coveredSpending);
  const selectedStatus = statuses.find(
    (status) => status.budget.category === selectedCategory,
  );
  const hasCategoryFilter = Boolean(filters.category?.trim());
  const utilization =
    totalPlanned > 0 ? (coveredSpending / totalPlanned) * 100 : 0;
  const planProgress = Math.min(Math.max(utilization, 0), 100);
  const overCount = statuses.filter(
    (status) => status.status === "over budget",
  ).length;
  const nearCount = statuses.filter(
    (status) => status.status === "near limit",
  ).length;
  const presentedPeriod = periodTransition.presentedPeriod ?? requestedPeriod;
  const planTone =
    overCount > 0 ? "critical" : nearCount > 0 ? "watch" : "healthy";
  const planPulseTitle = t(`budgets.pulse.${planTone}Title`);
  const planPulseMessage = t(`budgets.pulse.${planTone}Message`, {
    over: overCount,
    near: nearCount,
  });

  function updateFilters(next: BudgetFilters) {
    writeBudgetFilters(next);
    setFilters(next);
    setInspectorOpen(false);
    setSelectedCategory(null);
  }

  function closeInspector({ restoreFocus = false } = {}) {
    setInspectorOpen(false);
    if (restoreFocus) {
      categoryButtonRefs.current.get(selectedCategory ?? "")?.focus();
    }
  }

  function statusPresentation(status: string) {
    if (status === "over budget") {
      return {
        label: t("budgets.status.over"),
        tone: "over-budget",
        Icon: AlertTriangle,
      };
    }
    if (status === "near limit") {
      return {
        label: t("budgets.status.near"),
        tone: "near-limit",
        Icon: CircleGauge,
      };
    }
    return {
      label: t("budgets.status.onTrack"),
      tone: "on-track",
      Icon: CheckCircle2,
    };
  }

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
        eyebrow={t("budgets.eyebrow")}
        title={t("budgets.title")}
        summary={t("budgets.routeSummary", {
          period: periodLabel(presentedPeriod.month, presentedPeriod.year),
        })}
        className="plan-page-heading"
        context={
          <PeriodControl
            label={t("budgets.filterPeriod")}
            value={requestedPeriod}
            onChange={(period) => updateFilters({ ...filters, ...period })}
          />
        }
        actions={
          <div className="action-cluster">
            <ActionButton icon={PiggyBank} onClick={openCreate}>
              {t("common.setBudget")}
            </ActionButton>
            <details className="data-menu">
              <summary className="button secondary">
                <MoreHorizontal aria-hidden="true" size={18} />
                <span>{t("transactions.dataMenu")}</span>
              </summary>
              <div className="data-menu-popover">
                <ActionButton
                  icon={Upload}
                  variant="ghost"
                  onClick={() => setImportOpen(true)}
                >
                  {t("common.importCsv")}
                </ActionButton>
                <DownloadLink
                  icon={Download}
                  href={artifactUrls.budgetsCsv(filters)}
                  download
                  variant="ghost"
                >
                  {t("common.exportCsv")}
                </DownloadLink>
              </div>
            </details>
          </div>
        }
      />

      {budgetResource.status === "error" ? (
        <ErrorBanner
          message={budgetResource.error.message}
          onRetry={budgetResource.refetch}
        />
      ) : null}

      <section className="plan-workspace">
        <article className={`plan-pulse plan-pulse-${planTone}`}>
          {initialLoading ? (
            <p className="loading-state">{t("budgets.pressureLoading")}</p>
          ) : (
            <>
              <div className="plan-pulse-main">
                <div
                  className="plan-orbit"
                  style={
                    { "--plan-progress": `${planProgress}%` } as CSSProperties
                  }
                >
                  <div>
                    <span>{t("budgets.pulse.variance")}</span>
                    <strong>{money(Math.abs(remaining))}</strong>
                    <em>
                      {remaining >= 0
                        ? t("budgets.pulse.left")
                        : t("budgets.pulse.over")}
                    </em>
                  </div>
                  <progress
                    className="sr-only"
                    max="100"
                    value={planProgress}
                    aria-label={t("budgets.pulse.progressLabel", {
                      percent: Math.round(utilization),
                    })}
                  />
                </div>
                <div className="plan-pulse-copy">
                  <p className="plan-pulse-kicker">
                    <CircleGauge aria-hidden="true" size={16} />
                    {t("budgets.pulse.label")}
                  </p>
                  <h2>{planPulseTitle}</h2>
                  <p>{planPulseMessage}</p>
                  {uncovered > 0 ? (
                    <p className="plan-uncovered-note">
                      <AlertTriangle aria-hidden="true" size={18} />
                      <span>
                        {t("budgets.pulse.uncoveredNote", {
                          amount: money(uncovered),
                        })}
                      </span>
                    </p>
                  ) : null}
                </div>
              </div>
              <dl className="plan-metrics">
                <div className="plan-metric plan-metric-planned">
                  <dt>{t("budgets.totalPlanned")}</dt>
                  <dd>
                    <RollingNumber
                      value={totalPlanned}
                      previousValue={previousPlanned}
                      format={money}
                    />
                  </dd>
                  <dd className="plan-metric-note">
                    {t("budgets.metric.planned")}
                  </dd>
                </div>
                <div className="plan-metric plan-metric-spent">
                  <dt>{t("budgets.totalSpent")}</dt>
                  <dd>
                    <RollingNumber
                      value={totalSpent}
                      previousValue={previousSpent}
                      format={money}
                    />
                  </dd>
                  <dd className="plan-metric-note">
                    {t("budgets.metric.spent")}
                  </dd>
                </div>
                <div
                  className={`plan-metric ${uncovered > 0 ? "plan-metric-alert" : "plan-metric-covered"}`}
                >
                  <dt>{t("budgets.uncovered")}</dt>
                  <dd>
                    <RollingNumber
                      value={uncovered}
                      previousValue={previousUncovered}
                      format={money}
                    />
                  </dd>
                  <dd className="plan-metric-note">
                    {t(
                      uncovered > 0
                        ? "budgets.metric.uncovered"
                        : "budgets.metric.covered",
                    )}
                  </dd>
                </div>
              </dl>
            </>
          )}
        </article>

        <section className="plan-board" aria-labelledby="plan-board-title">
          <header className="plan-board-header">
            <div>
              <p className="eyebrow">{t("budgets.board.eyebrow")}</p>
              <h2 id="plan-board-title">{t("budgets.board.title")}</h2>
              <p>{t("budgets.board.summary", { count: budgets.length })}</p>
            </div>
          </header>

          <div className="plan-toolbar">
            <div className="plan-period-control">
              <span>{t("common.period")}</span>
              <PeriodControl
                label={t("budgets.filterPeriod")}
                value={requestedPeriod}
                onChange={(period) => updateFilters({ ...filters, ...period })}
              />
            </div>
            <label className="plan-search" htmlFor="plan-category-search">
              <span>{t("budgets.board.searchLabel")}</span>
              <span className="plan-search-control">
                <Search aria-hidden="true" size={18} />
                <input
                  id="plan-category-search"
                  type="search"
                  value={filters.category ?? ""}
                  placeholder={t("budgets.board.searchPlaceholder")}
                  onChange={(event) =>
                    updateFilters({ ...filters, category: event.target.value })
                  }
                />
              </span>
            </label>
            <fieldset className="plan-sort">
              <legend>{t("budgets.sortBy")}</legend>
              <div>
                {(
                  [
                    ["priority", t("budgets.sortPriority")],
                    ["spent", t("budgets.sortSpent")],
                    ["category", t("budgets.sortCategory")],
                  ] as const
                ).map(([option, label]) => (
                  <label key={option}>
                    <input
                      className="visually-hidden"
                      type="radio"
                      name="plan-sort"
                      value={option}
                      checked={sortBy === option}
                      onChange={() => {
                        setSortBy(option);
                        writeBudgetSort(option);
                      }}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </div>

          <div className="plan-board-content">
            <div className="plan-category-region">
              {initialLoading ? (
                <p className="loading-state">{t("budgets.recordsLoading")}</p>
              ) : hasCategoryFilter && visibleStatuses.length === 0 ? (
                <p className="quiet-state">{t("budgets.empty.noMatch")}</p>
              ) : statuses.length === 0 && totalSpent > 0 ? (
                <EmptyState
                  icon={PiggyBank}
                  eyebrow={t("budgets.empty.eyebrow")}
                  title={t("budgets.empty.noBudgets")}
                  message={t("budgets.empty.uncovered")}
                  action={
                    <ActionButton icon={PiggyBank} onClick={openCreate}>
                      {t("common.setBudget")}
                    </ActionButton>
                  }
                />
              ) : statuses.length === 0 ? (
                <EmptyState
                  icon={PiggyBank}
                  eyebrow={t("budgets.empty.eyebrow")}
                  title={t("budgets.empty.noBudgets")}
                  message={t("budgets.empty.noPlan")}
                  action={
                    <ActionButton icon={PiggyBank} onClick={openCreate}>
                      {t("common.setBudget")}
                    </ActionButton>
                  }
                />
              ) : (
                <ul className="plan-category-grid" role="list">
                  {prioritizedStatuses.map((status) => {
                    const isSelected =
                      inspectorOpen &&
                      selectedCategory === status.budget.category;
                    const over = Number(status.remaining) < 0;
                    const presentation = statusPresentation(status.status);
                    const StatusIcon = presentation.Icon;
                    return (
                      <li
                        className={`plan-category-card ${presentation.tone}${isSelected ? " is-selected" : ""}`}
                        key={status.budget.id}
                      >
                        <button
                          ref={(button) => {
                            if (button) {
                              categoryButtonRefs.current.set(
                                status.budget.category,
                                button,
                              );
                            } else {
                              categoryButtonRefs.current.delete(
                                status.budget.category,
                              );
                            }
                          }}
                          type="button"
                          aria-label={`${status.budget.category}, ${status.status}, ${status.percent_used}% used`}
                          aria-expanded={isSelected}
                          aria-controls={
                            selectedStatus ? inspectorId : undefined
                          }
                          onClick={() => {
                            if (isSelected) {
                              closeInspector();
                              return;
                            }
                            setSelectedCategory(status.budget.category);
                            setInspectorOpen(true);
                          }}
                        >
                          <span className="plan-category-card-topline">
                            <span className="plan-status-badge">
                              <StatusIcon aria-hidden="true" size={15} />
                              {presentation.label}
                            </span>
                            <ChevronRight aria-hidden="true" size={18} />
                          </span>
                          <strong>{status.budget.category}</strong>
                          <span className="plan-category-spend">
                            <b>{money(status.actual_expenses)}</b>
                            <span>
                              {t("budgets.board.ofLimit", {
                                limit: money(status.budget.amount),
                              })}
                            </span>
                          </span>
                          <span className="plan-card-progress">
                            <span
                              style={{
                                inlineSize: `${Math.min(Number(status.percent_used), 100)}%`,
                              }}
                            />
                          </span>
                          <span className="plan-category-card-footer">
                            <span>{status.percent_used}%</span>
                            <b>
                              {over
                                ? t("budgets.board.amountOver", {
                                    amount: money(
                                      Math.abs(Number(status.remaining)),
                                    ),
                                  })
                                : t("budgets.board.amountLeft", {
                                    amount: money(status.remaining),
                                  })}
                            </b>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {selectedStatus ? (
              <div
                className="plan-inspector-layer"
                aria-hidden={!inspectorOpen}
                inert={!inspectorOpen}
              >
                <aside
                  id={inspectorId}
                  className={`plan-inspector ${statusPresentation(selectedStatus.status).tone}${inspectorOpen ? " is-open" : ""}`}
                  aria-labelledby={inspectorTitleId}
                >
                  <div className="plan-inspector-content">
                    <div className="plan-inspector-heading">
                      <div>
                        <span className="plan-status-badge">
                          {statusPresentation(selectedStatus.status).label}
                        </span>
                        <h3 id={inspectorTitleId}>
                          {selectedStatus.budget.category}
                        </h3>
                        <p>{t("budgets.inspector.summary")}</p>
                      </div>
                      <button
                        className="icon-button secondary plan-inspector-close"
                        type="button"
                        aria-label={t("budgets.inspector.close")}
                        onClick={() => closeInspector({ restoreFocus: true })}
                      >
                        <X aria-hidden="true" size={18} />
                      </button>
                    </div>
                    <dl className="plan-inspector-metrics">
                      <div>
                        <dt>{t("budgets.inspector.limit")}</dt>
                        <dd>{money(selectedStatus.budget.amount)}</dd>
                      </div>
                      <div>
                        <dt>{t("budgets.inspector.spent")}</dt>
                        <dd>{money(selectedStatus.actual_expenses)}</dd>
                      </div>
                      <div>
                        <dt>
                          {t(
                            Number(selectedStatus.remaining) < 0
                              ? "budgets.inspector.over"
                              : "budgets.inspector.available",
                          )}
                        </dt>
                        <dd>
                          {money(Math.abs(Number(selectedStatus.remaining)))}
                        </dd>
                      </div>
                    </dl>
                    <div className="plan-inspector-footer">
                      <p className="plan-inspector-insight">
                        <CircleGauge aria-hidden="true" size={18} />
                        {t("budgets.inspector.used", {
                          percent: selectedStatus.percent_used,
                        })}
                      </p>
                      <div className="plan-inspector-actions">
                        <button
                          className="button secondary"
                          type="button"
                          onClick={() =>
                            onReviewTransactions(
                              selectedStatus.budget.category,
                              selectedStatus.budget.month,
                              selectedStatus.budget.year,
                            )
                          }
                        >
                          {t("budgets.inspector.viewTransactions")}
                        </button>
                        <button
                          className="button primary"
                          type="button"
                          onClick={() => openEdit(selectedStatus.budget)}
                        >
                          {t("budgets.inspector.edit", {
                            category: selectedStatus.budget.category,
                          })}
                        </button>
                        <button
                          className="button danger"
                          type="button"
                          onClick={() =>
                            setPendingDelete(selectedStatus.budget)
                          }
                        >
                          {t("budgets.dialog.deleteBtn")}
                        </button>
                      </div>
                    </div>
                  </div>
                </aside>
              </div>
            ) : null}
          </div>
        </section>
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
        statuses={statuses}
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

function readBudgetCategory(): string {
  return new URLSearchParams(window.location.search).get("category") ?? "";
}

function readBudgetSort(): "priority" | "category" | "spent" {
  const value = new URLSearchParams(window.location.search).get("sort");
  return value === "category" || value === "spent" ? value : "priority";
}

function writeBudgetSort(value: "priority" | "category" | "spent") {
  const url = new URL(window.location.href);
  if (value === "priority") url.searchParams.delete("sort");
  else url.searchParams.set("sort", value);
  window.history.replaceState({}, "", `${url.pathname}${url.search}`);
}
