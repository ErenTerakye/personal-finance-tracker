import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { CalendarCheck } from "lucide-react";
import { periodLabel } from "../../shared/format/periods";
import { money } from "../../shared/format/money";
import type {
  CategoryRule,
  CategoryRuleInput,
  RecurringTemplate,
  RecurringTemplateInput,
  RecurringApplyResponse,
} from "../../types";
import { ActionButton } from "../../shared/components/actions";
import { ErrorBanner } from "../../shared/components/feedback";
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
import { AliasRulesPanel } from "./components/AliasRulesPanel";
import { LedgerSettingsPanel } from "./components/LedgerSettingsPanel";
import { RecurringTemplatesPanel } from "./components/RecurringTemplatesPanel";

const defaultRule: CategoryRuleInput = { alias: "", category: "" };

const defaultTemplate: RecurringTemplateInput = {
  type: "expense",
  amount: "",
  category: "",
  description: "",
  day_of_month: 1,
};

const ruleTabs = ["categories", "recurring", "preferences"] as const;
type RuleTab = (typeof ruleTabs)[number];

function tabFromUrl(): RuleTab {
  const tab = new URLSearchParams(window.location.search).get("tab");
  return ruleTabs.includes(tab as RuleTab) ? (tab as RuleTab) : "categories";
}

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
  const [currency, setLocalCurrency] = useState("USD");
  const [activeTab, setActiveTab] = useState<RuleTab>(tabFromUrl);
  const [showApplyPreview, setShowApplyPreview] = useState(false);
  const [applyResult, setApplyResult] = useState<RecurringApplyResponse | null>(
    null,
  );
  const tabRefs = useRef<Record<RuleTab, HTMLButtonElement | null>>({
    categories: null,
    recurring: null,
    preferences: null,
  });
  const previewDialogRef = useRef<HTMLDialogElement | null>(null);

  const { t, locale } = useI18n();
  const ruleResource = useCategoryRules();
  const templateResource = useRecurringTemplates();
  const settingsResource = useLedgerSettings();
  const rules = ruleResource.data?.rules ?? [];
  const templates = templateResource.data?.templates ?? [];
  const loading =
    ruleResource.status === "loading" ||
    templateResource.status === "loading" ||
    settingsResource.status === "loading";

  useEffect(() => {
    if (settingsResource.status === "success") {
      setLocalCurrency(settingsResource.data.currency);
    }
  }, [settingsResource.status, settingsResource.data]);

  const load = () => {
    ruleResource.refetch();
    templateResource.refetch();
    settingsResource.refetch();
  };
  const saveRuleMutation = useSaveCategoryRule((response) => {
    setNotice(localizedNotice(response, t));
    setRuleForm(defaultRule);
    load();
  });
  const deleteRuleMutation = useDeleteCategoryRule((response) => {
    setNotice(localizedNotice(response, t));
    load();
  });
  const saveTemplateMutation = useSaveRecurringTemplate((response) => {
    setNotice(localizedNotice(response, t));
    setTemplateForm(defaultTemplate);
    load();
  });
  const deleteTemplateMutation = useDeleteRecurringTemplate((response) => {
    setNotice(localizedNotice(response, t));
    load();
  });
  const settingsMutation = useUpdateLedgerSettings((response, nextCurrency) => {
    setNotice(localizedNotice(response, t));
    onCurrencyChange(nextCurrency);
  });
  const applyMutation = useApplyRecurringTemplates((response) => {
    setNotice(localizedNotice(response, t));
    setApplyResult(response);
    setShowApplyPreview(false);
  });

  useEffect(() => {
    const syncTab = () => setActiveTab(tabFromUrl());
    window.addEventListener("popstate", syncTab);
    return () => window.removeEventListener("popstate", syncTab);
  }, []);

  useEffect(() => {
    if (showApplyPreview && !previewDialogRef.current?.open) {
      previewDialogRef.current?.showModal();
    }
  }, [showApplyPreview]);

  const resourceError =
    ruleResource.status === "error"
      ? ruleResource.error.message
      : templateResource.status === "error"
        ? templateResource.error.message
        : settingsResource.status === "error"
          ? settingsResource.error.message
          : "";

  function saveRule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void saveRuleMutation.mutate(ruleForm);
  }

  function quickAddAlias(alias: string, category: string) {
    void saveRuleMutation.mutate({ alias, category });
  }

  function saveTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void saveTemplateMutation.mutate(templateForm);
  }

  function quickAddTemplate(preset: RecurringTemplateInput) {
    void saveTemplateMutation.mutate(preset);
  }

  function saveCurrency(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void settingsMutation.mutate(currency);
  }

  function deleteRule(rule: CategoryRule) {
    void deleteRuleMutation.mutate(rule.id);
  }

  function deleteTemplate(template: RecurringTemplate) {
    void deleteTemplateMutation.mutate(template.id);
  }

  function applyTemplates() {
    void applyMutation.mutate(selectedPeriod);
  }

  function selectTab(tab: RuleTab, replace = false) {
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    window.history[replace ? "replaceState" : "pushState"](
      {},
      "",
      `${url.pathname}${url.search}`,
    );
    setActiveTab(tab);
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const currentIndex = ruleTabs.indexOf(activeTab);
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight")
      nextIndex = (currentIndex + 1) % ruleTabs.length;
    if (event.key === "ArrowLeft")
      nextIndex = (currentIndex - 1 + ruleTabs.length) % ruleTabs.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = ruleTabs.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    const nextTab = ruleTabs[nextIndex];
    selectTab(nextTab);
    tabRefs.current[nextTab]?.focus();
  }

  const ruleError =
    saveRuleMutation.status === "error"
      ? saveRuleMutation.error.message
      : deleteRuleMutation.status === "error"
        ? deleteRuleMutation.error.message
        : "";
  const templateError =
    saveTemplateMutation.status === "error"
      ? saveTemplateMutation.error.message
      : deleteTemplateMutation.status === "error"
        ? deleteTemplateMutation.error.message
        : "";
  const actionError =
    settingsMutation.status === "error"
      ? settingsMutation.error.message
      : applyMutation.status === "error"
        ? applyMutation.error.message
        : "";
  const savingRule = saveRuleMutation.status === "pending";
  const savingTemplate = saveTemplateMutation.status === "pending";
  const savingCurrency = settingsMutation.status === "pending";
  const applying = applyMutation.status === "pending";

  const aliasesDetail = loading
    ? t("rules.aliasesLoading")
    : t("rules.aliasesCount", { count: rules.length });

  const templatesDetail = loading
    ? t("rules.templatesLoading")
    : t("rules.templatesCount", { count: templates.length });

  const tabLabels: Record<RuleTab, string> =
    locale === "tr"
      ? {
          categories: "Kategoriler",
          recurring: "Yinelenen",
          preferences: "Tercihler",
        }
      : {
          categories: "Categories",
          recurring: "Recurring",
          preferences: "Preferences",
        };
  const previewCopy =
    locale === "tr"
      ? {
          title: "Yinelenen işlemleri önizle",
          intro:
            "Bu işlem seçili dönem için etkin şablonlardan işlem oluşturur. Mevcut yinelenen işlemler atlanır.",
          empty: "Uygulanacak etkin şablon yok.",
          cancel: "İptal",
          confirm: "İşlemleri oluştur",
          result: (created: number, skipped: number) =>
            `${created} işlem oluşturuldu; ${skipped} yinelenen işlem atlandı.`,
        }
      : {
          title: "Preview recurring entries",
          intro:
            "This creates transactions from active templates for the selected period. Existing recurring transactions will be skipped.",
          empty: "There are no active templates to apply.",
          cancel: "Cancel",
          confirm: "Create transactions",
          result: (created: number, skipped: number) =>
            `${created} transactions created; ${skipped} duplicates skipped.`,
        };
  const activeTemplates = templates.filter((template) => template.active);

  return (
    <>
      <PageHeader
        title={t("rules.title")}
        summary={t("rules.summary")}
        actions={
          activeTab === "recurring" ? (
            <ActionButton
              icon={CalendarCheck}
              onClick={() => {
                setApplyResult(null);
                setShowApplyPreview(true);
              }}
              disabled={applying}
            >
              {t("rules.applyFor", {
                period: periodLabel(selectedPeriod.month, selectedPeriod.year),
              })}
            </ActionButton>
          ) : undefined
        }
      />

      {actionError ? <ErrorBanner message={actionError} /> : null}
      {resourceError ? (
        <ErrorBanner message={resourceError} onRetry={load} />
      ) : null}

      <div className="rules-tabs" role="tablist" aria-label={t("rules.title")}>
        {ruleTabs.map((tab) => (
          <button
            key={tab}
            ref={(node) => {
              tabRefs.current[tab] = node;
            }}
            type="button"
            role="tab"
            id={`rules-tab-${tab}`}
            aria-controls={`rules-panel-${tab}`}
            aria-selected={activeTab === tab}
            tabIndex={activeTab === tab ? 0 : -1}
            onClick={() => selectTab(tab)}
            onKeyDown={handleTabKeyDown}
          >
            {tabLabels[tab]}
          </button>
        ))}
      </div>

      <section
        className="rules-layout"
        role="tabpanel"
        id="rules-panel-categories"
        aria-labelledby="rules-tab-categories"
        tabIndex={0}
        hidden={activeTab !== "categories"}
      >
        <AliasRulesPanel
          rules={rules}
          detail={aliasesDetail}
          form={ruleForm}
          error={ruleError}
          saving={savingRule}
          onFormChange={setRuleForm}
          onSave={saveRule}
          onQuickAdd={quickAddAlias}
          onDelete={deleteRule}
        />
      </section>

      <section
        className="rules-layout"
        role="tabpanel"
        id="rules-panel-recurring"
        aria-labelledby="rules-tab-recurring"
        tabIndex={0}
        hidden={activeTab !== "recurring"}
      >
        <RecurringTemplatesPanel
          templates={templates}
          detail={templatesDetail}
          form={templateForm}
          error={templateError}
          saving={savingTemplate}
          onFormChange={setTemplateForm}
          onSave={saveTemplate}
          onQuickAdd={quickAddTemplate}
          onDelete={deleteTemplate}
        />
        {applyResult ? (
          <p className="notice" role="status">
            {previewCopy.result(
              applyResult.created_count,
              applyResult.skipped_duplicates,
            )}
          </p>
        ) : null}
      </section>

      <section
        className="rules-layout"
        role="tabpanel"
        id="rules-panel-preferences"
        aria-labelledby="rules-tab-preferences"
        tabIndex={0}
        hidden={activeTab !== "preferences"}
      >
        <LedgerSettingsPanel
          currency={currency}
          error={actionError}
          saving={savingCurrency}
          onCurrencyChange={setLocalCurrency}
          onSave={saveCurrency}
        />
      </section>

      {showApplyPreview ? (
        <dialog
          ref={previewDialogRef}
          className="dialog-panel"
          aria-labelledby="recurring-preview-title"
          onCancel={() => setShowApplyPreview(false)}
        >
          <h2 id="recurring-preview-title">{previewCopy.title}</h2>
          <p>{previewCopy.intro}</p>
          <p>
            <strong>
              {periodLabel(selectedPeriod.month, selectedPeriod.year)}
            </strong>
          </p>
          {activeTemplates.length ? (
            <ul className="template-list">
              {activeTemplates.map((template) => (
                <li key={template.id}>
                  <span>
                    <strong>
                      {template.category} {money(template.amount)}
                    </strong>
                    <em>
                      {t("rules.onDayText", { day: template.day_of_month })}
                    </em>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p>{previewCopy.empty}</p>
          )}
          <div className="dialog-actions">
            <button type="button" onClick={() => setShowApplyPreview(false)}>
              {previewCopy.cancel}
            </button>
            <ActionButton
              icon={CalendarCheck}
              onClick={applyTemplates}
              disabled={applying || activeTemplates.length === 0}
            >
              {previewCopy.confirm}
            </ActionButton>
          </div>
        </dialog>
      ) : null}
    </>
  );
}
