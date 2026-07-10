import { Save } from "lucide-react";
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
    >
      {error ? <ErrorBanner message={error} /> : null}
      <form className="dialog-form" onSubmit={onSubmit}>
        <Field
          id="budget-category"
          label={t("common.category")}
          hint={t("budgets.dialog.categoryHint")}
        >
          <input
            id="budget-category"
            aria-describedby="budget-category-hint"
            required
            value={form.category}
            onChange={(event) =>
              onChange({ ...form, category: event.target.value })
            }
          />
        </Field>
        <Field
          id="budget-amount"
          label={t("common.amount")}
          hint={t("budgets.dialog.amountHint")}
        >
          <input
            id="budget-amount"
            aria-describedby="budget-amount-hint"
            inputMode="decimal"
            required
            value={form.amount}
            onChange={(event) =>
              onChange({ ...form, amount: event.target.value })
            }
          />
        </Field>
        <Field id="budget-month" label={t("common.month")}>
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
