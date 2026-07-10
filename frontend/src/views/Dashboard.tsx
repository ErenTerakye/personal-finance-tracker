import { useEffect, useId, useState } from "react";
import { ArrowRight, Download, FileText, ImageDown } from "lucide-react";
import { api, artifactUrls } from "../api";
import {
  compactValue,
  CategoryBars,
  KpiCard,
  CashflowTrend,
} from "../components/Charts";
import { ActivityList, BudgetPressureList } from "../components/Lists";
import { PeriodControl } from "../components/PeriodControl";
import {
  ActionButton,
  DownloadLink,
  ErrorBanner,
  PageHeader,
  Panel,
} from "../components/ui";
import { money, percent, periodLabel } from "../format";
import type { DashboardData } from "../types";
import type { View } from "../routes";
import { useI18n } from "../i18n";

export function DashboardView({
  selectedPeriod,
  setSelectedPeriod,
  onNavigate,
}: {
  selectedPeriod: { month: number; year: number };
  setSelectedPeriod: (period: { month: number; year: number }) => void;
  onNavigate: (view: View) => void;
}) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const { t, locale, tUpper } = useI18n();

  useEffect(() => {
    const controller = new AbortController();
    setError("");
    setData(null);
    api
      .dashboard(selectedPeriod.month, selectedPeriod.year, controller.signal)
      .then(setData)
      .catch((err: Error) => {
        if (err.name !== "AbortError") setError(readError(err));
      });
    return () => controller.abort();
  }, [selectedPeriod]);

  if (error) {
    return <ErrorBanner message={error} />;
  }

  if (!data) {
    return (
      <Panel
        title={t("dashboard.empty.loadingTitle")}
        detail={t("dashboard.empty.fetching")}
      >
        <p className="loading-state">{t("dashboard.empty.preparing")}</p>
      </Panel>
    );
  }

  const overBudget = data.budget_statuses.filter(
    (status) => status.status === "over budget",
  ).length;
  const nearLimit = data.budget_statuses.filter(
    (status) => status.status === "near limit",
  ).length;
  const categories = Object.entries(data.report.expenses_by_category)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => Number(b.value) - Number(a.value));

  // Determine localized period label from month number if Turkish
  const displayPeriodLabel =
    locale === "tr" ? periodLabel(data.month, data.year) : data.period_label;

  return (
    <>
      <PageHeader
        eyebrow={tUpper("dashboard.eyebrow")}
        title={t("dashboard.title")}
        summary={t("dashboard.summary")}
        className="dashboard-heading"
        actions={
          <div className="dashboard-actions">
            <PeriodControl
              label={t("dashboard.changePeriod")}
              value={selectedPeriod}
              onChange={setSelectedPeriod}
            />
            <ReportMenu
              month={selectedPeriod.month}
              year={selectedPeriod.year}
            />
          </div>
        }
      />

      <section
        className="dashboard-summary"
        aria-label={t("dashboard.summaryAria", { period: displayPeriodLabel })}
      >
        <KpiCard
          label={tUpper("dashboard.kpi.netPosition")}
          value={money(data.report.net_savings)}
          detail={t("dashboard.detail.entries", {
            count: data.report.transaction_count,
          })}
          tone={Number(data.report.net_savings) >= 0 ? "cash" : "expenses"}
          featured
        />
        <KpiCard
          label={tUpper("dashboard.kpi.savingsRate")}
          value={percent(data.savings_rate)}
          detail={t("dashboard.detail.income", {
            amount: compactValue(data.report.total_income),
          })}
          tone="neutral"
        />
        <KpiCard
          label={tUpper("dashboard.kpi.budgetRisk")}
          value={String(overBudget + nearLimit)}
          detail={t("dashboard.detail.risk", {
            over: overBudget,
            near: nearLimit,
          })}
          tone={overBudget ? "warning" : "cash"}
        />
        <div
          className="quick-actions"
          aria-label={t("dashboard.detail.actions")}
        >
          <ActionButton
            icon={ArrowRight}
            variant="primary"
            onClick={() => onNavigate("transactions")}
          >
            {t("common.addEntry")}
          </ActionButton>
          <ActionButton
            icon={ArrowRight}
            variant="secondary"
            onClick={() => onNavigate("budgets")}
          >
            {t("common.setBudget")}
          </ActionButton>
        </div>
      </section>

      <section className="dashboard-lead" aria-label={t("dashboard.title")}>
        <Panel
          title={t("dashboard.sections.trendTitle")}
          className="tape-panel"
        >
          <CashflowTrend months={data.trend.months} />
        </Panel>
      </section>

      <section className="analysis-grid" aria-label={t("dashboard.title")}>
        <Panel title={t("dashboard.sections.pressureTitle")} deferred>
          <BudgetPressureList statuses={data.budget_statuses} />
        </Panel>
        <Panel
          title={t("dashboard.sections.mixTitle")}
          detail={t("dashboard.sections.mixDetail")}
          deferred
        >
          <CategoryBars
            title={t("dashboard.sections.mixTitle")}
            items={categories}
          />
        </Panel>
        <Panel
          title={t("dashboard.sections.activityTitle")}
          detail={t("dashboard.sections.activityDetail")}
          deferred
        >
          <ActivityList transactions={data.recent_transactions} />
        </Panel>
      </section>
    </>
  );
}

function ReportMenu({ month, year }: { month: number; year: number }) {
  const id = useId();
  const { t } = useI18n();
  return (
    <div className="report-menu">
      <button className="button secondary" type="button" popoverTarget={id}>
        <Download aria-hidden="true" size={18} />
        <span>{t("dashboard.reportMenu")}</span>
      </button>
      <div
        className="artifact-popover"
        id={id}
        popover="auto"
        aria-label={t("dashboard.downloadLabel")}
      >
        <DownloadLink
          icon={FileText}
          href={artifactUrls.monthlyReport(month, year)}
          download
        >
          {t("dashboard.monthReport")}
        </DownloadLink>
        <DownloadLink
          icon={ImageDown}
          href={artifactUrls.monthlyChart(month, year)}
          download
        >
          {t("dashboard.monthChart")}
        </DownloadLink>
        <DownloadLink
          icon={FileText}
          href={artifactUrls.trendReport(month, year)}
          download
        >
          {t("dashboard.trendReport")}
        </DownloadLink>
        <DownloadLink
          icon={ImageDown}
          href={artifactUrls.trendChart(month, year)}
          download
        >
          {t("dashboard.trendChart")}
        </DownloadLink>
      </div>
    </div>
  );
}

function readError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "The request could not be completed.";
}
