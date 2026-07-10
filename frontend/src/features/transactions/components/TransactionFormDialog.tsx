import { Save } from "lucide-react";
import type { FormEvent } from "react";
import type { TransactionInput } from "../../../types";
import { SubmitButton } from "../../../shared/components/actions";
import { ModalDialog } from "../../../shared/components/dialogs";
import { ErrorBanner } from "../../../shared/components/feedback";
import { Field } from "../../../shared/components/fields";
import { useI18n } from "../../../shared/i18n/I18nProvider";

type TransactionDialogMode = "create" | "edit";

export function TransactionFormDialog({
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
  mode: TransactionDialogMode;
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
