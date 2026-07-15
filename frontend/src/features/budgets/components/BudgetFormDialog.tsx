import {
  CalendarRange,
  Check,
  PiggyBank,
  Save,
  Sparkles,
  Tags,
  Target,
} from "lucide-react";
import type { FormEvent } from "react";
import type { BudgetInput, BudgetStatus } from "../../../types";
import { SubmitButton } from "../../../shared/components/actions";
import { ModalDialog } from "../../../shared/components/dialogs";
import { ErrorBanner } from "../../../shared/components/feedback";
import { currencySymbol, money } from "../../../shared/format/money";
import { monthNames, periodLabel } from "../../../shared/format/periods";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import { normalizeBudgetAmountDraft } from "../budgetForm";

type BudgetDialogMode = "create" | "edit";

const suggestedCategories = [
  "Food & Drinks",
  "Transport",
  "Shopping",
  "Entertainment",
] as const;

const allSuggestedCategories = [
  ...suggestedCategories,
  "Rent",
  "Utilities",
  "Health & Wellness",
] as const;

export function BudgetFormDialog({
  open,
  mode,
  form,
  statuses,
  error,
  saving,
  onClose,
  onSubmit,
  onChange,
}: {
  open: boolean;
  mode: BudgetDialogMode;
  form: BudgetInput;
  statuses: BudgetStatus[];
  error: string;
  saving: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onChange: (form: BudgetInput) => void;
}) {
  const { t } = useI18n();
  const normalizedCategory = form.category.trim().toLocaleLowerCase();
  const matchedStatus = statuses.find(
    (status) =>
      status.budget.month === form.month &&
      status.budget.year === form.year &&
      status.budget.category.trim().toLocaleLowerCase() === normalizedCategory,
  );
  const amount = Number(form.amount);
  const validAmount = Number.isFinite(amount) && amount > 0;
  const spent = Number(matchedStatus?.actual_expenses ?? 0);
  const remaining = validAmount ? amount - spent : null;
  const categoryLabel = form.category.trim() || t("budgets.dialog.noCategory");
  const submitLabel =
    mode === "edit"
      ? t("budgets.dialog.saveChanges")
      : t("budgets.dialog.createBudget");

  return (
    <ModalDialog
      open={open}
      title={
        mode === "edit"
          ? t("budgets.dialog.updateTitle")
          : t("budgets.dialog.setTitle")
      }
      description={t(
        mode === "edit"
          ? "budgets.dialog.updateDescription"
          : "budgets.dialog.setDescription",
      )}
      onClose={onClose}
      className="entry-dialog budget-planner-dialog"
      initialFocusId={mode === "create" ? "budget-amount" : undefined}
    >
      {error ? <ErrorBanner message={error} /> : null}
      <form className="budget-planner" onSubmit={onSubmit}>
        <div className="budget-planner-body">
          <div className="budget-planner-fields">
            <section className="budget-amount-stage">
              <div className="budget-field-heading">
                <label htmlFor="budget-amount">{t("common.amount")}</label>
                <span>{t("budgets.dialog.monthlyLimit")}</span>
              </div>
              <div className="budget-amount-control">
                <span aria-hidden="true">{currencySymbol()}</span>
                <input
                  id="budget-amount"
                  name="amount"
                  aria-describedby="budget-amount-hint budget-amount-error"
                  aria-errormessage="budget-amount-error"
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
                    const next = normalizeBudgetAmountDraft(event.target.value);
                    if (next !== null) onChange({ ...form, amount: next });
                  }}
                />
              </div>
              <p id="budget-amount-hint" className="budget-field-hint">
                {t("budgets.dialog.amountHint")}
              </p>
              <p id="budget-amount-error" className="budget-field-error">
                {t("budgets.dialog.amountError")}
              </p>
            </section>

            <section className="budget-category-stage">
              <div className="budget-field-heading">
                <label htmlFor="budget-category">{t("common.category")}</label>
                <span>{t("budgets.dialog.categorySupport")}</span>
              </div>
              <span className="budget-input-shell">
                <Tags aria-hidden="true" size={18} />
                <input
                  id="budget-category"
                  name="category"
                  list="budget-category-suggestions"
                  aria-describedby="budget-category-hint budget-category-error"
                  aria-errormessage="budget-category-error"
                  autoComplete="off"
                  enterKeyHint="next"
                  maxLength={100}
                  placeholder={t("budgets.dialog.categoryPlaceholder")}
                  required
                  value={form.category}
                  onChange={(event) =>
                    onChange({ ...form, category: event.target.value })
                  }
                />
              </span>
              <p id="budget-category-hint" className="budget-field-hint">
                {t("budgets.dialog.categoryHint")}
              </p>
              <p id="budget-category-error" className="budget-field-error">
                {t("budgets.dialog.categoryError")}
              </p>
              {mode === "create" ? (
                <div
                  className="budget-category-suggestions"
                  aria-label={t("budgets.dialog.suggestions")}
                >
                  {suggestedCategories.map((category) => (
                    <button
                      key={category}
                      type="button"
                      className={
                        normalizedCategory === category.toLocaleLowerCase()
                          ? "is-selected"
                          : ""
                      }
                      aria-pressed={
                        normalizedCategory === category.toLocaleLowerCase()
                      }
                      onClick={() => onChange({ ...form, category })}
                    >
                      {t(`categories.${category}`)}
                    </button>
                  ))}
                </div>
              ) : null}
            </section>

            <fieldset className="budget-period-stage">
              <legend>{t("common.period")}</legend>
              <p>{t("budgets.dialog.periodHint")}</p>
              <div className="budget-period-controls">
                <label>
                  <span>{t("common.month")}</span>
                  <span className="budget-input-shell">
                    <CalendarRange aria-hidden="true" size={18} />
                    <select
                      id="budget-month"
                      name="month"
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
                </label>
                <label>
                  <span>{t("common.year")}</span>
                  <input
                    id="budget-year"
                    name="year"
                    min="1"
                    type="number"
                    inputMode="numeric"
                    required
                    value={form.year}
                    onChange={(event) =>
                      onChange({ ...form, year: Number(event.target.value) })
                    }
                  />
                </label>
              </div>
            </fieldset>
          </div>

          <aside className="budget-plan-preview">
            <div className="budget-preview-kicker">
              <span>
                <Sparkles aria-hidden="true" size={15} />
                {t("budgets.dialog.preview")}
              </span>
              <PiggyBank aria-hidden="true" size={23} />
            </div>
            <p className="budget-preview-category">{categoryLabel}</p>
            <p className="budget-preview-amount">
              {validAmount ? money(amount) : money(0)}
            </p>
            <p className="budget-preview-period">
              {periodLabel(form.month, form.year)}
            </p>

            {matchedStatus && validAmount ? (
              <dl className="budget-preview-impact">
                <div>
                  <dt>{t("budgets.dialog.spentAlready")}</dt>
                  <dd>{money(spent)}</dd>
                </div>
                <div>
                  <dt>
                    {t(
                      remaining !== null && remaining < 0
                        ? "budgets.dialog.overAfterSave"
                        : "budgets.dialog.leftAfterSave",
                    )}
                  </dt>
                  <dd>{money(Math.abs(remaining ?? 0))}</dd>
                </div>
              </dl>
            ) : (
              <p className="budget-preview-empty">
                <Target aria-hidden="true" size={18} />
                {t("budgets.dialog.previewEmpty")}
              </p>
            )}

            <ul className="budget-preview-benefits">
              <li>
                <Check aria-hidden="true" size={16} />
                {t("budgets.dialog.trackingNote")}
              </li>
              <li>
                <Check aria-hidden="true" size={16} />
                {t("budgets.dialog.localNote")}
              </li>
            </ul>
            {matchedStatus ? (
              <p className="budget-preview-update">
                {t("budgets.dialog.updateNotice", {
                  amount: money(matchedStatus.budget.amount),
                })}
              </p>
            ) : null}
          </aside>
        </div>

        <footer className="budget-planner-footer">
          <p>{t("budgets.dialog.footerNote")}</p>
          <div className="budget-planner-actions">
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

        <datalist id="budget-category-suggestions">
          {[
            ...new Set([
              ...allSuggestedCategories,
              ...statuses.map((status) => status.budget.category),
            ]),
          ].map((category) => (
            <option key={category} value={category} />
          ))}
        </datalist>
      </form>
    </ModalDialog>
  );
}
