import { Database, Download, ReceiptText, Target, Upload } from "lucide-react";
import type { ReactNode } from "react";
import { artifactUrls } from "../../api/artifacts";
import { ActionButton, DownloadLink } from "../../shared/components/actions";
import { PageHeader } from "../../shared/components/lists";
import { useI18n } from "../../shared/i18n/I18nProvider";

export function ManageDataView({
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
  const activityFilters = {
    ...selectedPeriod,
    category: "",
    kind: "" as const,
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
              href={artifactUrls.activitiesCsv(activityFilters)}
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
