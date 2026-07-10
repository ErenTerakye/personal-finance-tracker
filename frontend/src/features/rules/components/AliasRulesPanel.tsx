import { CheckCircle2, GitMerge, Info, Sparkles, Trash2 } from "lucide-react";
import {
  type Dispatch,
  type FormEvent,
  type SetStateAction,
  useState,
} from "react";
import type { CategoryRule, CategoryRuleInput } from "../../../types";
import { IconButton, SubmitButton } from "../../../shared/components/actions";
import { ErrorBanner } from "../../../shared/components/feedback";
import { Field } from "../../../shared/components/fields";
import { Panel } from "../../../shared/components/lists";
import { useI18n } from "../../../shared/i18n/I18nProvider";

const ALIAS_PRESETS = [
  { alias: "uber", category: "Transport" },
  { alias: "starbucks", category: "Food & Drinks" },
  { alias: "netflix", category: "Entertainment" },
  { alias: "amazon", category: "Shopping" },
  { alias: "spotify", category: "Entertainment" },
];

export function AliasRulesPanel({
  rules,
  detail,
  form,
  error,
  saving,
  onFormChange,
  onSave,
  onQuickAdd,
  onDelete,
}: {
  rules: CategoryRule[];
  detail: string;
  form: CategoryRuleInput;
  error: string;
  saving: boolean;
  onFormChange: Dispatch<SetStateAction<CategoryRuleInput>>;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
  onQuickAdd: (alias: string, category: string) => void;
  onDelete: (rule: CategoryRule) => void;
}) {
  const [showAliasPresets, setShowAliasPresets] = useState(false);
  const [playgroundInput, setPlaygroundInput] = useState("");
  const { t, tUpper } = useI18n();
  const matchedRule = playgroundInput.trim()
    ? rules.find(
        (rule) =>
          rule.alias.toLowerCase() === playgroundInput.trim().toLowerCase(),
      )
    : null;
  const ruleForm = form;
  const setRuleForm = onFormChange;
  const ruleError = error;
  const savingRule = saving;
  const aliasesDetail = detail;
  const saveRule = onSave;
  const quickAddAlias = onQuickAdd;
  const deleteRule = onDelete;

  return (
    <Panel title={t("rules.aliasesTitle")} detail={aliasesDetail}>
      {ruleError ? <ErrorBanner message={ruleError} /> : null}
      <form className="inline-form" onSubmit={saveRule}>
        <Field
          id="rule-alias"
          label={t("rules.aliasField")}
          hint={t("rules.aliasHint")}
        >
          <input
            id="rule-alias"
            required
            value={ruleForm.alias}
            onChange={(event) =>
              setRuleForm({ ...ruleForm, alias: event.target.value })
            }
          />
        </Field>
        <Field
          id="rule-category"
          label={t("common.category")}
          hint={t("rules.categoryHint")}
        >
          <input
            id="rule-category"
            required
            value={ruleForm.category}
            onChange={(event) =>
              setRuleForm({ ...ruleForm, category: event.target.value })
            }
          />
        </Field>
        <SubmitButton busy={savingRule} icon={GitMerge}>
          {t("rules.saveRuleBtn")}
        </SubmitButton>
      </form>

      {rules.length === 0 || showAliasPresets ? (
        <div className="presets-box">
          <span className="presets-title">{tUpper("rules.presetsTitle")}</span>
          <div className="preset-chips">
            {ALIAS_PRESETS.map((preset) => {
              const alreadyExists = rules.some(
                (r) => r.alias.toLowerCase() === preset.alias.toLowerCase(),
              );
              const translatedCategory =
                t(`categories.${preset.category}`) || preset.category;
              return (
                <button
                  key={preset.alias}
                  type="button"
                  className="preset-chip"
                  disabled={alreadyExists || savingRule}
                  onClick={() =>
                    quickAddAlias(preset.alias, translatedCategory)
                  }
                  title={
                    alreadyExists
                      ? t("rules.alreadyAdded")
                      : t("rules.addPreset", {
                          name: `${preset.alias} -> ${translatedCategory}`,
                        })
                  }
                >
                  <Sparkles size={12} />
                  <span>
                    {preset.alias} &rarr; {translatedCategory}
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
          <Sparkles size={12} /> {t("rules.presetsToggle")}
        </button>
      )}

      <RuleList rules={rules} onDelete={deleteRule} />

      <div className="playground-box">
        <h3>{t("rules.playgroundTitle")}</h3>
        <div className="playground-input-group">
          <input
            type="text"
            placeholder={t("rules.playgroundPlaceholder")}
            value={playgroundInput}
            onChange={(e) => setPlaygroundInput(e.target.value)}
          />
        </div>
        {playgroundInput.trim() ? (
          matchedRule ? (
            <div className="playground-result success" role="status">
              <CheckCircle2 size={16} />
              <span>
                {t("rules.playgroundSuccess", {
                  input: playgroundInput,
                  category: matchedRule.category,
                  alias: matchedRule.alias,
                })}
              </span>
            </div>
          ) : (
            <div className="playground-result neutral" role="status">
              <Info size={16} />
              <span>
                {t("rules.playgroundNeutral", { input: playgroundInput })}
              </span>
            </div>
          )
        ) : null}
      </div>
    </Panel>
  );
}

function RuleList({
  rules,
  onDelete,
}: {
  rules: CategoryRule[];
  onDelete: (rule: CategoryRule) => void;
}) {
  const { t } = useI18n();

  if (!rules.length) {
    return <p className="empty-inline">{t("rules.emptyRules")}</p>;
  }
  return (
    <ul className="rule-list" aria-label={t("rules.aliasesTitle")}>
      {rules.map((rule) => (
        <li key={rule.id}>
          <span>
            <strong>{rule.alias}</strong>
            <em>&rarr; {rule.category}</em>
          </span>
          <IconButton
            icon={Trash2}
            label={`${t("common.delete")} ${rule.alias} ${t("rules.aliasesTitle").toLowerCase()}`}
            onClick={() => onDelete(rule)}
          />
        </li>
      ))}
    </ul>
  );
}
