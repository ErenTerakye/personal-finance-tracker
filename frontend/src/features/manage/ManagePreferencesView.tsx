import { Coins } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { SubmitButton } from "../../shared/components/actions";
import { ErrorBanner } from "../../shared/components/feedback";
import { Field } from "../../shared/components/fields";
import { PageHeader } from "../../shared/components/lists";
import { useI18n } from "../../shared/i18n/I18nProvider";
import { localizedNotice } from "../../shared/i18n/notices";
import { PreferenceChoiceGroups } from "../../shared/preferences/PreferenceControls";
import { useLedgerSettings, useUpdateLedgerSettings } from "./hooks";

export function ManagePreferencesView({
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
      // Initialize the editable draft from the asynchronously loaded ledger setting.
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
          <PreferenceChoiceGroups idPrefix="manage-preferences" />
        </article>
      </section>
    </>
  );
}
