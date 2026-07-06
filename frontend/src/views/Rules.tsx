import { FormEvent, useEffect, useState } from "react";
import { CalendarCheck, GitMerge, Plus, Trash2, Sparkles, CheckCircle2, Info, Settings } from "lucide-react";
import { api } from "../api";
import { money, periodLabel } from "../format";
import type {
  CategoryRule,
  CategoryRuleInput,
  RecurringTemplate,
  RecurringTemplateInput,
  TransactionType
} from "../types";
import {
  ActionButton,
  ErrorBanner,
  Field,
  IconButton,
  PageHeader,
  Panel,
  SubmitButton
} from "../components/ui";

const defaultRule: CategoryRuleInput = { alias: "", category: "" };

const defaultTemplate: RecurringTemplateInput = {
  type: "expense",
  amount: "",
  category: "",
  description: "",
  day_of_month: 1
};

const ALIAS_PRESETS = [
  { alias: "uber", category: "Transport" },
  { alias: "starbucks", category: "Food & Drinks" },
  { alias: "netflix", category: "Entertainment" },
  { alias: "amazon", category: "Shopping" },
  { alias: "spotify", category: "Entertainment" }
];

const TEMPLATE_PRESETS = [
  { type: "expense" as const, amount: "1200.00", category: "Rent", day_of_month: 1, description: "Monthly Rent" },
  { type: "income" as const, amount: "3000.00", category: "Salary", day_of_month: 25, description: "Paycheck" },
  { type: "expense" as const, amount: "15.49", category: "Entertainment", day_of_month: 15, description: "Netflix Subscription" },
  { type: "expense" as const, amount: "50.00", category: "Health & Wellness", day_of_month: 5, description: "Gym Membership" },
  { type: "expense" as const, amount: "100.00", category: "Utilities", day_of_month: 10, description: "Electric Bill" }
];

export function RulesView({
  selectedPeriod,
  setNotice,
  onCurrencyChange
}: {
  selectedPeriod: { month: number; year: number };
  setNotice: (notice: string) => void;
  onCurrencyChange: (currency: string) => void;
}) {
  const [rules, setRules] = useState<CategoryRule[]>([]);
  const [templates, setTemplates] = useState<RecurringTemplate[]>([]);
  const [ruleForm, setRuleForm] = useState<CategoryRuleInput>(defaultRule);
  const [templateForm, setTemplateForm] = useState<RecurringTemplateInput>(defaultTemplate);
  const [error, setError] = useState("");
  const [ruleError, setRuleError] = useState("");
  const [templateError, setTemplateError] = useState("");
  const [currency, setLocalCurrency] = useState("USD");
  const [loading, setLoading] = useState(true);
  const [savingRule, setSavingRule] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [savingCurrency, setSavingCurrency] = useState(false);
  const [applying, setApplying] = useState(false);

  // Redesign additions: presets toggle and playground input states
  const [showAliasPresets, setShowAliasPresets] = useState(false);
  const [showTemplatePresets, setShowTemplatePresets] = useState(false);
  const [playgroundInput, setPlaygroundInput] = useState("");

  const load = () => {
    setError("");
    setLoading(true);
    Promise.all([api.categoryRules(), api.recurringTemplates(), api.getSettings()])
      .then(([ruleResponse, templateResponse, settingsResponse]) => {
        setRules(ruleResponse.rules);
        setTemplates(templateResponse.templates);
        setLocalCurrency(settingsResponse.currency);
      })
      .catch((err: Error) => setError(readError(err)))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  async function saveRule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRuleError("");
    setSavingRule(true);
    try {
      const response = await api.setCategoryRule(ruleForm);
      setNotice(response.notice);
      setRuleForm(defaultRule);
      load();
    } catch (err) {
      setRuleError(readError(err));
    } finally {
      setSavingRule(false);
    }
  }

  async function quickAddAlias(alias: string, category: string) {
    setRuleError("");
    setSavingRule(true);
    try {
      const response = await api.setCategoryRule({ alias, category });
      setNotice(response.notice);
      load();
    } catch (err) {
      setRuleError(readError(err));
    } finally {
      setSavingRule(false);
    }
  }

  async function saveTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTemplateError("");
    setSavingTemplate(true);
    try {
      const response = await api.createRecurringTemplate(templateForm);
      setNotice(response.notice);
      setTemplateForm(defaultTemplate);
      load();
    } catch (err) {
      setTemplateError(readError(err));
    } finally {
      setSavingTemplate(false);
    }
  }

  async function quickAddTemplate(preset: typeof TEMPLATE_PRESETS[0]) {
    setTemplateError("");
    setSavingTemplate(true);
    try {
      const response = await api.createRecurringTemplate(preset);
      setNotice(response.notice);
      load();
    } catch (err) {
      setTemplateError(readError(err));
    } finally {
      setSavingTemplate(false);
    }
  }

  async function saveCurrency(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSavingCurrency(true);
    try {
      const response = await api.updateSettings({ currency });
      setNotice(response.notice);
      onCurrencyChange(currency);
    } catch (err) {
      setError(readError(err));
    } finally {
      setSavingCurrency(false);
    }
  }

  async function deleteRule(rule: CategoryRule) {
    const response = await api.deleteCategoryRule(rule.id);
    setNotice(response.notice);
    load();
  }

  async function deleteTemplate(template: RecurringTemplate) {
    const response = await api.deleteRecurringTemplate(template.id);
    setNotice(response.notice);
    load();
  }

  async function applyTemplates() {
    setError("");
    setApplying(true);
    try {
      const response = await api.applyRecurringTemplates(selectedPeriod.month, selectedPeriod.year);
      setNotice(response.notice);
    } catch (err) {
      setError(readError(err));
    } finally {
      setApplying(false);
    }
  }

  // Interactive playground evaluation
  const matchedRule = playgroundInput.trim()
    ? rules.find((r) => r.alias.toLowerCase() === playgroundInput.trim().toLowerCase())
    : null;

  return (
    <>
      <PageHeader
        eyebrow="Rules"
        title="Rules"
        summary="Normalize categories and apply predictable monthly entries."
        actions={
          <ActionButton icon={CalendarCheck} onClick={applyTemplates} disabled={applying}>
            Apply for {periodLabel(selectedPeriod.month, selectedPeriod.year)}
          </ActionButton>
        }
      />

      {error ? <ErrorBanner message={error} /> : null}

      {/* Educational banners */}
      <div className="rules-intro-grid">
        <article className="info-card">
          <div className="info-card-icon" aria-hidden="true">
            <GitMerge size={20} />
          </div>
          <div className="info-card-content">
            <h3>Category Aliases</h3>
            <p>
              Automatically clean up imported CSV category names. For example, if your bank imports
              "uber" or "netflix", aliases will map them to "Transport" or "Entertainment" to keep your charts uniform.
            </p>
          </div>
        </article>

        <article className="info-card">
          <div className="info-card-icon" aria-hidden="true">
            <CalendarCheck size={20} />
          </div>
          <div className="info-card-content">
            <h3>Recurring Templates</h3>
            <p>
              Pre-define repeat expenses or income (like rent, gym dues, or salary). Click "Apply for [Month]" at the top right to post all active templates as transactions for that month instantly.
            </p>
          </div>
        </article>
      </div>

      <section className="rules-layout">
        <Panel title="Category aliases" detail={loading ? "Loading rules" : `${rules.length} rules`}>
          {ruleError ? <ErrorBanner message={ruleError} /> : null}
          <form className="inline-form" onSubmit={saveRule}>
            <Field id="rule-alias" label="Alias" hint="Example: groceries">
              <input
                id="rule-alias"
                required
                value={ruleForm.alias}
                onChange={(event) => setRuleForm({ ...ruleForm, alias: event.target.value })}
              />
            </Field>
            <Field id="rule-category" label="Category" hint="Example: Food">
              <input
                id="rule-category"
                required
                value={ruleForm.category}
                onChange={(event) => setRuleForm({ ...ruleForm, category: event.target.value })}
              />
            </Field>
            <SubmitButton busy={savingRule} icon={GitMerge}>
              Save rule
            </SubmitButton>
          </form>

          {/* Quick-add popular aliases suggestions */}
          {rules.length === 0 || showAliasPresets ? (
            <div className="presets-box">
              <span className="presets-title">Quick-add popular aliases:</span>
              <div className="preset-chips">
                {ALIAS_PRESETS.map((preset) => {
                  const alreadyExists = rules.some(
                    (r) => r.alias.toLowerCase() === preset.alias.toLowerCase()
                  );
                  return (
                    <button
                      key={preset.alias}
                      type="button"
                      className="preset-chip"
                      disabled={alreadyExists || savingRule}
                      onClick={() => quickAddAlias(preset.alias, preset.category)}
                      title={alreadyExists ? "Already added" : `Add ${preset.alias} -> ${preset.category}`}
                    >
                      <Sparkles size={12} />
                      <span>
                        {preset.alias} &rarr; {preset.category}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="presets-toggle-btn"
              onClick={() => setShowAliasPresets(true)}
            >
              <Sparkles size={12} /> Show Quick-Add Presets
            </button>
          )}

          <RuleList rules={rules} onDelete={deleteRule} />

          {/* Testing Playground Sandbox */}
          <div className="playground-box">
            <h3>Test category mapping</h3>
            <div className="playground-input-group">
              <input
                type="text"
                placeholder="Type a CSV category (e.g. uber, netflix)..."
                value={playgroundInput}
                onChange={(e) => setPlaygroundInput(e.target.value)}
              />
            </div>
            {playgroundInput.trim() ? (
              matchedRule ? (
                <div className="playground-result success" role="status">
                  <CheckCircle2 size={16} />
                  <span>
                    Maps <strong>"{playgroundInput}"</strong> to canonical category{" "}
                    <strong>"{matchedRule.category}"</strong> (via alias "{matchedRule.alias}")
                  </span>
                </div>
              ) : (
                <div className="playground-result neutral" role="status">
                  <Info size={16} />
                  <span>
                    No active alias matches <strong>"{playgroundInput}"</strong>. It will import unchanged.
                  </span>
                </div>
              )
            ) : null}
          </div>
        </Panel>

        <Panel title="Recurring templates" detail={loading ? "Loading templates" : `${templates.length} templates`}>
          {templateError ? <ErrorBanner message={templateError} /> : null}
          <form className="template-form" onSubmit={saveTemplate}>
            <fieldset className="segmented-field">
              <legend>Type</legend>
              <label>
                <input
                  name="recurring-type"
                  type="radio"
                  value="expense"
                  checked={templateForm.type === "expense"}
                  onChange={() => setTemplateForm({ ...templateForm, type: "expense" })}
                />
                  <span>Expense</span>
              </label>
              <label>
                <input
                  name="recurring-type"
                  type="radio"
                  value="income"
                  checked={templateForm.type === "income"}
                  onChange={() => setTemplateForm({ ...templateForm, type: "income" })}
                />
                <span>Income</span>
              </label>
            </fieldset>
            <Field id="template-amount" label="Amount">
              <input
                id="template-amount"
                inputMode="decimal"
                required
                value={templateForm.amount}
                onChange={(event) => setTemplateForm({ ...templateForm, amount: event.target.value })}
              />
            </Field>
            <Field id="template-category" label="Category">
              <input
                id="template-category"
                required
                value={templateForm.category}
                onChange={(event) => setTemplateForm({ ...templateForm, category: event.target.value })}
              />
            </Field>
            <Field id="template-day" label="Day">
              <input
                id="template-day"
                min="1"
                max="31"
                type="number"
                required
                value={templateForm.day_of_month}
                onChange={(event) =>
                  setTemplateForm({ ...templateForm, day_of_month: Number(event.target.value) })
                }
              />
            </Field>
            <Field id="template-description" label="Description">
              <input
                id="template-description"
                value={templateForm.description}
                onChange={(event) =>
                  setTemplateForm({ ...templateForm, description: event.target.value })
                }
              />
            </Field>
            <SubmitButton busy={savingTemplate} icon={Plus}>
              Save template
            </SubmitButton>
          </form>

          {/* Quick-add popular templates suggestions */}
          {templates.length === 0 || showTemplatePresets ? (
            <div className="presets-box">
              <span className="presets-title">Quick-add standard templates:</span>
              <div className="preset-grid">
                {TEMPLATE_PRESETS.map((preset) => {
                  const alreadyExists = templates.some(
                    (t) =>
                      t.category.toLowerCase() === preset.category.toLowerCase() &&
                      t.type === preset.type
                  );
                  return (
                    <button
                      key={`${preset.type}-${preset.category}`}
                      type="button"
                      className="preset-grid-card"
                      disabled={alreadyExists || savingTemplate}
                      onClick={() => quickAddTemplate(preset)}
                      title={alreadyExists ? "Already added" : `Add ${preset.category}`}
                    >
                      <strong>{preset.category}</strong>
                      <span>
                        {preset.type === "expense" ? "-" : "+"}{money(preset.amount)} (Day {preset.day_of_month})
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="presets-toggle-btn"
              onClick={() => setShowTemplatePresets(true)}
            >
              <Sparkles size={12} /> Show Quick-Add Presets
            </button>
          )}

          <TemplateList templates={templates} onDelete={deleteTemplate} />
        </Panel>

        <Panel title="Ledger settings" className="settings-panel">
          {error ? <ErrorBanner message={error} /> : null}
          <form className="inline-form" onSubmit={saveCurrency}>
            <Field id="settings-currency" label="Ledger currency" hint="Changing currency updates formatting across all screens.">
              <select
                id="settings-currency"
                required
                value={currency}
                onChange={(event) => setLocalCurrency(event.target.value)}
              >
                <option value="USD">USD ($)</option>
                <option value="TRY">TRY (₺)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
              </select>
            </Field>
            <SubmitButton busy={savingCurrency} icon={Settings}>
              Save settings
            </SubmitButton>
          </form>
        </Panel>
      </section>
    </>
  );
}

function RuleList({
  rules,
  onDelete
}: {
  rules: CategoryRule[];
  onDelete: (rule: CategoryRule) => void;
}) {
  if (!rules.length) {
    return <p className="empty-inline">No category aliases yet.</p>;
  }
  return (
    <ul className="rule-list" aria-label="Category alias rules">
      {rules.map((rule) => (
        <li key={rule.id}>
          <span>
            <strong>{rule.alias}</strong>
            <em>&rarr; {rule.category}</em>
          </span>
          <IconButton icon={Trash2} label={`Delete ${rule.alias} rule`} onClick={() => onDelete(rule)} />
        </li>
      ))}
    </ul>
  );
}

function TemplateList({
  templates,
  onDelete
}: {
  templates: RecurringTemplate[];
  onDelete: (template: RecurringTemplate) => void;
}) {
  if (!templates.length) {
    return <p className="empty-inline">No recurring templates yet.</p>;
  }
  return (
    <ul className="template-list" aria-label="Recurring templates">
      {templates.map((template) => (
        <li key={template.id}>
          <span>
            <strong>
              <span className={`template-badge ${template.type}`}>{template.type}</span>
              {template.category} {money(template.amount)}
            </strong>
            <em>
              on day {template.day_of_month}
              {template.description ? ` - ${template.description}` : ""}
            </em>
          </span>
          <IconButton
            icon={Trash2}
            label={`Delete ${template.category} template`}
            onClick={() => onDelete(template)}
          />
        </li>
      ))}
    </ul>
  );
}

function readError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "The request could not be completed.";
}
