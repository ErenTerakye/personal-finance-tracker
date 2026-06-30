import { FormEvent, useEffect, useState } from "react";
import { Filter, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { api, type TransactionFilters } from "../api";
import { TransactionTable } from "../components/Tables";
import {
  EmptyState,
  ErrorBanner,
  Field,
  IconButton,
  ModalDialog,
  PageHeader,
  Panel,
  SubmitButton
} from "../components/ui";
import { money, monthNames, todayIso } from "../format";
import type { TransactionInput, TransactionRecord, TransactionType } from "../types";

type TransactionDialog = "create" | "edit" | null;

const defaultTransaction = (): TransactionInput => ({
  type: "expense",
  amount: "",
  category: "",
  description: "",
  date: todayIso()
});

export function TransactionsView({
  selectedPeriod,
  setNotice
}: {
  selectedPeriod: { month: number; year: number };
  setNotice: (notice: string) => void;
}) {
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [filters, setFilters] = useState<TransactionFilters>({
    month: selectedPeriod.month,
    year: selectedPeriod.year,
    transaction_type: "",
    category: ""
  });
  const [form, setForm] = useState<TransactionInput>(defaultTransaction);
  const [dialog, setDialog] = useState<TransactionDialog>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<TransactionRecord | null>(null);
  const [error, setError] = useState("");
  const [dialogError, setDialogError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () => {
    setError("");
    api
      .transactions(filters)
      .then((response) => setTransactions(response.transactions))
      .catch((err: Error) => setError(readError(err)));
  };

  useEffect(load, [filters]);

  useEffect(() => {
    setFilters((current) => ({
      ...current,
      month: selectedPeriod.month,
      year: selectedPeriod.year
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
      type: transaction.type,
      amount: transaction.amount,
      category: transaction.category,
      description: transaction.description,
      date: transaction.date
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
      setNotice(response.notice);
      setDialog(null);
      setForm(defaultTransaction());
      setEditingId(null);
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
      const response = await api.deleteTransaction(pendingDelete.id);
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
        eyebrow="Ledger"
        title="Transactions"
        summary="Post entries quickly, then review the ledger as stable records."
        actions={
          <IconButton icon={Plus} onClick={openCreate}>
            Add entry
          </IconButton>
        }
      />

      {error ? <ErrorBanner message={error} /> : null}

      <section className="workbench-grid">
        <Panel title="Filters" detail="Scope the local ledger">
          <TransactionFilterForm
            filters={filters}
            selectedPeriod={selectedPeriod}
            onChange={setFilters}
          />
        </Panel>

        <Panel title="Ledger records" detail={`${transactions.length} transactions shown`}>
          <TransactionTable
            transactions={transactions}
            onEdit={openEdit}
            onDelete={setPendingDelete}
          />
        </Panel>
      </section>

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
        title="Delete transaction"
        description={pendingDelete ? `${pendingDelete.category} ${money(pendingDelete.amount)}` : undefined}
        onClose={() => {
          setPendingDelete(null);
          setDialogError("");
        }}
      >
        {dialogError ? <ErrorBanner message={dialogError} /> : null}
        <p className="dialog-copy">
          This removes the record from the local SQLite ledger.
        </p>
        <div className="dialog-actions">
          <button className="button secondary" type="button" onClick={() => setPendingDelete(null)}>
            Cancel
          </button>
          <button className="button danger" type="button" disabled={saving} onClick={confirmDelete}>
            <Trash2 aria-hidden="true" size={18} />
            <span>Delete transaction</span>
          </button>
        </div>
      </ModalDialog>
    </>
  );
}

function TransactionFilterForm({
  filters,
  selectedPeriod,
  onChange
}: {
  filters: TransactionFilters;
  selectedPeriod: { month: number; year: number };
  onChange: (filters: TransactionFilters) => void;
}) {
  const [draft, setDraft] = useState(filters);

  useEffect(() => {
    setDraft(filters);
  }, [filters]);

  return (
    <div role="search">
      <form
        className="filter-form compact"
        aria-label="Filter transactions"
        onSubmit={(event) => {
          event.preventDefault();
          onChange(draft);
        }}
      >
        <Field id="filter-month" label="Month">
          <select
            id="filter-month"
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
        <Field id="filter-year" label="Year">
          <input
            id="filter-year"
            min="1"
            type="number"
            value={draft.year}
            onChange={(event) => setDraft({ ...draft, year: Number(event.target.value) })}
          />
        </Field>
        <Field id="filter-category" label="Category">
          <input
            id="filter-category"
            type="search"
            value={draft.category}
            onChange={(event) => setDraft({ ...draft, category: event.target.value })}
          />
        </Field>
        <Field id="filter-type" label="Type">
          <select
            id="filter-type"
            value={draft.transaction_type}
            onChange={(event) =>
              setDraft({ ...draft, transaction_type: event.target.value as TransactionType | "" })
            }
          >
            <option value="">All</option>
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </select>
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
                transaction_type: "",
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

function TransactionFormDialog({
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
  mode: Exclude<TransactionDialog, null>;
  form: TransactionInput;
  error: string;
  saving: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onChange: (form: TransactionInput) => void;
}) {
  return (
    <ModalDialog
      open={open}
      title={mode === "edit" ? "Edit transaction" : "Add transaction"}
      description="Amounts are saved as decimal strings in the local database."
      onClose={onClose}
    >
      {error ? <ErrorBanner message={error} /> : null}
      <form className="dialog-form" onSubmit={onSubmit}>
        <fieldset className="segmented-field">
          <legend>Type</legend>
          <label>
            <input
              name="transaction-type"
              type="radio"
              value="expense"
              checked={form.type === "expense"}
              onChange={() => onChange({ ...form, type: "expense" })}
            />
            <span>Expense</span>
          </label>
          <label>
            <input
              name="transaction-type"
              type="radio"
              value="income"
              checked={form.type === "income"}
              onChange={() => onChange({ ...form, type: "income" })}
            />
            <span>Income</span>
          </label>
        </fieldset>
        <Field id="transaction-amount" label="Amount" hint="Use a positive amount, such as 45.90.">
          <input
            id="transaction-amount"
            aria-describedby="transaction-amount-hint"
            inputMode="decimal"
            required
            value={form.amount}
            onChange={(event) => onChange({ ...form, amount: event.target.value })}
          />
        </Field>
        <Field id="transaction-category" label="Category" hint="Match category spelling for clean reports.">
          <input
            id="transaction-category"
            aria-describedby="transaction-category-hint"
            required
            value={form.category}
            onChange={(event) => onChange({ ...form, category: event.target.value })}
          />
        </Field>
        <Field id="transaction-date" label="Date">
          <input
            id="transaction-date"
            type="date"
            required
            value={form.date}
            onChange={(event) => onChange({ ...form, date: event.target.value })}
          />
        </Field>
        <Field id="transaction-description" label="Description">
          <input
            id="transaction-description"
            value={form.description}
            onChange={(event) => onChange({ ...form, description: event.target.value })}
          />
        </Field>
        <div className="dialog-actions">
          <button className="button secondary" type="button" onClick={onClose}>
            Cancel
          </button>
          <SubmitButton busy={saving} icon={Save}>
            {mode === "edit" ? "Save changes" : "Add entry"}
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
