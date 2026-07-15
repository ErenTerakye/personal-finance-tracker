import {
  CalendarDays,
  Coins,
  ReceiptText,
  Save,
  Tags,
  Text,
} from "lucide-react";
import type { FormEvent } from "react";
import type { TransactionInput, TransactionType } from "../../../types";
import { SubmitButton } from "../../../shared/components/actions";
import { ModalDialog } from "../../../shared/components/dialogs";
import { ErrorBanner } from "../../../shared/components/feedback";
import { formatActivityDate } from "../../../shared/format/dates";
import { currencySymbol } from "../../../shared/format/money";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import { normalizeAmountDraft } from "../transactionForm";

type TransactionDialogMode = "create" | "edit";

const transactionKinds: {
  type: TransactionType;
  icon: typeof ReceiptText;
}[] = [
  { type: "expense", icon: ReceiptText },
  { type: "income", icon: Coins },
];

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
  const isExpense = form.type === "expense";
  const submitLabel =
    mode === "edit"
      ? t("transactions.dialog.saveChanges")
      : t(
          isExpense
            ? "transactions.dialog.addExpense"
            : "transactions.dialog.addIncome",
        );

  return (
    <ModalDialog
      open={open}
      title={
        mode === "edit"
          ? t("transactions.dialog.editTitle")
          : t("transactions.dialog.addTitle")
      }
      description={t(
        mode === "edit"
          ? "transactions.dialog.editDescription"
          : "transactions.dialog.addDescription",
      )}
      onClose={onClose}
      className={`entry-dialog entry-dialog-${form.type}`}
    >
      {error ? <ErrorBanner message={error} /> : null}
      <form className="entry-composer" onSubmit={onSubmit}>
        <fieldset className="entry-kind-picker">
          <legend>{t("transactions.dialog.kindLegend")}</legend>
          <div className="entry-kind-options">
            {transactionKinds.map(({ type, icon: Icon }) => (
              <label key={type} className={`entry-kind-option ${type}`}>
                <input
                  name="transaction-type"
                  type="radio"
                  value={type}
                  aria-label={t(`common.${type}`)}
                  checked={form.type === type}
                  onChange={() => onChange({ ...form, type })}
                />
                <span className="entry-kind-card">
                  <span className="entry-kind-icon" aria-hidden="true">
                    <Icon size={20} strokeWidth={2.2} />
                  </span>
                  <span className="entry-kind-copy">
                    <strong>{t(`common.${type}`)}</strong>
                    <small>{t(`transactions.dialog.${type}Description`)}</small>
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <section className="entry-amount-stage">
          <div className="entry-amount-heading">
            <label htmlFor="transaction-amount">{t("common.amount")}</label>
            <span>{t("transactions.dialog.amountSupport")}</span>
          </div>
          <div className="entry-amount-control">
            <span className="entry-currency" aria-hidden="true">
              {currencySymbol()}
            </span>
            <input
              id="transaction-amount"
              name="amount"
              aria-describedby="transaction-amount-hint transaction-amount-error"
              aria-errormessage="transaction-amount-error"
              inputMode="decimal"
              autoFocus={mode === "create"}
              autoComplete="off"
              enterKeyHint="next"
              placeholder="0.00"
              maxLength={64}
              pattern="(?=.*[1-9])[0-9]+(?:\.[0-9]{1,2})?"
              required
              value={form.amount}
              onChange={(event) => {
                const amount = normalizeAmountDraft(event.target.value);
                if (amount !== null) onChange({ ...form, amount });
              }}
            />
          </div>
          <p id="transaction-amount-hint" className="entry-amount-hint">
            {t("transactions.dialog.amountHint")}
          </p>
          <p id="transaction-amount-error" className="entry-field-error">
            {t("transactions.dialog.amountError")}
          </p>
        </section>

        <div className="entry-details">
          <div className="field entry-detail entry-category">
            <label htmlFor="transaction-category">{t("common.category")}</label>
            <p className="field-hint" id="transaction-category-hint">
              {t("transactions.dialog.categoryHint")}
            </p>
            <span className="entry-input-shell">
              <Tags aria-hidden="true" size={18} />
              <input
                id="transaction-category"
                name="category"
                aria-describedby="transaction-category-hint transaction-category-error"
                aria-errormessage="transaction-category-error"
                required
                list="category-suggestions"
                autoComplete="off"
                enterKeyHint="next"
                placeholder={t("transactions.dialog.categoryPlaceholder")}
                value={form.category}
                onChange={(event) =>
                  onChange({ ...form, category: event.target.value })
                }
              />
            </span>
            <p id="transaction-category-error" className="entry-field-error">
              {t("transactions.dialog.categoryError")}
            </p>
          </div>

          <div className="field entry-detail">
            <label htmlFor="transaction-date">{t("common.date")}</label>
            <p className="field-hint" aria-hidden="true">
              {formatActivityDate(form.date)}
            </p>
            <span className="entry-input-shell">
              <CalendarDays aria-hidden="true" size={18} />
              <input
                id="transaction-date"
                name="date"
                type="date"
                required
                value={form.date}
                onChange={(event) =>
                  onChange({ ...form, date: event.target.value })
                }
              />
            </span>
          </div>

          <div className="field entry-detail entry-description">
            <label htmlFor="transaction-description">
              {t("transactions.dialog.noteLabel")}
              <span>{t("transactions.dialog.optional")}</span>
            </label>
            <p className="field-hint" id="transaction-description-hint">
              {t("transactions.dialog.noteHint")}
            </p>
            <span className="entry-input-shell">
              <Text aria-hidden="true" size={18} />
              <input
                id="transaction-description"
                name="description"
                aria-describedby="transaction-description-hint"
                autoComplete="off"
                enterKeyHint="done"
                placeholder={t("transactions.dialog.notePlaceholder")}
                value={form.description}
                onChange={(event) =>
                  onChange({ ...form, description: event.target.value })
                }
              />
            </span>
          </div>
        </div>

        <footer className="entry-footer">
          <div className="entry-actions">
            <button
              className="button secondary"
              type="button"
              onClick={onClose}
            >
              {t("common.cancel")}
            </button>
            <SubmitButton busy={saving} icon={Save}>
              {submitLabel}
            </SubmitButton>
          </div>
        </footer>
      </form>
    </ModalDialog>
  );
}
