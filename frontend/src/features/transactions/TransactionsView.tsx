import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import "./transactions-components.css";
import "./transactions.css";
import "./transactions-overrides.css";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Download,
  MoreHorizontal,
  Plus,
  Search,
  Scale,
  Trash2,
  Upload,
} from "lucide-react";
import type { TransactionFilters } from "../../api/client";
import { artifactUrls } from "../../api/artifacts";
import { CsvImportDialog } from "../../shared/components/CsvImportDialog";
import { TableSkeleton } from "../../shared/components/tables";
import { ActionButton, DownloadLink } from "../../shared/components/actions";
import { ModalDialog } from "../../shared/components/dialogs";
import { ErrorBanner } from "../../shared/components/feedback";
import { PageHeader } from "../../shared/components/lists";
import { money } from "../../shared/format/money";
import { periodLabel } from "../../shared/format/periods";
import type {
  TransactionInput,
  TransactionRecord,
  TransactionType,
} from "../../types";
import { localizedNotice } from "../../shared/i18n/notices";
import { useI18n } from "../../shared/i18n/I18nProvider";
import {
  defaultTransaction,
  readTransactionFilters,
  writeTransactionFilters,
} from "./transactionForm";
import {
  useDeleteTransaction,
  useSaveTransaction,
  useTransactionImport,
  useTransactionPreview,
  useTransactionCategories,
  useTransactions,
  preloadTransactions,
} from "./useTransactions";
import { TransactionFilterForm } from "./components/TransactionFilterForm";
import { TransactionFormDialog } from "./components/TransactionFormDialog";
import { ActivityLedger } from "./components/ActivityLedger";

type TransactionDialog = "create" | "edit" | null;

export function preloadTransactionsView(period: {
  month: number;
  year: number;
}) {
  return preloadTransactions(readTransactionFilters(period));
}

export function TransactionsView({
  selectedPeriod,
  setNotice,
  createRequestId = 0,
  locationVersion = 0,
}: {
  selectedPeriod: { month: number; year: number };
  setNotice: (notice: string) => void;
  createRequestId?: number;
  locationVersion?: number;
}) {
  const [filters, setFilters] = useState<TransactionFilters>(() =>
    readTransactionFilters(selectedPeriod),
  );
  const [form, setForm] = useState<TransactionInput>(defaultTransaction);
  const [dialog, setDialog] = useState<TransactionDialog>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<TransactionRecord | null>(
    null,
  );
  const [importOpen, setImportOpen] = useState(false);
  const [search, setSearch] = useState(() => readSearchParam());
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const ledgerHeadingRef = useRef<HTMLElement>(null);
  const handledCreateRequest = useRef(0);
  const { t } = useI18n();
  const transactionResource = useTransactions(filters);
  const categoryResource = useTransactionCategories();
  const transactions = transactionResource.data?.transactions ?? [];
  const visibleTransactions = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    const matches = query
      ? transactions.filter((transaction) =>
          [
            transaction.category,
            transaction.description,
            transaction.amount,
            transaction.date,
            transaction.type,
          ].some((value) => String(value).toLocaleLowerCase().includes(query)),
        )
      : [...transactions];
    return matches.sort((a, b) => {
      const byDate = b.date.localeCompare(a.date) || b.id - a.id;
      return sort === "oldest" ? -byDate : byDate;
    });
  }, [search, sort, transactions]);
  const loading = transactionResource.status === "loading";
  const categories = useMemo(
    () =>
      Array.from(
        new Set([
          ...(categoryResource.data ?? []),
          ...transactions.map((transaction) => transaction.category),
        ]),
      )
        .filter(Boolean)
        .sort(),
    [categoryResource.data, transactions],
  );
  const saveMutation = useSaveTransaction((response) => {
    setNotice(localizedNotice(response, t));
    setDialog(null);
    setForm(defaultTransaction());
    setEditingId(null);
    transactionResource.refetch();
  });
  const deleteMutation = useDeleteTransaction((response) => {
    setNotice(localizedNotice(response, t));
    setPendingDelete(null);
    transactionResource.refetch();
    requestAnimationFrame(() => ledgerHeadingRef.current?.focus());
  });
  const previewMutation = useTransactionPreview();
  const importMutation = useTransactionImport((response) => {
    setNotice(localizedNotice(response, t));
    previewMutation.reset();
    transactionResource.refetch();
  });

  function openCreate() {
    setForm(defaultTransaction());
    setEditingId(null);
    saveMutation.reset();
    setDialog("create");
  }

  useEffect(() => {
    setFilters((current) => ({
      ...current,
      month: selectedPeriod.month,
      year: selectedPeriod.year,
    }));
  }, [selectedPeriod.month, selectedPeriod.year]);

  useEffect(() => {
    window.addEventListener("finance-tracker:add-transaction", openCreate);
    return () =>
      window.removeEventListener("finance-tracker:add-transaction", openCreate);
  });

  useEffect(() => {
    if (createRequestId <= handledCreateRequest.current) return;
    handledCreateRequest.current = createRequestId;
    openCreate();
  }, [createRequestId]);

  useEffect(() => {
    setFilters(readTransactionFilters(selectedPeriod));
    setSearch(readSearchParam());
    setImportOpen(
      new URLSearchParams(window.location.search).get("data") === "import",
    );
  }, [locationVersion, selectedPeriod]);

  useEffect(() => {
    const closeTransientUi = () => {
      setDialog(null);
      setEditingId(null);
      setPendingDelete(null);
      setImportOpen(false);
    };
    window.addEventListener("finance-tracker:route-leave", closeTransientUi);
    return () =>
      window.removeEventListener(
        "finance-tracker:route-leave",
        closeTransientUi,
      );
  }, []);

  function openEdit(transaction: TransactionRecord) {
    setForm({
      type: transaction.type as TransactionType,
      amount: transaction.amount,
      category: transaction.category,
      description: transaction.description,
      date: transaction.date,
    });
    setEditingId(transaction.id);
    saveMutation.reset();
    setDialog("edit");
  }

  function saveTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void saveMutation.mutate({
      id: dialog === "edit" ? (editingId ?? undefined) : undefined,
      payload: form,
    });
  }

  function confirmDelete() {
    if (!pendingDelete) {
      return;
    }
    void deleteMutation.mutate(pendingDelete.id);
  }

  function clearSearchAndFilters() {
    const next = {
      month: selectedPeriod.month,
      year: selectedPeriod.year,
      transaction_type: "" as const,
      category: "",
    };
    setSearch("");
    writeSearchParam("");
    writeTransactionFilters(next);
    setFilters(next);
  }

  async function previewTransactions(csvText: string) {
    importMutation.reset();
    previewMutation.reset();
    await previewMutation.mutate(csvText);
  }

  async function importTransactions(csvText: string, allowDuplicates = false) {
    importMutation.reset();
    await importMutation.mutate({ csvText, allowDuplicates });
  }

  const detailLabel = loading
    ? t("transactions.historyDetail.loading")
    : t("transactions.historyDetail.count", {
        count: visibleTransactions.length,
      });

  const activeFilterLabels = [
    Number(filters.month) !== selectedPeriod.month ||
    Number(filters.year) !== selectedPeriod.year
      ? `${filters.year}-${String(filters.month).padStart(2, "0")}`
      : null,
    filters.category ? `${t("common.category")}: ${filters.category}` : null,
    filters.transaction_type ? t(`common.${filters.transaction_type}`) : null,
  ].filter((label): label is string => Boolean(label));

  const activitySummary = visibleTransactions.reduce(
    (summary, transaction) => {
      const amount = Number(transaction.amount);
      if (transaction.type === "income") summary.income += amount;
      else summary.expenses += amount;
      return summary;
    },
    { income: 0, expenses: 0 },
  );
  const netActivity = activitySummary.income - activitySummary.expenses;
  const hasRefinements = Boolean(search.trim() || activeFilterLabels.length);

  return (
    <>
      <PageHeader
        eyebrow={t("transactions.eyebrow")}
        title={t("transactions.title")}
        summary={t("transactions.routeSummary", {
          count: visibleTransactions.length,
          period: periodLabel(Number(filters.month), Number(filters.year)),
        })}
        className="activity-hero"
        actions={
          <div className="activity-hero-actions">
            <ActionButton icon={Plus} onClick={openCreate}>
              {t("common.addTransaction")}
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
                  href={artifactUrls.transactionsCsv(filters)}
                  download
                  variant="ghost"
                >
                  {t("common.exportCsv")}
                </DownloadLink>
                <p>{t("transactions.exportScope")}</p>
              </div>
            </details>
          </div>
        }
      />

      {transactionResource.status === "error" ? (
        <ErrorBanner
          message={transactionResource.error.message}
          onRetry={transactionResource.refetch}
        />
      ) : null}

      <section
        className="activity-workspace"
        aria-label={t("transactions.title")}
      >
        <section
          className="activity-snapshot"
          aria-label={t("transactions.snapshot.title")}
        >
          <article className="activity-stat income">
            <span className="activity-stat-icon">
              <ArrowDownLeft aria-hidden="true" size={20} />
            </span>
            <div>
              <span>{t("transactions.snapshot.income")}</span>
              <strong>{money(activitySummary.income)}</strong>
            </div>
          </article>
          <article className="activity-stat expense">
            <span className="activity-stat-icon">
              <ArrowUpRight aria-hidden="true" size={20} />
            </span>
            <div>
              <span>{t("transactions.snapshot.expenses")}</span>
              <strong>{money(activitySummary.expenses)}</strong>
            </div>
          </article>
          <article
            className={`activity-stat net ${netActivity < 0 ? "negative" : "positive"}`}
          >
            <span className="activity-stat-icon">
              <Scale aria-hidden="true" size={20} />
            </span>
            <div>
              <span>{t("transactions.snapshot.net")}</span>
              <strong>
                {netActivity > 0 ? "+" : netActivity < 0 ? "−" : ""}
                {money(Math.abs(netActivity))}
              </strong>
            </div>
          </article>
        </section>

        <div className="activity-command-bar">
          <label className="transaction-search" htmlFor="activity-search">
            <span>{t("transactions.searchLabel")}</span>
            <span className="search-control">
              <Search aria-hidden="true" size={18} />
              <input
                id="activity-search"
                type="search"
                value={search}
                placeholder={t("transactions.searchHint")}
                onChange={(event) => {
                  setSearch(event.target.value);
                  writeSearchParam(event.target.value);
                }}
              />
            </span>
          </label>
          <TransactionFilterForm
            filters={filters}
            selectedPeriod={selectedPeriod}
            onChange={(next) => {
              writeTransactionFilters(next);
              setFilters(next);
            }}
          />
          {hasRefinements ? (
            <div
              className="active-filter-summary"
              aria-label={t("transactions.filters.active")}
            >
              <span>{t("transactions.filters.active")}</span>
              {search.trim() ? (
                <span className="filter-chip">“{search.trim()}”</span>
              ) : null}
              {activeFilterLabels.map((label) => (
                <span className="filter-chip" key={label}>
                  {label}
                </span>
              ))}
              <button
                className="button ghost"
                type="button"
                onClick={clearSearchAndFilters}
              >
                {t("transactions.filters.clear")}
              </button>
            </div>
          ) : null}
        </div>

        <article
          className="activity-ledger"
          ref={ledgerHeadingRef}
          tabIndex={-1}
        >
          <header className="activity-ledger-header">
            <div>
              <p className="eyebrow">
                {periodLabel(Number(filters.month), Number(filters.year))}
              </p>
              <h2>{t("transactions.historyTitle")}</h2>
              <p aria-live="polite">{detailLabel}</p>
            </div>
            <label className="activity-sort" htmlFor="activity-sort">
              <span>{t("transactions.sort.label")}</span>
              <select
                id="activity-sort"
                value={sort}
                onChange={(event) => setSort(event.target.value as typeof sort)}
              >
                <option value="newest">{t("transactions.sort.newest")}</option>
                <option value="oldest">{t("transactions.sort.oldest")}</option>
              </select>
            </label>
          </header>
          <div className="activity-ledger-body">
            {loading ? (
              <TableSkeleton rows={5} />
            ) : (
              <ActivityLedger
                transactions={visibleTransactions}
                onEdit={openEdit}
                onDelete={setPendingDelete}
                onCreate={openCreate}
                filtered={hasRefinements}
                onClear={clearSearchAndFilters}
              />
            )}
          </div>
        </article>
      </section>

      <CsvImportDialog
        open={importOpen}
        title={t("csv.importTitle")}
        description={t("csv.importDesc")}
        preview={
          previewMutation.status === "success" ? previewMutation.data : null
        }
        result={
          importMutation.status === "success" ? importMutation.data : null
        }
        error={
          previewMutation.status === "error"
            ? previewMutation.error.message
            : importMutation.status === "error"
              ? importMutation.error.message
              : ""
        }
        uploading={importMutation.status === "pending"}
        previewing={previewMutation.status === "pending"}
        onClose={() => setImportOpen(false)}
        onPreview={previewTransactions}
        onImport={importTransactions}
        onReset={() => {
          importMutation.reset();
          previewMutation.reset();
        }}
      />

      <TransactionFormDialog
        open={dialog !== null}
        mode={dialog ?? "create"}
        form={form}
        error={
          saveMutation.status === "error" ? saveMutation.error.message : ""
        }
        saving={saveMutation.status === "pending"}
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
          deleteMutation.reset();
        }}
      >
        {deleteMutation.status === "error" ? (
          <ErrorBanner message={deleteMutation.error.message} />
        ) : null}
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
            disabled={deleteMutation.status === "pending"}
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

function readSearchParam(): string {
  return new URLSearchParams(window.location.search).get("search") ?? "";
}

function writeSearchParam(value: string) {
  const url = new URL(window.location.href);
  const normalized = value.trim();
  if (normalized) url.searchParams.set("search", normalized);
  else url.searchParams.delete("search");
  window.history.replaceState({}, "", `${url.pathname}${url.search}`);
}
