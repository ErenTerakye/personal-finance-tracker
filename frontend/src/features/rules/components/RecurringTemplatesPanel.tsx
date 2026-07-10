import { Plus, Sparkles, Trash2 } from "lucide-react";
import {
  type Dispatch,
  type FormEvent,
  type SetStateAction,
  useState,
} from "react";
import type { RecurringTemplate, RecurringTemplateInput } from "../../../types";
import { IconButton, SubmitButton } from "../../../shared/components/actions";
import { ErrorBanner } from "../../../shared/components/feedback";
import { Field } from "../../../shared/components/fields";
import { Panel } from "../../../shared/components/lists";
import { money } from "../../../shared/format/money";
import { useI18n } from "../../../shared/i18n/I18nProvider";

const TEMPLATE_PRESETS: RecurringTemplateInput[] = [
  {
    type: "expense",
    amount: "1200.00",
    category: "Rent",
    day_of_month: 1,
    description: "Monthly Rent",
  },
  {
    type: "income",
    amount: "3000.00",
    category: "Salary",
    day_of_month: 25,
    description: "Paycheck",
  },
  {
    type: "expense",
    amount: "15.49",
    category: "Entertainment",
    day_of_month: 15,
    description: "Netflix Subscription",
  },
  {
    type: "expense",
    amount: "50.00",
    category: "Health & Wellness",
    day_of_month: 5,
    description: "Gym Membership",
  },
  {
    type: "expense",
    amount: "100.00",
    category: "Utilities",
    day_of_month: 10,
    description: "Electric Bill",
  },
];

export function RecurringTemplatesPanel({
  templates,
  detail,
  form,
  error,
  saving,
  onFormChange,
  onSave,
  onQuickAdd,
  onDelete,
}: {
  templates: RecurringTemplate[];
  detail: string;
  form: RecurringTemplateInput;
  error: string;
  saving: boolean;
  onFormChange: Dispatch<SetStateAction<RecurringTemplateInput>>;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
  onQuickAdd: (preset: RecurringTemplateInput) => void;
  onDelete: (template: RecurringTemplate) => void;
}) {
  const [showTemplatePresets, setShowTemplatePresets] = useState(false);
  const { t, tUpper } = useI18n();
  const templateForm = form;
  const setTemplateForm = onFormChange;
  const templateError = error;
  const savingTemplate = saving;
  const templatesDetail = detail;
  const saveTemplate = onSave;
  const quickAddTemplate = onQuickAdd;
  const deleteTemplate = onDelete;

  return (
    <Panel title={t("rules.templatesTitle")} detail={templatesDetail}>
      {templateError ? <ErrorBanner message={templateError} /> : null}
      <form className="template-form" onSubmit={saveTemplate}>
        <fieldset className="segmented-field">
          <legend>{t("common.type")}</legend>
          <label>
            <input
              name="recurring-type"
              type="radio"
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
              name="recurring-type"
              type="radio"
              value="income"
              checked={templateForm.type === "income"}
              onChange={() =>
                setTemplateForm({ ...templateForm, type: "income" })
              }
            />
            <span>{t("common.income")}</span>
          </label>
        </fieldset>
        <Field id="template-amount" label={t("common.amount")}>
          <input
            id="template-amount"
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
        <Field id="template-category" label={t("common.category")}>
          <input
            id="template-category"
            required
            value={templateForm.category}
            onChange={(event) =>
              setTemplateForm({
                ...templateForm,
                category: event.target.value,
              })
            }
          />
        </Field>
        <Field id="template-day" label={t("rules.dayField")}>
          <input
            id="template-day"
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
        <Field id="template-description" label={t("common.description")}>
          <input
            id="template-description"
            value={templateForm.description}
            onChange={(event) =>
              setTemplateForm({
                ...templateForm,
                description: event.target.value,
              })
            }
          />
        </Field>
        <SubmitButton busy={savingTemplate} icon={Plus}>
          {t("rules.saveTemplateBtn")}
        </SubmitButton>
      </form>

      {templates.length === 0 || showTemplatePresets ? (
        <div className="presets-box">
          <span className="presets-title">
            {tUpper("rules.presetsTemplatesTitle")}
          </span>
          <div className="preset-grid">
            {TEMPLATE_PRESETS.map((preset) => {
              const alreadyExists = templates.some(
                (t) =>
                  t.category.toLowerCase() === preset.category.toLowerCase() &&
                  t.type === preset.type,
              );
              const translatedCategory =
                t(`categories.${preset.category}`) || preset.category;
              const translatedDesc =
                t(`presets.${preset.description}`) || preset.description;
              return (
                <button
                  key={`${preset.type}-${preset.category}`}
                  type="button"
                  className="preset-grid-card"
                  disabled={alreadyExists || savingTemplate}
                  onClick={() =>
                    quickAddTemplate({
                      ...preset,
                      category: translatedCategory,
                      description: translatedDesc,
                    })
                  }
                  title={
                    alreadyExists
                      ? t("rules.alreadyAdded")
                      : t("rules.addPreset", { name: translatedCategory })
                  }
                >
                  <strong>{translatedCategory}</strong>
                  <span>
                    {preset.type === "expense" ? "-" : "+"}
                    {money(preset.amount)} (
                    {t("rules.onDayText", { day: preset.day_of_month })})
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
          <Sparkles size={12} /> {t("rules.presetsTemplatesToggle")}
        </button>
      )}

      <TemplateList templates={templates} onDelete={deleteTemplate} />
    </Panel>
  );
}

function TemplateList({
  templates,
  onDelete,
}: {
  templates: RecurringTemplate[];
  onDelete: (template: RecurringTemplate) => void;
}) {
  const { t, tUpper } = useI18n();

  if (!templates.length) {
    return <p className="empty-inline">{t("rules.emptyTemplates")}</p>;
  }
  return (
    <ul className="template-list" aria-label={t("rules.templatesTitle")}>
      {templates.map((template) => (
        <li key={template.id}>
          <span>
            <strong>
              <span className={`template-badge ${template.type}`}>
                {tUpper(`common.${template.type}`) ||
                  template.type.toUpperCase()}
              </span>
              {template.category} {money(template.amount)}
            </strong>
            <em>
              {t("rules.onDayText", { day: template.day_of_month })}
              {template.description ? ` - ${template.description}` : ""}
            </em>
          </span>
          <IconButton
            icon={Trash2}
            label={`${t("common.delete")} ${template.category} ${t("rules.templatesTitle").toLowerCase()}`}
            onClick={() => onDelete(template)}
          />
        </li>
      ))}
    </ul>
  );
}
