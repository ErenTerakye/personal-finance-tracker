import {
  ArrowRight,
  CalendarCheck,
  Check,
  Coins,
  Database,
  Download,
  Plus,
  ReceiptText,
  Repeat2,
  Settings2,
  Tags,
  Target,
  Trash2,
  Upload,
} from "lucide-react";
import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import "./manage.css";
import { artifactUrls } from "../../api/artifacts";
import { LanguageToggle } from "../../app/AppShell";
import {
  manageViewOrder,
  pathForView,
  type ManageView as ManageSection,
  type View,
} from "../../app/routes";
import {
  ActionButton,
  DownloadLink,
  IconButton,
  SubmitButton,
} from "../../shared/components/actions";
import { ModalDialog } from "../../shared/components/dialogs";
import { EmptyState, ErrorBanner } from "../../shared/components/feedback";
import { Field } from "../../shared/components/fields";
import { PageHeader } from "../../shared/components/lists";
import { PeriodControl } from "../../shared/components/PeriodControl";
import { money } from "../../shared/format/money";
import { periodLabel } from "../../shared/format/periods";
import { useI18n } from "../../shared/i18n/I18nProvider";
import { localizedNotice } from "../../shared/i18n/notices";
import { ThemeToggle } from "../../shared/theme/ThemeToggle";
import type {
  CategoryRule,
  CategoryRuleInput,
  RecurringApplyResponse,
  RecurringTemplate,
  RecurringTemplateInput,
} from "../../types";
import {
  useApplyRecurringTemplates,
  useCategoryRules,
  useDeleteCategoryRule,
  useDeleteRecurringTemplate,
  useLedgerSettings,
  useRecurringTemplates,
  useSaveCategoryRule,
  useSaveRecurringTemplate,
  useUpdateLedgerSettings,
} from "./hooks";

const manageIcons = {
  manageAutomations: Repeat2,
  manageCategories: Tags,
  manageData: Database,
  managePreferences: Settings2,
};

export function ManageView({
  section,
  selectedPeriod,
  setSelectedPeriod,
  setNotice,
  onNavigate,
  onViewTransactions,
  onOpenTransactionImport,
  onOpenBudgetImport,
  onCurrencyChange,
}: {
  section: ManageSection;
  selectedPeriod: { month: number; year: number };
  setSelectedPeriod: (period: { month: number; year: number }) => void;
  setNotice: (notice: string) => void;
  onNavigate: (view: View) => void;
  onViewTransactions: (month: number, year: number) => void;
  onOpenTransactionImport: () => void;
  onOpenBudgetImport: () => void;
  onCurrencyChange: (currency: string) => void;
}) {
  const navigation = (
    <ManageNavigation current={section} onNavigate={onNavigate} />
  );
  return (
    <div className="manage-view">
      {section === "manageAutomations" ? (
        <AutomationsView
          navigation={navigation}
          selectedPeriod={selectedPeriod}
          setSelectedPeriod={setSelectedPeriod}
          setNotice={setNotice}
          onViewTransactions={onViewTransactions}
        />
      ) : null}
      {section === "manageCategories" ? (
        <CategoriesView navigation={navigation} setNotice={setNotice} />
      ) : null}
      {section === "manageData" ? (
        <DataView
          navigation={navigation}
          selectedPeriod={selectedPeriod}
          onOpenTransactionImport={onOpenTransactionImport}
          onOpenBudgetImport={onOpenBudgetImport}
        />
      ) : null}
      {section === "managePreferences" ? (
        <PreferencesView
          navigation={navigation}
          setNotice={setNotice}
          onCurrencyChange={onCurrencyChange}
        />
      ) : null}
    </div>
  );
}

function ManageNavigation({
  current,
  onNavigate,
}: {
  current: ManageSection;
  onNavigate: (view: View) => void;
}) {
  const { t } = useI18n();
  return (
    <nav className="manage-navigation" aria-label={t("manage.navigationLabel")}>
      <ul>
        {manageViewOrder.map((view) => {
          const Icon = manageIcons[view];
          return (
            <li key={view}>
              <a
                href={pathForView(view)}
                aria-current={current === view ? "page" : undefined}
                onClick={(event) => {
                  if (
                    event.button !== 0 ||
                    event.metaKey ||
                    event.ctrlKey ||
                    event.shiftKey ||
                    event.altKey
                  ) {
                    return;
                  }
                  event.preventDefault();
                  onNavigate(view);
                }}
              >
                <Icon aria-hidden="true" size={18} />
                <span>{t(`manage.sections.${view}`)}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

const defaultTemplate: RecurringTemplateInput = {
  type: "expense",
  amount: "",
  category: "",
  description: "",
  day_of_month: 1,
};

function AutomationsView({
  navigation,
  selectedPeriod,
  setSelectedPeriod,
  setNotice,
  onViewTransactions,
}: {
  navigation: ReactNode;
  selectedPeriod: { month: number; year: number };
  setSelectedPeriod: (period: { month: number; year: number }) => void;
  setNotice: (notice: string) => void;
  onViewTransactions: (month: number, year: number) => void;
}) {
  const { t, tUpper } = useI18n();
  const [form, setForm] = useState(defaultTemplate);
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<RecurringTemplate | null>(
    null,
  );
  const [applyResult, setApplyResult] = useState<RecurringApplyResponse | null>(
    null,
  );
  const templatesResource = useRecurringTemplates();
  const settingsResource = useLedgerSettings();
  const templates = templatesResource.data?.templates ?? [];
  const activeTemplates = templates.filter((template) => template.active);
  const currency = settingsResource.data?.currency ?? "USD";
  const period = periodLabel(selectedPeriod.month, selectedPeriod.year);

  const saveMutation = useSaveRecurringTemplate((response) => {
    setNotice(localizedNotice(response, t));
    setForm(defaultTemplate);
    setCreatorOpen(false);
    templatesResource.refetch();
  });
  const deleteMutation = useDeleteRecurringTemplate((response) => {
    setNotice(localizedNotice(response, t));
    setPendingDelete(null);
    templatesResource.refetch();
  });
  const applyMutation = useApplyRecurringTemplates((response) => {
    setNotice(localizedNotice(response, t));
    setApplyResult(response);
    setPreviewOpen(false);
  });

  const loadError =
    templatesResource.status === "error"
      ? templatesResource.error.message
      : settingsResource.status === "error"
        ? settingsResource.error.message
        : "";

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void saveMutation.mutate(form);
  }

  return (
    <>
      <PageHeader
        eyebrow={t("manage.eyebrow")}
        title={t("manage.automations.title")}
        summary={t("manage.automations.summary")}
        actions={
          <ActionButton icon={Plus} onClick={() => setCreatorOpen(true)}>
            {t("manage.automations.add")}
          </ActionButton>
        }
      />
      {navigation}
      <ManageContext
        label={t("manage.automations.periodLabel")}
        control={
          <PeriodControl
            label={t("manage.automations.periodLabel")}
            value={selectedPeriod}
            onChange={setSelectedPeriod}
          />
        }
      />
      {loadError ? (
        <ErrorBanner
          message={loadError}
          onRetry={() => {
            templatesResource.refetch();
            settingsResource.refetch();
          }}
        />
      ) : null}
      {applyMutation.status === "error" ? (
        <ErrorBanner message={applyMutation.error.message} />
      ) : null}

      {activeTemplates.length ? (
        <section className="manage-callout" aria-labelledby="recurring-ready">
          <CalendarCheck aria-hidden="true" size={24} />
          <div>
            <h2 id="recurring-ready">
              {t("manage.automations.ready", {
                count: activeTemplates.length,
                period,
              })}
            </h2>
            <p>{t("manage.automations.readyDetail")}</p>
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
        <section className="manage-result" aria-labelledby="apply-result-title">
          <Check aria-hidden="true" size={20} />
          <div>
            <h2 id="apply-result-title">{t("manage.automations.applied")}</h2>
            <p>
              {t("rules.applyResult", {
                created: applyResult.created_count,
                skipped: applyResult.skipped_duplicates,
              })}
            </p>
          </div>
          <ActionButton
            icon={ReceiptText}
            variant="secondary"
            onClick={() =>
              onViewTransactions(selectedPeriod.month, selectedPeriod.year)
            }
          >
            {t("manage.automations.viewTransactions")}
          </ActionButton>
        </section>
      ) : null}

      <section className="manage-group" aria-labelledby="recurring-list-title">
        <header>
          <div>
            <h2 id="recurring-list-title">
              {t("manage.automations.listTitle")}
            </h2>
            <p>{t("manage.automations.listSummary")}</p>
          </div>
        </header>
        {templatesResource.status === "loading" && !templatesResource.data ? (
          <p className="loading-state">{t("rules.statusLoading")}</p>
        ) : templates.length ? (
          <ul className="manage-record-list">
            {templates.map((template) => (
              <li key={template.id}>
                <span className="manage-record-icon">
                  <Repeat2 aria-hidden="true" size={19} />
                </span>
                <span className="manage-record-copy">
                  <span className="manage-record-meta">
                    {template.active
                      ? t("manage.automations.active")
                      : t("manage.automations.inactive")}
                  </span>
                  <strong>{template.description || template.category}</strong>
                  <small>
                    {t("rules.recurringSentence", {
                      type: tUpper(`common.${template.type}`),
                      category: template.category,
                      day: template.day_of_month,
                    })}
                  </small>
                </span>
                <strong className={`manage-record-amount ${template.type}`}>
                  {template.type === "expense" ? "−" : "+"}
                  {money(template.amount)}
                </strong>
                <IconButton
                  icon={Trash2}
                  label={t("rules.deleteNamed", {
                    name: template.description || template.category,
                  })}
                  onClick={() => setPendingDelete(template)}
                />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={Repeat2}
            title={t("manage.automations.emptyTitle")}
            message={t("manage.automations.emptyMessage")}
            action={
              <ActionButton icon={Plus} onClick={() => setCreatorOpen(true)}>
                {t("manage.automations.add")}
              </ActionButton>
            }
          />
        )}
      </section>

      <ModalDialog
        open={creatorOpen}
        title={t("manage.automations.add")}
        description={t("rules.recurringFormDescription")}
        onClose={() => {
          setCreatorOpen(false);
          setForm(defaultTemplate);
        }}
        initialFocusId="manage-template-description"
      >
        {saveMutation.status === "error" ? (
          <ErrorBanner message={saveMutation.error.message} />
        ) : null}
        <form className="dialog-form" onSubmit={save}>
          <fieldset className="manage-choice-row">
            <legend>{t("common.type")}</legend>
            <label>
              <input
                type="radio"
                name="manage-recurring-type"
                checked={form.type === "expense"}
                onChange={() => setForm({ ...form, type: "expense" })}
              />
              <span>{t("common.expense")}</span>
            </label>
            <label>
              <input
                type="radio"
                name="manage-recurring-type"
                checked={form.type === "income"}
                onChange={() => setForm({ ...form, type: "income" })}
              />
              <span>{t("common.income")}</span>
            </label>
          </fieldset>
          <Field
            id="manage-template-description"
            label={t("rules.recurringDescriptionField")}
          >
            <input
              id="manage-template-description"
              value={form.description}
              onChange={(event) =>
                setForm({ ...form, description: event.target.value })
              }
            />
          </Field>
          <div className="manage-form-row">
            <Field
              id="manage-template-amount"
              label={t("common.amount")}
              hint={t("rules.recurringAmountHint", { currency })}
            >
              <input
                id="manage-template-amount"
                inputMode="decimal"
                required
                value={form.amount}
                onChange={(event) =>
                  setForm({ ...form, amount: event.target.value })
                }
              />
            </Field>
            <Field id="manage-template-day" label={t("rules.dayField")}>
              <input
                id="manage-template-day"
                type="number"
                min="1"
                max="31"
                required
                value={form.day_of_month}
                onChange={(event) =>
                  setForm({
                    ...form,
                    day_of_month: Number(event.target.value),
                  })
                }
              />
            </Field>
          </div>
          <Field id="manage-template-category" label={t("common.category")}>
            <input
              id="manage-template-category"
              required
              value={form.category}
              onChange={(event) =>
                setForm({ ...form, category: event.target.value })
              }
            />
          </Field>
          <SubmitButton busy={saveMutation.status === "pending"} icon={Repeat2}>
            {t("manage.automations.add")}
          </SubmitButton>
        </form>
      </ModalDialog>

      <ModalDialog
        open={previewOpen}
        title={t("rules.previewTitle", { period })}
        description={t("rules.previewDescription")}
        onClose={() => setPreviewOpen(false)}
      >
        <ul className="manage-preview-list">
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
              <strong>
                {template.type === "expense" ? "−" : "+"}
                {money(template.amount)}
              </strong>
            </li>
          ))}
        </ul>
        <p className="manage-duplicate-note">
          <Check aria-hidden="true" size={16} />
          {t("rules.duplicateNote")}
        </p>
        <div className="dialog-actions">
          <button
            className="button secondary"
            type="button"
            onClick={() => setPreviewOpen(false)}
          >
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
        description={pendingDelete?.description || pendingDelete?.category}
        onClose={() => setPendingDelete(null)}
      >
        {deleteMutation.status === "error" ? (
          <ErrorBanner message={deleteMutation.error.message} />
        ) : null}
        <p className="dialog-copy">{t("rules.deleteDescription")}</p>
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
            onClick={() => {
              if (pendingDelete) void deleteMutation.mutate(pendingDelete.id);
            }}
          >
            <Trash2 aria-hidden="true" size={18} />
            {t("common.delete")}
          </button>
        </div>
      </ModalDialog>
    </>
  );
}

const defaultRule: CategoryRuleInput = { alias: "", category: "" };

function CategoriesView({
  navigation,
  setNotice,
}: {
  navigation: ReactNode;
  setNotice: (notice: string) => void;
}) {
  const { t } = useI18n();
  const [form, setForm] = useState(defaultRule);
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<CategoryRule | null>(null);
  const resource = useCategoryRules();
  const rules = resource.data?.rules ?? [];
  const saveMutation = useSaveCategoryRule((response) => {
    setNotice(localizedNotice(response, t));
    setForm(defaultRule);
    setCreatorOpen(false);
    resource.refetch();
  });
  const deleteMutation = useDeleteCategoryRule((response) => {
    setNotice(localizedNotice(response, t));
    setPendingDelete(null);
    resource.refetch();
  });

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void saveMutation.mutate(form);
  }

  return (
    <>
      <PageHeader
        eyebrow={t("manage.eyebrow")}
        title={t("manage.categories.title")}
        summary={t("manage.categories.summary")}
        actions={
          <ActionButton icon={Plus} onClick={() => setCreatorOpen(true)}>
            {t("manage.categories.add")}
          </ActionButton>
        }
      />
      {navigation}
      {resource.status === "error" ? (
        <ErrorBanner
          message={resource.error.message}
          onRetry={resource.refetch}
        />
      ) : null}
      <section className="manage-group" aria-labelledby="category-rules-title">
        <header>
          <div>
            <h2 id="category-rules-title">
              {t("manage.categories.listTitle")}
            </h2>
            <p>{t("manage.categories.listSummary")}</p>
          </div>
        </header>
        {rules.length ? (
          <ul className="manage-mapping-list">
            {rules.map((rule) => (
              <li key={rule.id}>
                <span>
                  <small>{t("manage.categories.alias")}</small>
                  <strong>{rule.alias}</strong>
                </span>
                <ArrowRight aria-hidden="true" size={18} />
                <span>
                  <small>{t("manage.categories.category")}</small>
                  <strong>{rule.category}</strong>
                </span>
                <IconButton
                  icon={Trash2}
                  label={t("rules.deleteNamed", { name: rule.alias })}
                  onClick={() => setPendingDelete(rule)}
                />
              </li>
            ))}
          </ul>
        ) : resource.status === "loading" ? (
          <p className="loading-state">{t("rules.statusLoading")}</p>
        ) : (
          <EmptyState
            icon={Tags}
            title={t("manage.categories.emptyTitle")}
            message={t("manage.categories.emptyMessage")}
            action={
              <ActionButton icon={Plus} onClick={() => setCreatorOpen(true)}>
                {t("manage.categories.add")}
              </ActionButton>
            }
          />
        )}
      </section>
      <section className="manage-note" aria-labelledby="category-impact-title">
        <Tags aria-hidden="true" size={20} />
        <div>
          <h2 id="category-impact-title">
            {t("manage.categories.impactTitle")}
          </h2>
          <p>{t("manage.categories.impactSummary")}</p>
        </div>
      </section>

      <ModalDialog
        open={creatorOpen}
        title={t("manage.categories.add")}
        description={t("rules.categoryFormDescription")}
        onClose={() => {
          setCreatorOpen(false);
          setForm(defaultRule);
        }}
        initialFocusId="manage-rule-alias"
      >
        {saveMutation.status === "error" ? (
          <ErrorBanner message={saveMutation.error.message} />
        ) : null}
        <form className="dialog-form" onSubmit={save}>
          <Field
            id="manage-rule-alias"
            label={t("rules.aliasField")}
            hint={t("rules.aliasPlainHint")}
          >
            <input
              id="manage-rule-alias"
              required
              value={form.alias}
              onChange={(event) =>
                setForm({ ...form, alias: event.target.value })
              }
            />
          </Field>
          <Field
            id="manage-rule-category"
            label={t("rules.resultCategory")}
            hint={t("rules.categoryPlainHint")}
          >
            <input
              id="manage-rule-category"
              required
              value={form.category}
              onChange={(event) =>
                setForm({ ...form, category: event.target.value })
              }
            />
          </Field>
          <SubmitButton busy={saveMutation.status === "pending"} icon={Tags}>
            {t("manage.categories.add")}
          </SubmitButton>
        </form>
      </ModalDialog>

      <ModalDialog
        open={pendingDelete !== null}
        title={t("rules.deleteTitle")}
        description={pendingDelete?.alias}
        onClose={() => setPendingDelete(null)}
      >
        {deleteMutation.status === "error" ? (
          <ErrorBanner message={deleteMutation.error.message} />
        ) : null}
        <p className="dialog-copy">{t("rules.deleteDescription")}</p>
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
            onClick={() => {
              if (pendingDelete) void deleteMutation.mutate(pendingDelete.id);
            }}
          >
            <Trash2 aria-hidden="true" size={18} />
            {t("common.delete")}
          </button>
        </div>
      </ModalDialog>
    </>
  );
}

function DataView({
  navigation,
  selectedPeriod,
  onOpenTransactionImport,
  onOpenBudgetImport,
}: {
  navigation: ReactNode;
  selectedPeriod: { month: number; year: number };
  onOpenTransactionImport: () => void;
  onOpenBudgetImport: () => void;
}) {
  const { t } = useI18n();
  const transactionFilters = {
    ...selectedPeriod,
    category: "",
    transaction_type: "" as const,
  };
  const budgetFilters = { ...selectedPeriod, category: "" };
  return (
    <>
      <PageHeader
        eyebrow={t("manage.eyebrow")}
        title={t("manage.data.title")}
        summary={t("manage.data.summary")}
      />
      {navigation}
      <section className="manage-data-grid" aria-label={t("manage.data.title")}>
        <article className="manage-data-card">
          <ReceiptText aria-hidden="true" />
          <div>
            <h2>{t("manage.data.transactionsTitle")}</h2>
            <p>{t("manage.data.transactionsSummary")}</p>
            <small>{t("manage.data.duplicateNote")}</small>
          </div>
          <div className="manage-data-actions">
            <ActionButton
              icon={Upload}
              variant="secondary"
              onClick={onOpenTransactionImport}
            >
              {t("common.importCsv")}
            </ActionButton>
            <DownloadLink
              icon={Download}
              href={artifactUrls.transactionsCsv(transactionFilters)}
              download
            >
              {t("common.exportCsv")}
            </DownloadLink>
          </div>
        </article>
        <article className="manage-data-card">
          <Target aria-hidden="true" />
          <div>
            <h2>{t("manage.data.budgetsTitle")}</h2>
            <p>{t("manage.data.budgetsSummary")}</p>
            <small>{t("manage.data.budgetImportNote")}</small>
          </div>
          <div className="manage-data-actions">
            <ActionButton
              icon={Upload}
              variant="secondary"
              onClick={onOpenBudgetImport}
            >
              {t("common.importCsv")}
            </ActionButton>
            <DownloadLink
              icon={Download}
              href={artifactUrls.budgetsCsv(budgetFilters)}
              download
            >
              {t("common.exportCsv")}
            </DownloadLink>
          </div>
        </article>
      </section>
      <section className="manage-note" aria-labelledby="local-data-title">
        <Database aria-hidden="true" size={22} />
        <div>
          <h2 id="local-data-title">{t("manage.data.localTitle")}</h2>
          <p>{t("manage.data.localSummary")}</p>
        </div>
      </section>
    </>
  );
}

function PreferencesView({
  navigation,
  setNotice,
  onCurrencyChange,
}: {
  navigation: ReactNode;
  setNotice: (notice: string) => void;
  onCurrencyChange: (currency: string) => void;
}) {
  const { t } = useI18n();
  const settingsResource = useLedgerSettings();
  const [currency, setCurrencyValue] = useState("USD");
  useEffect(() => {
    if (settingsResource.data?.currency) {
      setCurrencyValue(settingsResource.data.currency);
    }
  }, [settingsResource.data?.currency]);
  const mutation = useUpdateLedgerSettings((response, nextCurrency) => {
    setNotice(localizedNotice(response, t));
    onCurrencyChange(nextCurrency);
  });

  return (
    <>
      <PageHeader
        eyebrow={t("manage.eyebrow")}
        title={t("manage.preferences.title")}
        summary={t("manage.preferences.summary")}
      />
      {navigation}
      {settingsResource.status === "error" ? (
        <ErrorBanner
          message={settingsResource.error.message}
          onRetry={settingsResource.refetch}
        />
      ) : null}
      {mutation.status === "error" ? (
        <ErrorBanner message={mutation.error.message} />
      ) : null}
      <section className="manage-preferences-grid">
        <article className="manage-group">
          <header>
            <div>
              <h2>{t("manage.preferences.currencyTitle")}</h2>
              <p>{t("manage.preferences.currencySummary")}</p>
            </div>
          </header>
          <form
            className="manage-preference-form"
            onSubmit={(event) => {
              event.preventDefault();
              void mutation.mutate(currency);
            }}
          >
            <Field
              id="manage-settings-currency"
              label={t("rules.settingsCurrency")}
              hint={t("rules.settingsHint")}
            >
              <select
                id="manage-settings-currency"
                value={currency}
                onChange={(event) => setCurrencyValue(event.target.value)}
              >
                <option value="USD">USD ($)</option>
                <option value="TRY">TRY (₺)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
              </select>
            </Field>
            <SubmitButton busy={mutation.status === "pending"} icon={Coins}>
              {t("rules.settingsSaveBtn")}
            </SubmitButton>
          </form>
        </article>
        <article className="manage-group">
          <header>
            <div>
              <h2>{t("manage.preferences.appearanceTitle")}</h2>
              <p>{t("manage.preferences.appearanceSummary")}</p>
            </div>
          </header>
          <div className="manage-quick-preferences">
            <div>
              <span>{t("manage.preferences.language")}</span>
              <LanguageToggle labeled />
            </div>
            <div>
              <span>{t("manage.preferences.theme")}</span>
              <ThemeToggle />
            </div>
          </div>
        </article>
      </section>
    </>
  );
}

function ManageContext({
  label,
  control,
}: {
  label: string;
  control: ReactNode;
}) {
  return (
    <div className="manage-context">
      <span>{label}</span>
      {control}
    </div>
  );
}
