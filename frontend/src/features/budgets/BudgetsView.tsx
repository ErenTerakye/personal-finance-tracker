import { FormEvent, useEffect, useState } from "react";
import { Download, PiggyBank, Trash2, Upload } from "lucide-react";
import type { BudgetFilters } from "../../api/client";
import { artifactUrls } from "../../api/artifacts";
import { CsvImportDialog } from "../../shared/components/CsvImportDialog";
import { BudgetTable } from "../../shared/components/tables";
import { ActionButton, DownloadLink } from "../../shared/components/actions";
import { ModalDialog } from "../../shared/components/dialogs";
import { ErrorBanner } from "../../shared/components/feedback";
import {
  BudgetPressureList,
  PageHeader,
  Panel,
} from "../../shared/components/lists";
import { money } from "../../shared/format/money";
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

type BudgetDialog = "create" | "edit" | null;

export function BudgetsView({
  selectedPeriod,
  setSelectedPeriod,
  setNotice,
}: {
  selectedPeriod: { month: number; year: number };
  setSelectedPeriod: (period: { month: number; year: number }) => void;
  setNotice: (notice: string) => void;
}) {
  const [filters, setFilters] = useState<BudgetFilters>(() =>
    readBudgetFilters(selectedPeriod),
  );
  const [form, setForm] = useState<BudgetInput>(defaultBudget(selectedPeriod));
  const [dialog, setDialog] = useState<BudgetDialog>(null);
  const [pendingDelete, setPendingDelete] = useState<BudgetRecord | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const { t, tUpper } = useI18n();
  const budgetResource = useBudgets(filters, selectedPeriod);
  const budgets = budgetResource.data?.budgets ?? [];
  const statuses = budgetResource.data?.statuses ?? [];
  const loading = budgetResource.status === "loading";
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

  const pressureDetail = loading
    ? t("budgets.pressureLoading")
    : `${filters.month}/${filters.year}`;

  const recordsDetail = loading
    ? t("budgets.recordsLoading")
    : t("budgets.recordsCount", { count: budgets.length });

  return (
    <>
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
        <Panel title={t("budgets.pressureTitle")} detail={pressureDetail}>
          {loading ? (
            <p className="loading-state">{t("budgets.pressureLoading")}</p>
          ) : (
            <BudgetPressureList statuses={statuses} />
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
          title={t("budgets.recordsTitle")}
          detail={recordsDetail}
          className="records-panel"
          actions={
            <DownloadLink
              icon={Download}
              href={artifactUrls.budgetsCsv(filters)}
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
            <BudgetTable
              budgets={budgets}
              onEdit={openEdit}
              onDelete={setPendingDelete}
            />
          )}
        </Panel>
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
    </>
  );
}
