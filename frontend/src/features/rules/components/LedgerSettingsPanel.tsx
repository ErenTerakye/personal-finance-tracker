import { Settings } from "lucide-react";
import type { FormEvent } from "react";
import { SubmitButton } from "../../../shared/components/actions";
import { ErrorBanner } from "../../../shared/components/feedback";
import { Field } from "../../../shared/components/fields";
import { Panel } from "../../../shared/components/lists";
import { useI18n } from "../../../shared/i18n/I18nProvider";

export function LedgerSettingsPanel({
  currency,
  error,
  saving,
  onCurrencyChange,
  onSave,
}: {
  currency: string;
  error: string;
  saving: boolean;
  onCurrencyChange: (currency: string) => void;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const { t } = useI18n();
  const actionError = error;
  const savingCurrency = saving;
  const setLocalCurrency = onCurrencyChange;
  const saveCurrency = onSave;
  return (
    <Panel title={t("rules.settingsTitle")} className="settings-panel">
      {actionError ? <ErrorBanner message={actionError} /> : null}
      <form className="inline-form" onSubmit={saveCurrency}>
        <Field
          id="settings-currency"
          label={t("rules.settingsCurrency")}
          hint={t("rules.settingsHint")}
        >
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
          {t("rules.settingsSaveBtn")}
        </SubmitButton>
      </form>
    </Panel>
  );
}
