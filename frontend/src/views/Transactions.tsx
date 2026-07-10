import { FormEvent, useEffect, useState } from "react";
import {
  Download,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  Upload,
} from "lucide-react";
import { api, type TransactionFilters } from "../api";
import { CsvImportDialog } from "../components/CsvImportDialog";
import { PeriodControl } from "../components/PeriodControl";
import { TransactionTable } from "../components/Tables";
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
  SubmitButton,
  TableSkeleton,
} from "../components/ui";
import { money, periodLabel, todayIso } from "../format";
import type {
  ImportSummary,
  TransactionImportPreview,
  TransactionInput,
  TransactionRecord,
  TransactionType,
} from "../types";
import { localizedNotice, useI18n } from "../i18n";
import { readTransactionFilters, writeFilters } from "../urlState";
import { useDebounce } from "../hooks/useDebounce";

type TransactionDialog = "create" | "edit" | null;

const defaultTransaction = (): TransactionInput => ({
  type: "expense",
  amount: "",
  category: "",
  description: "",
  date: todayIso(),
});

export function TransactionsView({
  selectedPeriod,
  setNotice,
}: {
  selectedPeriod: { month: number; year: number };
  setNotice: (notice: string) => void;
}) {
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [filters, setFilters] = useState<TransactionFilters>(() =>
    readTransactionFilters(selectedPeriod),
  );
  const [form, setForm] = useState<TransactionInput>(defaultTransaction);
  const [dialog, setDialog] = useState<TransactionDialog>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<TransactionRecord | null>(
    null,
  );
  const [error, setError] = useState("");
  const [dialogError, setDialogError] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [importPreview, setImportPreview] =
    useState<TransactionImportPreview | null>(null);
  const [importResult, setImportResult] = useState<ImportSummary | null>(null);
  const [importError, setImportError] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const { t, tUpper } = useI18n();

  useEffect(() => {
    if (transactions.length > 0) {
      const uniq = Array.from(new Set(transactions.map((t) => t.category).filter(Boolean)));
      setCategories((prev) => {
        const combined = Array.from(new Set([...prev, ...uniq]));
        return combined.sort();
      });
    }
  }, [transactions]);

  useEffect(() => {
    api
      .budgets()
      .then((res) => {
        const budgetCats = res.budgets.map((b) => b.category);
        setCategories((prev) => Array.from(new Set([...prev, ...budgetCats])).sort());
      })
      .catch(() => {});

    api
      .categoryRules()
      .then((res) => {
        const ruleCats = res.rules.map((r) => r.category);
        setCategories((prev) => Array.from(new Set([...prev, ...ruleCats])).sort());
      })
      .catch(() => {});
  }, []);

  const load = (signal?: AbortSignal) => {
    setError("");
    setLoading(true);
    api
      .transactions(filters, signal)
      .then((response) => setTransactions(response.transactions))
      .catch((err: Error) => {
        if (err.name !== "AbortError") setError(readError(err, t));
      })
      .finally(() => {
        if (!signal?.aborted) setLoading(false);
      });
  };

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [filters]);

  useEffect(() => {
    setFilters((current) => ({
      ...current,
      month: selectedPeriod.month,
      year: selectedPeriod.year,
    }));
  }, [selectedPeriod.month, selectedPeriod.year]);

  function openCreate() {
    setForm(defaultTransaction());
    setEditingId(null);
    setDialogError("");
    setDialog("create");
  }

  function openEdit(transaction: TransactionRecord) {
    setForm({
      type: transaction.type as TransactionType,
      amount: transaction.amount,
      category: transaction.category,
      description: transaction.description,
      date: transaction.date,
    });
    setEditingId(transaction.id);
    setDialogError("");
    setDialog("edit");
  }

  async function saveTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setDialogError("");
    setSaving(true);
    try {
      const response =
        dialog === "edit" && editingId
          ? await api.updateTransaction(editingId, form)
          : await api.createTransaction(form);
      setNotice(localizedNotice(response, t));
      setDialog(null);
      setForm(defaultTransaction());
      setEditingId(null);
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
      const response = await api.deleteTransaction(pendingDelete.id);
      setNotice(localizedNotice(response, t));
      setPendingDelete(null);
      load();
    } catch (err) {
      setDialogError(readError(err, t));
    } finally {
      setSaving(false);
    }
  }

  async function previewTransactions(csvText: string) {
    setImportError("");
    setImportResult(null);
    setImportPreview(null);
    setPreviewing(true);
    try {
      const response = await api.previewTransactionsCsv(csvText);
      setImportPreview(response);
    } catch (err) {
      setImportError(readError(err, t));
    } finally {
      setPreviewing(false);
    }
  }

  async function importTransactions(csvText: string, allowDuplicates = false) {
    setImportError("");
    setImportResult(null);
    setImporting(true);
    try {
      const response = await api.importTransactionsCsvWithOptions(
        csvText,
        allowDuplicates,
      );
      setImportResult(response);
      setNotice(localizedNotice(response, t));
      setImportPreview(null);
      load();
    } catch (err) {
      setImportError(readError(err, t));
    } finally {
      setImporting(false);
    }
  }

  const detailLabel = loading
    ? t("transactions.historyDetail.loading")
    : t("transactions.historyDetail.count", { count: transactions.length });

  return (
    <>
      <PageHeader
        eyebrow={tUpper("transactions.title")}
        title={t("transactions.title")}
        summary={t("transactions.summary")}
        actions={
          <div className="action-cluster">
            <ActionButton icon={Plus} onClick={openCreate}>
              {t("common.addEntry")}
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

      {error ? <ErrorBanner message={error} /> : null}

      <section className="tracker-grid">
        <TransactionFilterForm
          filters={filters}
          selectedPeriod={selectedPeriod}
          onChange={(next) => {
            writeFilters(next);
            setFilters(next);
          }}
        />

        <Panel
          title={t("transactions.historyTitle")}
          detail={detailLabel}
          actions={
            <DownloadLink
              icon={Download}
              href={api.transactionCsvExportUrl(filters)}
              download
              variant="secondary"
            >
              {t("common.exportCsv")}
            </DownloadLink>
          }
        >
          {loading ? (
            <TableSkeleton rows={5} />
          ) : (
            <TransactionTable
              transactions={transactions}
              onEdit={openEdit}
              onDelete={setPendingDelete}
            />
          )}
        </Panel>
      </section>

      <CsvImportDialog
        open={importOpen}
        title={t("csv.importTitle")}
        description={t("csv.importDesc")}
        preview={importPreview}
        result={importResult}
        error={importError}
        uploading={importing}
        previewing={previewing}
        onClose={() => setImportOpen(false)}
        onPreview={previewTransactions}
        onImport={importTransactions}
        onReset={() => {
          setImportError("");
          setImportResult(null);
          setImportPreview(null);
        }}
      />

      <TransactionFormDialog
        open={dialog !== null}
        mode={dialog ?? "create"}
        form={form}
        error={dialogError}
        saving={saving}
        onClose={() => setDialog(null)}
        onSubmit={saveTransaction}
        onChange={setForm}
      />

      <ModalDialog
        open={pendingDelete !== null}
        title={t("transactions.dialog.deleteTitle")}
        description={
          pendingDelete
            ? t("transactions.dialog.deleteDescription", {
                category: pendingDelete.category,
                amount: money(pendingDelete.amount),
              })
            : undefined
        }
        onClose={() => {
          setPendingDelete(null);
          setDialogError("");
        }}
      >
        {dialogError ? <ErrorBanner message={dialogError} /> : null}
        <p className="dialog-copy">
          {t("transactions.dialog.deleteConfirmText")}
        </p>
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
            disabled={saving}
            onClick={confirmDelete}
          >
            <Trash2 aria-hidden="true" size={18} />
            <span>{t("transactions.dialog.deleteBtn")}</span>
          </button>
        </div>
      </ModalDialog>

      <datalist id="category-suggestions">
        {categories.map((cat) => (
          <option key={cat} value={cat} />
        ))}
      </datalist>
    </>
  );
}

function TransactionFilterForm({
  filters,
  selectedPeriod,
  onChange,
}: {
  filters: TransactionFilters;
  selectedPeriod: { month: number; year: number };
  onChange: (filters: TransactionFilters) => void;
}) {
  const [categorySearch, setCategorySearch] = useState(filters.category || "");
  const debouncedCategory = useDebounce(categorySearch, 250);
  const { t } = useI18n();

  useEffect(() => {
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
          onChange={(nextPeriod) => onChange({ ...filters, ...nextPeriod })}
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
                transaction_type: event.target.value as TransactionType | "",
              })
            }
          >
            <option value="">{t("common.all")}</option>
            <option value="expense">{t("common.expense")}</option>
            <option value="income">{t("common.income")}</option>
          </select>
        </Field>
        <div className="filter-actions">
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

function TransactionFormDialog({
  open,
  mode,
  form,
  error,
  saving,
  onClose,
  onSubmit,
  onChange,
}: {
  open: boolean;
  mode: Exclude<TransactionDialog, null>;
  form: TransactionInput;
  error: string;
  saving: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onChange: (form: TransactionInput) => void;
}) {
  const { t } = useI18n();

  return (
    <ModalDialog
      open={open}
      title={
        mode === "edit"
          ? t("transactions.dialog.editTitle")
          : t("transactions.dialog.addTitle")
      }
      description={t("transactions.dialog.addDescription")}
      onClose={onClose}
    >
      {error ? <ErrorBanner message={error} /> : null}
      <form className="dialog-form" onSubmit={onSubmit}>
        <fieldset className="segmented-field">
          <legend>{t("common.type")}</legend>
          <label>
            <input
              name="transaction-type"
              type="radio"
              value="expense"
              checked={form.type === "expense"}
              onChange={() => onChange({ ...form, type: "expense" })}
            />
            <span>{t("common.expense")}</span>
          </label>
          <label>
            <input
              name="transaction-type"
              type="radio"
              value="income"
              checked={form.type === "income"}
              onChange={() => onChange({ ...form, type: "income" })}
            />
            <span>{t("common.income")}</span>
          </label>
        </fieldset>
        <Field
          id="transaction-amount"
          label={t("common.amount")}
          hint={t("transactions.dialog.amountHint")}
        >
          <input
            id="transaction-amount"
            aria-describedby="transaction-amount-hint"
            inputMode="decimal"
            required
            value={form.amount}
            onChange={(event) =>
              onChange({ ...form, amount: event.target.value })
            }
          />
        </Field>
        <Field
          id="transaction-category"
          label={t("common.category")}
          hint={t("transactions.dialog.categoryHint")}
        >
          <input
            id="transaction-category"
            aria-describedby="transaction-category-hint"
            required
            list="category-suggestions"
            value={form.category}
            onChange={(event) =>
              onChange({ ...form, category: event.target.value })
            }
          />
        </Field>
        <Field id="transaction-date" label={t("common.date")}>
          <input
            id="transaction-date"
            type="date"
            required
            value={form.date}
            onChange={(event) =>
              onChange({ ...form, date: event.target.value })
            }
          />
        </Field>
        <Field id="transaction-description" label={t("common.description")}>
          <input
            id="transaction-description"
            value={form.description}
            onChange={(event) =>
              onChange({ ...form, description: event.target.value })
            }
          />
        </Field>
        <div className="dialog-actions">
          <button className="button secondary" type="button" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <SubmitButton busy={saving} icon={Save}>
            {mode === "edit" ? t("common.save") : t("common.addEntry")}
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
