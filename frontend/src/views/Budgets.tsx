import { FormEvent, useEffect, useState } from "react";
import { Filter, PiggyBank, RotateCcw, Save, Trash2 } from "lucide-react";
import { api, type BudgetFilters } from "../api";
import { BudgetPressureList } from "../components/Lists";
import { BudgetTable } from "../components/Tables";
import {
  ErrorBanner,
  Field,
  IconButton,
  ModalDialog,
  PageHeader,
  Panel,
  SubmitButton
} from "../components/ui";
import { money, monthNames } from "../format";
import type { BudgetInput, BudgetRecord, BudgetStatus } from "../types";

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

  const load = () => {
    const month = Number(filters.month || selectedPeriod.month);
    const year = Number(filters.year || selectedPeriod.year);
    setError("");
    Promise.all([api.budgets(filters), api.budgetStatuses(month, year)])
      .then(([budgetResponse, statusResponse]) => {
        setBudgets(budgetResponse.budgets);
        setStatuses(statusResponse.statuses);
      })
      .catch((err: Error) => setError(readError(err)));
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
      setDialogError(readError(err));
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
      setDialogError(readError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Pressure"
        title="Budgets"
        summary="Watch category limits first, then maintain the records behind them."
        actions={
          <IconButton icon={PiggyBank} onClick={openCreate}>
            Set budget
          </IconButton>
        }
      />

      {error ? <ErrorBanner message={error} /> : null}

      <section className="budget-layout">
        <Panel title="Budget pressure" detail={`${filters.month}/${filters.year}`}>
          <BudgetPressureList statuses={statuses} />
        </Panel>

        <Panel title="Filters" detail="Choose the period and category">
          <BudgetFilterForm filters={filters} selectedPeriod={selectedPeriod} onChange={setFilters} />
        </Panel>

        <Panel title="Budget records" detail={`${budgets.length} records shown`} className="records-panel">
          <BudgetTable budgets={budgets} onEdit={openEdit} onDelete={setPendingDelete} />
        </Panel>
      </section>

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
        title="Delete budget"
        description={pendingDelete ? `${pendingDelete.category} ${money(pendingDelete.amount)}` : undefined}
        onClose={() => {
          setPendingDelete(null);
          setDialogError("");
        }}
      >
        {dialogError ? <ErrorBanner message={dialogError} /> : null}
        <p className="dialog-copy">This removes the budget record from the local SQLite ledger.</p>
        <div className="dialog-actions">
          <button className="button secondary" type="button" onClick={() => setPendingDelete(null)}>
            Cancel
          </button>
          <button className="button danger" type="button" disabled={saving} onClick={confirmDelete}>
            <Trash2 aria-hidden="true" size={18} />
            <span>Delete budget</span>
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

  useEffect(() => {
    setDraft(filters);
  }, [filters]);

  return (
    <div role="search">
      <form
        className="filter-form compact"
        aria-label="Filter budgets"
        onSubmit={(event) => {
          event.preventDefault();
          onChange(draft);
        }}
      >
        <Field id="budget-filter-month" label="Month">
          <select
            id="budget-filter-month"
            value={draft.month}
            onChange={(event) => setDraft({ ...draft, month: Number(event.target.value) })}
          >
            {monthNames.slice(1).map((name, index) => (
              <option key={name} value={index + 1}>
                {name}
              </option>
            ))}
          </select>
        </Field>
        <Field id="budget-filter-year" label="Year">
          <input
            id="budget-filter-year"
            min="1"
            type="number"
            value={draft.year}
            onChange={(event) => setDraft({ ...draft, year: Number(event.target.value) })}
          />
        </Field>
        <Field id="budget-filter-category" label="Category">
          <input
            id="budget-filter-category"
            type="search"
            value={draft.category}
            onChange={(event) => setDraft({ ...draft, category: event.target.value })}
          />
        </Field>
        <div className="filter-actions">
          <button className="button primary" type="submit">
            <Filter aria-hidden="true" size={18} />
            <span>Apply filters</span>
          </button>
          <button
            className="button ghost"
            type="button"
            onClick={() =>
              onChange({
                month: selectedPeriod.month,
                year: selectedPeriod.year,
                category: ""
              })
            }
          >
            <RotateCcw aria-hidden="true" size={18} />
            <span>Reset</span>
          </button>
        </div>
      </form>
    </div>
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
  return (
    <ModalDialog
      open={open}
      title={mode === "edit" ? "Update budget" : "Set budget"}
      description="One category can have one budget per month."
      onClose={onClose}
    >
      {error ? <ErrorBanner message={error} /> : null}
      <form className="dialog-form" onSubmit={onSubmit}>
        <Field id="budget-category" label="Category" hint="Category matching is case-insensitive.">
          <input
            id="budget-category"
            aria-describedby="budget-category-hint"
            required
            value={form.category}
            onChange={(event) => onChange({ ...form, category: event.target.value })}
          />
        </Field>
        <Field id="budget-amount" label="Amount" hint="Use a positive amount, such as 500.00.">
          <input
            id="budget-amount"
            aria-describedby="budget-amount-hint"
            inputMode="decimal"
            required
            value={form.amount}
            onChange={(event) => onChange({ ...form, amount: event.target.value })}
          />
        </Field>
        <Field id="budget-month" label="Month">
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
        <Field id="budget-year" label="Year">
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
            Cancel
          </button>
          <SubmitButton busy={saving} icon={Save}>
            {mode === "edit" ? "Save changes" : "Save budget"}
          </SubmitButton>
        </div>
      </form>
    </ModalDialog>
  );
}

function readError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "The request could not be completed.";
}
