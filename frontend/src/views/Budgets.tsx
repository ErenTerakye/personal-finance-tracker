import { FormEvent, useEffect, useState } from "react";
import { Download, Filter, PiggyBank, RotateCcw, Save, Trash2, Upload } from "lucide-react";
import { api, type BudgetFilters } from "../api";
import { CsvImportDialog } from "../components/CsvImportDialog";
import { BudgetPressureList } from "../components/Lists";
import { PeriodControl } from "../components/PeriodControl";
import { BudgetTable } from "../components/Tables";
import {
  ActionButton,
  DownloadLink,
  ErrorBanner,
  Field,
  FilterBar,
  IconButton,
  ModalDialog,
  PageHeader,
  Panel,
  SubmitButton
} from "../components/ui";
import { money, monthNames, periodLabel } from "../format";
import type { BudgetInput, BudgetRecord, BudgetStatus, ImportSummary } from "../types";
import { useI18n } from "../i18n";

type BudgetDialog = "create" | "edit" | null;

function defaultBudget(period: { month: number; year: number }): BudgetInput {
  return {
    category: "",
    amount: "",
    month: period.month,
    year: period.year
  };
}

export function BudgetsView({
  selectedPeriod,
  setSelectedPeriod,
  setNotice
}: {
  selectedPeriod: { month: number; year: number };
  setSelectedPeriod: (period: { month: number; year: number }) => void;
  setNotice: (notice: string) => void;
}) {
  const [budgets, setBudgets] = useState<BudgetRecord[]>([]);
  const [statuses, setStatuses] = useState<BudgetStatus[]>([]);
  const [filters, setFilters] = useState<BudgetFilters>({
    month: selectedPeriod.month,
    year: selectedPeriod.year,
    category: ""
  });
  const [form, setForm] = useState<BudgetInput>(defaultBudget(selectedPeriod));
  const [dialog, setDialog] = useState<BudgetDialog>(null);
  const [pendingDelete, setPendingDelete] = useState<BudgetRecord | null>(null);
  const [error, setError] = useState("");
  const [dialogError, setDialogError] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportSummary | null>(null);
  const [importError, setImportError] = useState("");
  const { t } = useI18n();

  const load = () => {
    const month = Number(filters.month || selectedPeriod.month);
    const year = Number(filters.year || selectedPeriod.year);
    setError("");
    setLoading(true);
    Promise.all([api.budgets(filters), api.budgetStatuses(month, year)])
      .then(([budgetResponse, statusResponse]) => {
        setBudgets(budgetResponse.budgets);
        setStatuses(statusResponse.statuses);
      })
      .catch((err: Error) => setError(readError(err, t)))
      .finally(() => setLoading(false));
  };

  useEffect(load, [filters, selectedPeriod]);

  useEffect(() => {
    setFilters((current) => ({
      ...current,
      month: selectedPeriod.month,
      year: selectedPeriod.year
    }));
  }, [selectedPeriod.month, selectedPeriod.year]);

  function openCreate() {
    setForm(defaultBudget({
      month: Number(filters.month || selectedPeriod.month),
      year: Number(filters.year || selectedPeriod.year)
    }));
    setDialogError("");
    setDialog("create");
  }

  function openEdit(budget: BudgetRecord) {
    setForm({
      category: budget.category,
      amount: budget.amount,
      month: budget.month,
      year: budget.year
    });
    setDialogError("");
    setDialog("edit");
  }

  async function saveBudget(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setDialogError("");
    setSaving(true);
    try {
      const response = await api.setBudget(form);
      setNotice(response.notice);
      setSelectedPeriod({ month: form.month, year: form.year });
      setFilters({ month: form.month, year: form.year, category: "" });
      setForm(defaultBudget(form));
      setDialog(null);
      load();
    } catch (err) {
      setDialogError(readError(err, t));
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) {
      return;
    }
    setDialogError("");
    setSaving(true);
    try {
      const response = await api.deleteBudget(pendingDelete.id);
      setNotice(response.notice);
      setPendingDelete(null);
      load();
    } catch (err) {
      setDialogError(readError(err, t));
    } finally {
      setSaving(false);
    }
  }

  async function importBudgets(csvText: string) {
    setImportError("");
    setImportResult(null);
    setImporting(true);
    try {
      const response = await api.importBudgetsCsv(csvText);
      setImportResult(response);
      setNotice(response.notice);
      load();
    } catch (err) {
      setImportError(readError(err, t));
    } finally {
      setImporting(false);
    }
  }

  const pressureDetail = loading 
    ? t("budgets.pressureLoading") 
    : `${filters.month}/${filters.year}`;

  const recordsDetail = loading 
    ? t("budgets.recordsLoading") 
    : t("budgets.recordsCount", { count: budgets.length });

  return (
    <>
      <PageHeader
        eyebrow={t("budgets.title")}
        title={t("budgets.title")}
        summary={t("budgets.summary")}
        actions={
          <div className="action-cluster">
            <ActionButton icon={PiggyBank} onClick={openCreate}>
              {t("common.setBudget")}
            </ActionButton>
            <ActionButton icon={Upload} variant="secondary" onClick={() => setImportOpen(true)}>
              {t("common.importCsv")}
            </ActionButton>
          </div>
        }
      />

      {error ? <ErrorBanner message={error} /> : null}

      <section className="budget-layout">
        <Panel title={t("budgets.pressureTitle")} detail={pressureDetail}>
          {loading ? (
            <p className="loading-state">{t("budgets.pressureLoading")}</p>
          ) : (
            <BudgetPressureList statuses={statuses} />
          )}
        </Panel>

        <BudgetFilterForm filters={filters} selectedPeriod={selectedPeriod} onChange={setFilters} />

        <Panel
          title={t("budgets.recordsTitle")}
          detail={recordsDetail}
          className="records-panel"
          actions={
            <DownloadLink
              icon={Download}
              href={api.budgetCsvExportUrl(filters)}
              download
              variant="secondary"
            >
              {t("common.exportCsv")}
            </DownloadLink>
          }
        >
          {loading ? (
            <p className="loading-state">{t("budgets.recordsLoading")}</p>
          ) : (
            <BudgetTable budgets={budgets} onEdit={openEdit} onDelete={setPendingDelete} />
          )}
        </Panel>
      </section>

      <CsvImportDialog
        open={importOpen}
        title={t("csv.importBudgetTitle")}
        description={t("csv.importBudgetDesc")}
        result={importResult}
        error={importError}
        uploading={importing}
        onClose={() => setImportOpen(false)}
        onImport={importBudgets}
        onReset={() => {
          setImportError("");
          setImportResult(null);
        }}
      />

      <BudgetFormDialog
        open={dialog !== null}
        mode={dialog ?? "create"}
        form={form}
        error={dialogError}
        saving={saving}
        onClose={() => setDialog(null)}
        onSubmit={saveBudget}
        onChange={setForm}
      />

      <ModalDialog
        open={pendingDelete !== null}
        title={t("budgets.dialog.deleteTitle")}
        description={pendingDelete ? `${pendingDelete.category} ${money(pendingDelete.amount)}` : undefined}
        onClose={() => {
          setPendingDelete(null);
          setDialogError("");
        }}
      >
        {dialogError ? <ErrorBanner message={dialogError} /> : null}
        <p className="dialog-copy">{t("budgets.dialog.deleteConfirmText")}</p>
        <div className="dialog-actions">
          <button className="button secondary" type="button" onClick={() => setPendingDelete(null)}>
            {t("common.cancel")}
          </button>
          <button className="button danger" type="button" disabled={saving} onClick={confirmDelete}>
            <Trash2 aria-hidden="true" size={18} />
            <span>{t("budgets.dialog.deleteBtn")}</span>
          </button>
        </div>
      </ModalDialog>
    </>
  );
}

function BudgetFilterForm({
  filters,
  selectedPeriod,
  onChange
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
    year: Number(draft.year || selectedPeriod.year)
  };
  const hasActiveFilters = Boolean(
    draft.category || period.month !== selectedPeriod.month || period.year !== selectedPeriod.year
  );

  function resetFilters() {
    const reset: BudgetFilters = {
      month: selectedPeriod.month,
      year: selectedPeriod.year,
      category: ""
    };
    setDraft(reset);
    onChange(reset);
  }

  return (
    <FilterBar title={t("budgets.filterTitle")} summary={t("budgets.filterSummary", { period: periodLabel(period.month, period.year) })}>
      <form
        className="filter-form"
        aria-label="Filter budgets"
        onSubmit={(event) => {
          event.preventDefault();
          onChange(draft);
        }}
      >
        <PeriodControl
          label="Budget filter period"
          value={period}
          onChange={(nextPeriod) => setDraft({ ...draft, ...nextPeriod })}
        />
        <Field id="budget-filter-category" label={t("common.category")}>
          <input
            id="budget-filter-category"
            type="search"
            value={draft.category}
            onChange={(event) => setDraft({ ...draft, category: event.target.value })}
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

function BudgetFormDialog({
  open,
  mode,
  form,
  error,
  saving,
  onClose,
  onSubmit,
  onChange
}: {
  open: boolean;
  mode: Exclude<BudgetDialog, null>;
  form: BudgetInput;
  error: string;
  saving: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onChange: (form: BudgetInput) => void;
}) {
  const { t } = useI18n();

  return (
    <ModalDialog
      open={open}
      title={mode === "edit" ? t("budgets.dialog.updateTitle") : t("budgets.dialog.setTitle")}
      description={t("budgets.dialog.setDescription")}
      onClose={onClose}
    >
      {error ? <ErrorBanner message={error} /> : null}
      <form className="dialog-form" onSubmit={onSubmit}>
        <Field id="budget-category" label={t("common.category")} hint={t("budgets.dialog.categoryHint")}>
          <input
            id="budget-category"
            aria-describedby="budget-category-hint"
            required
            value={form.category}
            onChange={(event) => onChange({ ...form, category: event.target.value })}
          />
        </Field>
        <Field id="budget-amount" label={t("common.amount")} hint={t("budgets.dialog.amountHint")}>
          <input
            id="budget-amount"
            aria-describedby="budget-amount-hint"
            inputMode="decimal"
            required
            value={form.amount}
            onChange={(event) => onChange({ ...form, amount: event.target.value })}
          />
        </Field>
        <Field id="budget-month" label={t("common.month")}>
          <select
            id="budget-month"
            required
            value={form.month}
            onChange={(event) => onChange({ ...form, month: Number(event.target.value) })}
          >
            {monthNames.slice(1).map((name, index) => (
              <option key={name} value={index + 1}>
                {name}
              </option>
            ))}
          </select>
        </Field>
        <Field id="budget-year" label={t("common.year")}>
          <input
            id="budget-year"
            min="1"
            type="number"
            required
            value={form.year}
            onChange={(event) => onChange({ ...form, year: Number(event.target.value) })}
          />
        </Field>
        <div className="dialog-actions">
          <button className="button secondary" type="button" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <SubmitButton busy={saving} icon={Save}>
            {mode === "edit" ? t("common.save") : t("budgets.dialog.setTitle")}
          </SubmitButton>
        </div>
      </form>
    </ModalDialog>
  );
}

function readError(error: unknown, t: (key: string) => string): string {
  if (error instanceof Error) {
    return error.message;
  }
  return t("common.errorFallback");
}

