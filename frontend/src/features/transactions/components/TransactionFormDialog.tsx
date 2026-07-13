import { AlignLeft, CalendarDays, Save, Tags, WalletCards } from "lucide-react";
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
      className="entry-dialog"
    >
      {error ? <ErrorBanner message={error} /> : null}
      <form className="dialog-form entry-form" onSubmit={onSubmit}>
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
            <span className="expense-option">{t("common.expense")}</span>
          </label>
          <label>
            <input
              name="transaction-type"
              type="radio"
              value="income"
              checked={form.type === "income"}
              onChange={() => onChange({ ...form, type: "income" })}
            />
            <span className="income-option">{t("common.income")}</span>
          </label>
        </fieldset>
        <Field
          id="transaction-amount"
          label={t("common.amount")}
          hint={t("transactions.dialog.amountHint")}
          className="amount-field"
        >
          <input
            id="transaction-amount"
            aria-describedby="transaction-amount-hint"
            inputMode="decimal"
            autoFocus={mode === "create"}
            autoComplete="off"
            enterKeyHint="next"
            required
            value={form.amount}
            onChange={(event) =>
              onChange({ ...form, amount: event.target.value })
            }
          />
        </Field>
        <div className="entry-form-details">
          <Field
            id="transaction-category"
            label={t("common.category")}
            hint={t("transactions.dialog.categoryHint")}
          >
            <span className="input-with-icon">
              <Tags aria-hidden="true" size={18} />
              <input
                id="transaction-category"
                aria-describedby="transaction-category-hint"
                required
                list="category-suggestions"
                autoComplete="off"
                enterKeyHint="next"
                value={form.category}
                onChange={(event) =>
                  onChange({ ...form, category: event.target.value })
                }
              />
            </span>
          </Field>
          <Field id="transaction-date" label={t("common.date")}>
            <span className="input-with-icon">
              <CalendarDays aria-hidden="true" size={18} />
              <input
                id="transaction-date"
                type="date"
                required
                value={form.date}
                onChange={(event) =>
                  onChange({ ...form, date: event.target.value })
                }
              />
            </span>
          </Field>
          <Field
            id="transaction-description"
            label={t("common.description")}
            className="entry-form-wide"
          >
            <span className="input-with-icon">
              <AlignLeft aria-hidden="true" size={18} />
              <input
                id="transaction-description"
                autoComplete="off"
                enterKeyHint="done"
                value={form.description}
                onChange={(event) =>
                  onChange({ ...form, description: event.target.value })
                }
              />
            </span>
          </Field>
        </div>
        <p className="entry-form-note">
          <WalletCards aria-hidden="true" size={16} />
          {t("transactions.dialog.localNote")}
        </p>
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
