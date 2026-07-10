import { FormEvent, useEffect, useState } from "react";
import { CalendarCheck } from "lucide-react";
import { periodLabel } from "../../shared/format/periods";
import type {
  CategoryRule,
  CategoryRuleInput,
  RecurringTemplate,
  RecurringTemplateInput,
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
import { RulesIntro } from "./components/RulesIntro";

const defaultRule: CategoryRuleInput = { alias: "", category: "" };

const defaultTemplate: RecurringTemplateInput = {
  type: "expense",
  amount: "",
  category: "",
  description: "",
  day_of_month: 1,
};

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

  const { t, tUpper } = useI18n();
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
  });

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

  return (
    <>
      <PageHeader
        eyebrow={tUpper("rules.title")}
        title={t("rules.title")}
        summary={t("rules.summary")}
        actions={
          <ActionButton
            icon={CalendarCheck}
            onClick={applyTemplates}
            disabled={applying}
          >
            {t("rules.applyFor", {
              period: periodLabel(selectedPeriod.month, selectedPeriod.year),
            })}
          </ActionButton>
        }
      />

      {actionError || resourceError ? (
        <ErrorBanner message={actionError || resourceError} />
      ) : null}

      <RulesIntro />

      <section className="rules-layout">
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

        <LedgerSettingsPanel
          currency={currency}
          error={actionError}
          saving={savingCurrency}
          onCurrencyChange={setLocalCurrency}
          onSave={saveCurrency}
        />
      </section>
    </>
  );
}
