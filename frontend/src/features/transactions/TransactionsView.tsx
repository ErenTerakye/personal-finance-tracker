import { FormEvent, useEffect, useMemo, useState } from "react";
import { Download, Plus, Trash2, Upload } from "lucide-react";
import type { TransactionFilters } from "../../api/client";
import { artifactUrls } from "../../api/artifacts";
import { CsvImportDialog } from "../../shared/components/CsvImportDialog";
import {
  TransactionTable,
  TableSkeleton,
} from "../../shared/components/tables";
import { ActionButton, DownloadLink } from "../../shared/components/actions";
import { ModalDialog } from "../../shared/components/dialogs";
import { ErrorBanner } from "../../shared/components/feedback";
import { PageHeader, Panel } from "../../shared/components/lists";
import { money } from "../../shared/format/money";
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
} from "./useTransactions";
import { TransactionFilterForm } from "./components/TransactionFilterForm";
import { TransactionFormDialog } from "./components/TransactionFormDialog";

type TransactionDialog = "create" | "edit" | null;

export function TransactionsView({
  selectedPeriod,
  setNotice,
}: {
  selectedPeriod: { month: number; year: number };
  setNotice: (notice: string) => void;
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
  const { t, tUpper } = useI18n();
  const transactionResource = useTransactions(filters);
  const categoryResource = useTransactionCategories();
  const transactions = transactionResource.data?.transactions ?? [];
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
  });
  const previewMutation = useTransactionPreview();
  const importMutation = useTransactionImport((response) => {
    setNotice(localizedNotice(response, t));
    previewMutation.reset();
    transactionResource.refetch();
  });

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
    saveMutation.reset();
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

      {transactionResource.status === "error" ? (
        <ErrorBanner message={transactionResource.error.message} />
      ) : null}

      <section className="tracker-grid">
        <TransactionFilterForm
          filters={filters}
          selectedPeriod={selectedPeriod}
          onChange={(next) => {
            writeTransactionFilters(next);
            setFilters(next);
          }}
        />

        <Panel
          title={t("transactions.historyTitle")}
          detail={detailLabel}
          actions={
            <DownloadLink
              icon={Download}
              href={artifactUrls.transactionsCsv(filters)}
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
