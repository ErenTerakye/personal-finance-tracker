import { CalendarRange, Save, Tags, Target } from "lucide-react";
import type { FormEvent } from "react";
import type { BudgetInput } from "../../../types";
import { SubmitButton } from "../../../shared/components/actions";
import { ModalDialog } from "../../../shared/components/dialogs";
import { ErrorBanner } from "../../../shared/components/feedback";
import { Field } from "../../../shared/components/fields";
import { monthNames } from "../../../shared/format/periods";
import { useI18n } from "../../../shared/i18n/I18nProvider";

type BudgetDialogMode = "create" | "edit";

export function BudgetFormDialog({
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
  mode: BudgetDialogMode;
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
      title={
        mode === "edit"
          ? t("budgets.dialog.updateTitle")
          : t("budgets.dialog.setTitle")
      }
      description={t("budgets.dialog.setDescription")}
      onClose={onClose}
      className="entry-dialog budget-entry-dialog"
    >
      {error ? <ErrorBanner message={error} /> : null}
      <form className="dialog-form entry-form" onSubmit={onSubmit}>
        <Field
          id="budget-category"
          label={t("common.category")}
          hint={t("budgets.dialog.categoryHint")}
        >
          <span className="input-with-icon">
            <Tags aria-hidden="true" size={18} />
            <input
              id="budget-category"
              autoFocus={mode === "create"}
              autoComplete="off"
              enterKeyHint="next"
              aria-describedby="budget-category-hint"
              required
              value={form.category}
              onChange={(event) =>
                onChange({ ...form, category: event.target.value })
              }
            />
          </span>
        </Field>
        <Field
          id="budget-amount"
          label={t("common.amount")}
          hint={t("budgets.dialog.amountHint")}
          className="amount-field"
        >
          <input
            id="budget-amount"
            aria-describedby="budget-amount-hint"
            inputMode="decimal"
            autoComplete="off"
            enterKeyHint="next"
            required
            value={form.amount}
            onChange={(event) =>
              onChange({ ...form, amount: event.target.value })
            }
          />
        </Field>
        <div className="entry-form-details budget-period-fields">
          <Field id="budget-month" label={t("common.month")}>
            <span className="input-with-icon">
              <CalendarRange aria-hidden="true" size={18} />
              <select
                id="budget-month"
                required
                value={form.month}
                onChange={(event) =>
                  onChange({ ...form, month: Number(event.target.value) })
                }
              >
                {monthNames.slice(1).map((name, index) => (
                  <option key={name} value={index + 1}>
                    {name}
                  </option>
                ))}
              </select>
            </span>
          </Field>
          <Field id="budget-year" label={t("common.year")}>
            <input
              id="budget-year"
              min="1"
              type="number"
              required
              value={form.year}
              onChange={(event) =>
                onChange({ ...form, year: Number(event.target.value) })
              }
            />
          </Field>
        </div>
        <p className="entry-form-note">
          <Target aria-hidden="true" size={16} />
          {t("budgets.dialog.trackingNote")}
        </p>
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
