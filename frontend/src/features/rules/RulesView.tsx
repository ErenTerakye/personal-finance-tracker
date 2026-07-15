import { FormEvent, useEffect, useState } from "react";
import "./rules.css";
import {
  ArrowRight,
  CalendarCheck,
  CalendarDays,
  Check,
  ChevronDown,
  Coins,
  GitMerge,
  Plus,
  Settings2,
  Sparkles,
  Trash2,
  WandSparkles,
} from "lucide-react";
import { periodLabel } from "../../shared/format/periods";
import { money } from "../../shared/format/money";
import type {
  CategoryRule,
  CategoryRuleInput,
  RecurringApplyResponse,
  RecurringTemplate,
  RecurringTemplateInput,
} from "../../types";
import {
  ActionButton,
  IconButton,
  SubmitButton,
} from "../../shared/components/actions";
import { ModalDialog } from "../../shared/components/dialogs";
import { ErrorBanner } from "../../shared/components/feedback";
import { Field } from "../../shared/components/fields";
import { PageHeader } from "../../shared/components/lists";
import { localizedNotice } from "../../shared/i18n/notices";
import { useI18n } from "../../shared/i18n/I18nProvider";
import {
  useCategoryRules,
  useDeleteCategoryRule,
  useSaveCategoryRule,
} from "./useCategoryRules";
import {
  useApplyRecurringTemplates,
  useDeleteRecurringTemplate,
  useLedgerSettings,
  useRecurringTemplates,
  useSaveRecurringTemplate,
  useUpdateLedgerSettings,
} from "./useRecurringTemplates";

const defaultRule: CategoryRuleInput = { alias: "", category: "" };
const defaultTemplate: RecurringTemplateInput = {
  type: "expense",
  amount: "",
  category: "",
  description: "",
  day_of_month: 1,
};

type AutomationKind = "category" | "recurring";
type RecurringStarter = Pick<
  RecurringTemplateInput,
  "type" | "category" | "description" | "day_of_month"
>;
type PendingDelete =
  | { kind: "category"; item: CategoryRule }
  | { kind: "recurring"; item: RecurringTemplate };

export function RulesView({
  selectedPeriod,
  setNotice,
  onCurrencyChange,
}: {
  selectedPeriod: { month: number; year: number };
  setNotice: (notice: string) => void;
  onCurrencyChange: (currency: string) => void;
}) {
  const [ruleForm, setRuleForm] = useState<CategoryRuleInput>(defaultRule);
  const [templateForm, setTemplateForm] =
    useState<RecurringTemplateInput>(defaultTemplate);
  const [currency, setCurrency] = useState("USD");
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [creatorKind, setCreatorKind] = useState<AutomationKind | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(
    null,
  );
  const [applyResult, setApplyResult] = useState<RecurringApplyResponse | null>(
    null,
  );
  const { t, tUpper } = useI18n();

  const ruleResource = useCategoryRules();
  const templateResource = useRecurringTemplates();
  const settingsResource = useLedgerSettings();
  const rules = ruleResource.data?.rules ?? [];
  const templates = templateResource.data?.templates ?? [];
  const activeTemplates = templates.filter((template) => template.active);
  const automationCount = rules.length + activeTemplates.length;
  const selectedPeriodLabel = periodLabel(
    selectedPeriod.month,
    selectedPeriod.year,
  );

  useEffect(() => {
    if (settingsResource.status === "success") {
      setCurrency(settingsResource.data.currency);
    }
  }, [settingsResource.data, settingsResource.status]);

  const load = () => {
    ruleResource.refetch();
    templateResource.refetch();
    settingsResource.refetch();
  };

  const saveRuleMutation = useSaveCategoryRule((response) => {
    setNotice(localizedNotice(response, t));
    setRuleForm(defaultRule);
    setCreatorOpen(false);
    setCreatorKind(null);
    load();
  });
  const saveTemplateMutation = useSaveRecurringTemplate((response) => {
    setNotice(localizedNotice(response, t));
    setTemplateForm(defaultTemplate);
    setCreatorOpen(false);
    setCreatorKind(null);
    load();
  });
  const deleteRuleMutation = useDeleteCategoryRule((response) => {
    setNotice(localizedNotice(response, t));
    setPendingDelete(null);
    load();
  });
  const deleteTemplateMutation = useDeleteRecurringTemplate((response) => {
    setNotice(localizedNotice(response, t));
    setPendingDelete(null);
    load();
  });
  const settingsMutation = useUpdateLedgerSettings((response, nextCurrency) => {
    setNotice(localizedNotice(response, t));
    onCurrencyChange(nextCurrency);
  });
  const applyMutation = useApplyRecurringTemplates((response) => {
    setNotice(localizedNotice(response, t));
    setApplyResult(response);
    setPreviewOpen(false);
  });

  const resourceError =
    ruleResource.status === "error"
      ? ruleResource.error.message
      : templateResource.status === "error"
        ? templateResource.error.message
        : settingsResource.status === "error"
          ? settingsResource.error.message
          : "";
  const creatorError =
    saveRuleMutation.status === "error"
      ? saveRuleMutation.error.message
      : saveTemplateMutation.status === "error"
        ? saveTemplateMutation.error.message
        : "";
  const actionError =
    deleteRuleMutation.status === "error"
      ? deleteRuleMutation.error.message
      : deleteTemplateMutation.status === "error"
        ? deleteTemplateMutation.error.message
        : settingsMutation.status === "error"
          ? settingsMutation.error.message
          : applyMutation.status === "error"
            ? applyMutation.error.message
            : "";
  const loading =
    ruleResource.status === "loading" ||
    templateResource.status === "loading" ||
    settingsResource.status === "loading";

  function openCreator(kind: AutomationKind | null = null) {
    setCreatorKind(kind);
    setCreatorOpen(true);
  }

  function closeCreator() {
    setCreatorOpen(false);
    setCreatorKind(null);
    setRuleForm(defaultRule);
    setTemplateForm(defaultTemplate);
  }

  function saveRule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void saveRuleMutation.mutate(ruleForm);
  }

  function saveTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void saveTemplateMutation.mutate(templateForm);
  }

  function saveCurrency(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void settingsMutation.mutate(currency);
  }

  function applyRecurringStarter(starter: RecurringStarter) {
    setTemplateForm({ ...templateForm, ...starter });
    requestAnimationFrame(() => {
      document.getElementById("template-amount")?.focus();
    });
  }

  function confirmDelete() {
    if (!pendingDelete) return;
    if (pendingDelete.kind === "category") {
      void deleteRuleMutation.mutate(pendingDelete.item.id);
    } else {
      void deleteTemplateMutation.mutate(pendingDelete.item.id);
    }
  }

  const deleting =
    deleteRuleMutation.status === "pending" ||
    deleteTemplateMutation.status === "pending";

  return (
    <>
      <PageHeader
        eyebrow={t("rules.eyebrow")}
        title={t("rules.title")}
        summary={t("rules.summary")}
        className="automation-page-heading"
        actions={
          <ActionButton icon={Plus} onClick={() => openCreator()}>
            {t("rules.newAutomation")}
          </ActionButton>
        }
      />

      {resourceError ? (
        <ErrorBanner message={resourceError} onRetry={load} />
      ) : null}
      {actionError ? <ErrorBanner message={actionError} /> : null}

      <section className="automation-hero" aria-labelledby="automation-status">
        <div className="automation-hero-mark" aria-hidden="true">
          <WandSparkles size={28} />
        </div>
        <div className="automation-hero-copy">
          <p className="automation-kicker">{t("rules.statusKicker")}</p>
          <h2 id="automation-status">
            {loading
              ? t("rules.statusLoading")
              : automationCount
                ? t("rules.statusReady", { count: automationCount })
                : t("rules.statusEmpty")}
          </h2>
          <p>
            {automationCount
              ? t("rules.statusDescription")
              : t("rules.statusEmptyDescription")}
          </p>
        </div>
        <div className="automation-hero-facts" aria-label={t("rules.atGlance")}>
          <span>
            <GitMerge aria-hidden="true" size={16} />
            {t("rules.categoryCount", { count: rules.length })}
          </span>
          <span>
            <CalendarDays aria-hidden="true" size={16} />
            {t("rules.recurringCount", { count: activeTemplates.length })}
          </span>
        </div>
      </section>

      {activeTemplates.length ? (
        <section className="automation-monthly" aria-labelledby="monthly-title">
          <div className="automation-monthly-icon" aria-hidden="true">
            <CalendarCheck size={22} />
          </div>
          <div>
            <p className="automation-kicker">{t("rules.monthlyAction")}</p>
            <h2 id="monthly-title">
              {t("rules.monthlyReady", { period: selectedPeriodLabel })}
            </h2>
            <p>
              {t("rules.monthlySimpleDescription", {
                count: activeTemplates.length,
              })}
            </p>
          </div>
          <ActionButton
            icon={ArrowRight}
            onClick={() => {
              setApplyResult(null);
              setPreviewOpen(true);
            }}
          >
            {t("rules.reviewEntries")}
          </ActionButton>
        </section>
      ) : null}

      {applyResult ? (
        <div className="automation-result" role="status">
          <Check aria-hidden="true" size={18} />
          <p>
            {t("rules.applyResult", {
              created: applyResult.created_count,
              skipped: applyResult.skipped_duplicates,
            })}
          </p>
        </div>
      ) : null}

      <section
        className="automation-collection"
        aria-labelledby="automation-list-title"
      >
        <header className="automation-collection-header">
          <div>
            <h2 id="automation-list-title">{t("rules.yourAutomations")}</h2>
            <p>{t("rules.yourAutomationsDescription")}</p>
          </div>
          {automationCount ? (
            <span className="automation-total">
              {t("rules.automationCount", { count: automationCount })}
            </span>
          ) : null}
        </header>

        {loading ? (
          <p className="automation-list-message">{t("rules.statusLoading")}</p>
        ) : automationCount ? (
          <ul className="automation-list">
            {rules.map((rule) => (
              <li key={`category-${rule.id}`}>
                <span
                  className="automation-item-icon category"
                  aria-hidden="true"
                >
                  <GitMerge size={19} />
                </span>
                <span className="automation-item-copy">
                  <span className="automation-type-label">
                    {t("rules.categoryAutomation")}
                  </span>
                  <strong>
                    {t("rules.categorySentence", {
                      alias: rule.alias,
                      category: rule.category,
                    })}
                  </strong>
                  <small>{t("rules.categoryItemDescription")}</small>
                </span>
                <IconButton
                  icon={Trash2}
                  variant="ghost"
                  label={t("rules.deleteNamed", { name: rule.alias })}
                  onClick={() =>
                    setPendingDelete({ kind: "category", item: rule })
                  }
                />
              </li>
            ))}
            {activeTemplates.map((template) => (
              <li key={`recurring-${template.id}`}>
                <span
                  className="automation-item-icon recurring"
                  aria-hidden="true"
                >
                  <CalendarDays size={19} />
                </span>
                <span className="automation-item-copy">
                  <span className="automation-type-label">
                    {t("rules.recurringAutomation")}
                  </span>
                  <strong>
                    {template.description || template.category}
                    <span className={`automation-amount ${template.type}`}>
                      {template.type === "expense" ? "−" : "+"}
                      {money(template.amount)}
                    </span>
                  </strong>
                  <small>
                    {t("rules.recurringSentence", {
                      type: tUpper(`common.${template.type}`),
                      category: template.category,
                      day: template.day_of_month,
                    })}
                  </small>
                </span>
                <IconButton
                  icon={Trash2}
                  variant="ghost"
                  label={t("rules.deleteNamed", {
                    name: template.description || template.category,
                  })}
                  onClick={() =>
                    setPendingDelete({ kind: "recurring", item: template })
                  }
                />
              </li>
            ))}
          </ul>
        ) : (
          <div className="automation-empty">
            <div className="automation-empty-icon" aria-hidden="true">
              <Sparkles size={26} />
            </div>
            <h3>{t("rules.emptyListTitle")}</h3>
            <p>{t("rules.emptyListDescription")}</p>
            <div className="automation-empty-options">
              <button
                type="button"
                className="automation-choice"
                onClick={() => openCreator("category")}
              >
                <GitMerge aria-hidden="true" size={20} />
                <span className="automation-choice-copy">
                  <strong>{t("rules.categoryChoiceTitle")}</strong>
                  <small>{t("rules.categoryChoiceDescription")}</small>
                </span>
                <ArrowRight
                  className="automation-option-arrow"
                  aria-hidden="true"
                  size={18}
                />
              </button>
              <button
                type="button"
                className="automation-choice"
                onClick={() => openCreator("recurring")}
              >
                <CalendarDays aria-hidden="true" size={20} />
                <span className="automation-choice-copy">
                  <strong>{t("rules.recurringChoiceTitle")}</strong>
                  <small>{t("rules.recurringChoiceDescription")}</small>
                </span>
                <ArrowRight
                  className="automation-option-arrow"
                  aria-hidden="true"
                  size={18}
                />
              </button>
            </div>
          </div>
        )}
      </section>

      <details className="automation-settings">
        <summary>
          <span className="automation-settings-title">
            <Settings2 aria-hidden="true" size={18} />
            <strong>{t("rules.settingsTitle")}</strong>
          </span>
          <span className="automation-settings-meta">
            <small>{t("rules.settingsSummary", { currency })}</small>
            <ChevronDown aria-hidden="true" size={18} />
          </span>
        </summary>
        <form onSubmit={saveCurrency}>
          <Field
            id="settings-currency"
            label={t("rules.settingsCurrency")}
            hint={t("rules.settingsHint")}
          >
            <select
              id="settings-currency"
              name="currency"
              required
              value={currency}
              onChange={(event) => setCurrency(event.target.value)}
            >
              <option value="USD">USD ($)</option>
              <option value="TRY">TRY (₺)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
            </select>
          </Field>
          <SubmitButton
            busy={settingsMutation.status === "pending"}
            icon={Coins}
          >
            {t("rules.settingsSaveBtn")}
          </SubmitButton>
        </form>
      </details>

      <ModalDialog
        open={creatorOpen}
        title={
          creatorKind
            ? t(`rules.${creatorKind}CreateTitle`)
            : t("rules.createTitle")
        }
        description={
          creatorKind
            ? t(`rules.${creatorKind}FormDescription`)
            : t("rules.createDescription")
        }
        onClose={closeCreator}
        className="automation-create-dialog"
        initialFocusId={creatorKind === "category" ? "rule-alias" : undefined}
      >
        {creatorError ? <ErrorBanner message={creatorError} /> : null}
        {!creatorKind ? (
          <fieldset className="automation-kind-picker">
            <legend className="sr-only">{t("rules.chooseType")}</legend>
            <label className="automation-choice">
              <input
                type="radio"
                name="automation-kind"
                value="category"
                onChange={() => setCreatorKind("category")}
              />
              <span className="automation-kind-icon" aria-hidden="true">
                <GitMerge size={22} />
              </span>
              <span className="automation-choice-copy">
                <strong>{t("rules.categoryChoiceTitle")}</strong>
                <small>{t("rules.categoryChoiceDescription")}</small>
              </span>
              <ArrowRight aria-hidden="true" size={18} />
            </label>
            <label className="automation-choice">
              <input
                type="radio"
                name="automation-kind"
                value="recurring"
                onChange={() => setCreatorKind("recurring")}
              />
              <span className="automation-kind-icon" aria-hidden="true">
                <CalendarDays size={22} />
              </span>
              <span className="automation-choice-copy">
                <strong>{t("rules.recurringChoiceTitle")}</strong>
                <small>{t("rules.recurringChoiceDescription")}</small>
              </span>
              <ArrowRight aria-hidden="true" size={18} />
            </label>
          </fieldset>
        ) : (
          <>
            <button
              type="button"
              className="automation-change-kind"
              onClick={() => setCreatorKind(null)}
            >
              {t("rules.changeType")}
            </button>
            {creatorKind === "category" ? (
              <form className="automation-create-form" onSubmit={saveRule}>
                <div
                  className="automation-form-explainer"
                  aria-label={t("rules.categoryExampleLabel")}
                >
                  <span>
                    <small>{t("rules.whenImportSays")}</small>
                    <strong>uber</strong>
                  </span>
                  <ArrowRight aria-hidden="true" size={16} />
                  <span>
                    <small>{t("rules.useCategory")}</small>
                    <strong>Transport</strong>
                  </span>
                </div>
                <Field
                  id="rule-alias"
                  label={t("rules.aliasField")}
                  hint={t("rules.aliasPlainHint")}
                >
                  <input
                    id="rule-alias"
                    name="alias"
                    required
                    autoComplete="off"
                    value={ruleForm.alias}
                    onChange={(event) =>
                      setRuleForm({ ...ruleForm, alias: event.target.value })
                    }
                  />
                </Field>
                <Field
                  id="rule-category"
                  label={t("rules.resultCategory")}
                  hint={t("rules.categoryPlainHint")}
                >
                  <input
                    id="rule-category"
                    name="category"
                    required
                    autoComplete="off"
                    value={ruleForm.category}
                    onChange={(event) =>
                      setRuleForm({ ...ruleForm, category: event.target.value })
                    }
                  />
                </Field>
                <SubmitButton
                  busy={saveRuleMutation.status === "pending"}
                  icon={WandSparkles}
                >
                  {t("rules.createAutomation")}
                </SubmitButton>
              </form>
            ) : (
              <form className="automation-create-form" onSubmit={saveTemplate}>
                <div className="automation-starters">
                  <span>
                    <strong>{t("rules.recurringStarterTitle")}</strong>
                    <small>{t("rules.recurringStarterHint")}</small>
                  </span>
                  <div className="automation-starter-options">
                    <button
                      type="button"
                      onClick={() =>
                        applyRecurringStarter({
                          type: "expense",
                          description: t("rules.rentExampleDescription"),
                          category: t("rules.rentExampleCategory"),
                          day_of_month: 1,
                        })
                      }
                    >
                      {t("rules.rentExample")}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        applyRecurringStarter({
                          type: "expense",
                          description: t(
                            "rules.subscriptionExampleDescription",
                          ),
                          category: t("rules.subscriptionExampleCategory"),
                          day_of_month: 15,
                        })
                      }
                    >
                      {t("rules.subscriptionExample")}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        applyRecurringStarter({
                          type: "income",
                          description: t("rules.salaryExampleDescription"),
                          category: t("rules.salaryExampleCategory"),
                          day_of_month: 25,
                        })
                      }
                    >
                      {t("rules.salaryExample")}
                    </button>
                  </div>
                </div>
                <fieldset className="automation-transaction-type">
                  <legend>{t("common.type")}</legend>
                  <label>
                    <input
                      type="radio"
                      name="recurring-type"
                      value="expense"
                      checked={templateForm.type === "expense"}
                      onChange={() =>
                        setTemplateForm({ ...templateForm, type: "expense" })
                      }
                    />
                    <span>{t("common.expense")}</span>
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="recurring-type"
                      value="income"
                      checked={templateForm.type === "income"}
                      onChange={() =>
                        setTemplateForm({ ...templateForm, type: "income" })
                      }
                    />
                    <span>{t("common.income")}</span>
                  </label>
                </fieldset>
                <Field
                  id="template-description"
                  label={t("rules.recurringDescriptionField")}
                  hint={t("rules.recurringDescriptionHint")}
                >
                  <input
                    id="template-description"
                    name="description"
                    autoComplete="off"
                    value={templateForm.description}
                    onChange={(event) =>
                      setTemplateForm({
                        ...templateForm,
                        description: event.target.value,
                      })
                    }
                  />
                </Field>
                <div className="automation-form-row">
                  <Field
                    id="template-amount"
                    label={t("common.amount")}
                    hint={t("rules.recurringAmountHint", { currency })}
                  >
                    <input
                      id="template-amount"
                      name="amount"
                      inputMode="decimal"
                      required
                      value={templateForm.amount}
                      onChange={(event) =>
                        setTemplateForm({
                          ...templateForm,
                          amount: event.target.value,
                        })
                      }
                    />
                  </Field>
                  <Field
                    id="template-day"
                    label={t("rules.dayField")}
                    hint={t("rules.recurringDayHint")}
                  >
                    <input
                      id="template-day"
                      name="day"
                      min="1"
                      max="31"
                      type="number"
                      required
                      value={templateForm.day_of_month}
                      onChange={(event) =>
                        setTemplateForm({
                          ...templateForm,
                          day_of_month: Number(event.target.value),
                        })
                      }
                    />
                  </Field>
                </div>
                <Field
                  id="template-category"
                  label={t("common.category")}
                  hint={t("rules.recurringCategoryHint")}
                >
                  <input
                    id="template-category"
                    name="category"
                    required
                    autoComplete="off"
                    value={templateForm.category}
                    onChange={(event) =>
                      setTemplateForm({
                        ...templateForm,
                        category: event.target.value,
                      })
                    }
                  />
                </Field>
                <SubmitButton
                  busy={saveTemplateMutation.status === "pending"}
                  icon={WandSparkles}
                >
                  {t("rules.createAutomation")}
                </SubmitButton>
              </form>
            )}
          </>
        )}
      </ModalDialog>

      <ModalDialog
        open={previewOpen}
        title={t("rules.previewTitle", { period: selectedPeriodLabel })}
        description={t("rules.previewDescription")}
        onClose={() => setPreviewOpen(false)}
        className="automation-preview-dialog"
      >
        <ul className="automation-preview-list">
          {activeTemplates.map((template) => (
            <li key={template.id}>
              <span>
                <strong>{template.description || template.category}</strong>
                <small>
                  {t("rules.recurringSentence", {
                    type: tUpper(`common.${template.type}`),
                    category: template.category,
                    day: template.day_of_month,
                  })}
                </small>
              </span>
              <strong className={`automation-amount ${template.type}`}>
                {template.type === "expense" ? "−" : "+"}
                {money(template.amount)}
              </strong>
            </li>
          ))}
        </ul>
        <p className="automation-duplicate-note">
          <Check aria-hidden="true" size={16} />
          {t("rules.duplicateNote")}
        </p>
        <div className="dialog-actions">
          <button type="button" onClick={() => setPreviewOpen(false)}>
            {t("common.cancel")}
          </button>
          <ActionButton
            icon={CalendarCheck}
            disabled={applyMutation.status === "pending"}
            onClick={() => void applyMutation.mutate(selectedPeriod)}
          >
            {t("rules.createEntries", { count: activeTemplates.length })}
          </ActionButton>
        </div>
      </ModalDialog>

      <ModalDialog
        open={pendingDelete !== null}
        title={t("rules.deleteTitle")}
        description={t("rules.deleteDescription")}
        onClose={() => setPendingDelete(null)}
        className="automation-delete-dialog"
      >
        <div className="dialog-actions">
          <button type="button" onClick={() => setPendingDelete(null)}>
            {t("common.cancel")}
          </button>
          <ActionButton
            icon={Trash2}
            variant="danger"
            disabled={deleting}
            onClick={confirmDelete}
          >
            {t("rules.deleteConfirm")}
          </ActionButton>
        </div>
      </ModalDialog>
    </>
  );
}
