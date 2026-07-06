import { useEffect, useState } from "react";
import { ArrowRight, FileText, ImageDown } from "lucide-react";
import { api, artifactUrls } from "../api";
import { compactValue, CategoryBars, KpiCard, CashflowTrend, TrendLines } from "../components/Charts";
import { ActivityList, BudgetPressureList } from "../components/Lists";
import { PeriodControl } from "../components/PeriodControl";
import { ActionButton, DownloadLink, ErrorBanner, PageHeader, Panel } from "../components/ui";
import { money, percent, periodLabel } from "../format";
import type { DashboardData } from "../types";
import type { View } from "../routes";
import { useI18n } from "../i18n";

export function DashboardView({
  selectedPeriod,
  setSelectedPeriod,
  onNavigate
}: {
  selectedPeriod: { month: number; year: number };
  setSelectedPeriod: (period: { month: number; year: number }) => void;
  onNavigate: (view: View) => void;
}) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const { t, locale } = useI18n();

  useEffect(() => {
    setError("");
    setData(null);
    api
      .dashboard(selectedPeriod.month, selectedPeriod.year)
      .then(setData)
      .catch((err: Error) => setError(readError(err)));
  }, [selectedPeriod]);

  if (error) {
    return <ErrorBanner message={error} />;
  }

  if (!data) {
    return (
      <Panel title={t("dashboard.empty.loadingTitle")} detail={t("dashboard.empty.fetching")}>
        <p className="loading-state">{t("dashboard.empty.preparing")}</p>
      </Panel>
    );
  }

  const overBudget = data.budget_statuses.filter((status) => status.status === "over budget").length;
  const nearLimit = data.budget_statuses.filter((status) => status.status === "near limit").length;
  const categories = Object.entries(data.report.expenses_by_category)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => Number(b.value) - Number(a.value));

  // Determine localized period label from month number if Turkish
  const displayPeriodLabel = locale === "tr" 
    ? periodLabel(data.month, data.year)
    : data.period_label;

  return (
    <>
      <PageHeader
        eyebrow={t("dashboard.eyebrow")}
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
            <div className="artifact-actions" aria-label={t("dashboard.downloadLabel")}>
              <DownloadLink
                icon={FileText}
                href={artifactUrls.monthlyReport(selectedPeriod.month, selectedPeriod.year)}
                download
              >
                {t("dashboard.monthReport")}
              </DownloadLink>
              <DownloadLink
                icon={ImageDown}
                href={artifactUrls.monthlyChart(selectedPeriod.month, selectedPeriod.year)}
                download
              >
                {t("dashboard.monthChart")}
              </DownloadLink>
              <DownloadLink
                icon={FileText}
                href={artifactUrls.trendReport(selectedPeriod.month, selectedPeriod.year)}
                download
              >
                {t("dashboard.trendReport")}
              </DownloadLink>
              <DownloadLink
                icon={ImageDown}
                href={artifactUrls.trendChart(selectedPeriod.month, selectedPeriod.year)}
                download
              >
                {t("dashboard.trendChart")}
              </DownloadLink>
            </div>
          </div>
        }
      />

      <section className="dashboard-summary" aria-label={t("dashboard.summaryAria", { period: displayPeriodLabel })}>
        <KpiCard
          label={t("dashboard.kpi.netPosition")}
          value={money(data.report.net_savings)}
          detail={t("dashboard.detail.entries", { count: data.report.transaction_count })}
          tone={Number(data.report.net_savings) >= 0 ? "cash" : "expenses"}
          featured
        />
        <KpiCard
          label={t("dashboard.kpi.savingsRate")}
          value={percent(data.savings_rate)}
          detail={t("dashboard.detail.income", { amount: compactValue(data.report.total_income) })}
          tone="neutral"
        />
        <KpiCard
          label={t("dashboard.kpi.budgetRisk")}
          value={String(overBudget + nearLimit)}
          detail={t("dashboard.detail.risk", { over: overBudget, near: nearLimit })}
          tone={overBudget ? "warning" : "cash"}
        />
        <div className="quick-actions" aria-label={t("dashboard.detail.actions")}>
          <ActionButton icon={ArrowRight} variant="primary" onClick={() => onNavigate("transactions")}>
            {t("common.addEntry")}
          </ActionButton>
          <ActionButton icon={ArrowRight} variant="secondary" onClick={() => onNavigate("budgets")}>
            {t("common.setBudget")}
          </ActionButton>
        </div>
      </section>

      <section className="dashboard-lead" aria-label={t("dashboard.title")}>
        <Panel title={t("dashboard.sections.trendTitle")} className="tape-panel">
          <CashflowTrend months={data.trend.months} />
        </Panel>
      </section>

      <section className="kpi-grid" aria-label={t("dashboard.sections.mixDetail")}>
        <KpiCard label={t("dashboard.kpi.income")} value={money(data.report.total_income)} tone="cash" />
        <KpiCard label={t("dashboard.kpi.expenses")} value={money(data.report.total_expenses)} tone="expenses" />
        <KpiCard
          label={t("dashboard.kpi.momNet")}
          value={money(data.report.net_savings_delta)}
          detail={t("dashboard.detail.momCompare")}
          tone={Number(data.report.net_savings_delta) >= 0 ? "cash" : "warning"}
        />
        <KpiCard
          label={t("dashboard.kpi.ytdNet")}
          value={money(data.report.ytd_net_savings)}
          detail={t("dashboard.detail.ytdIncome", { amount: compactValue(data.report.ytd_income) })}
          tone={Number(data.report.ytd_net_savings) >= 0 ? "cash" : "expenses"}
        />
        <KpiCard label={t("dashboard.kpi.trendNet")} value={money(data.trend.net_savings)} detail={t("dashboard.detail.trendTotal")} />
        <KpiCard
          label={t("dashboard.kpi.trendEntries")}
          value={String(data.trend.transaction_count)}
          detail={periodLabel(data.trend.months[0]?.month ?? data.month, data.trend.months[0]?.year ?? data.year)}
        />
      </section>

      <section className="analysis-grid" aria-label={t("dashboard.title")}>
        <Panel title={t("dashboard.sections.contextTitle")} detail={t("dashboard.sections.contextDetail")} deferred>
          <TrendLines months={data.trend.months} />
        </Panel>
        <Panel title={t("dashboard.sections.pressureTitle")} deferred>
          <BudgetPressureList statuses={data.budget_statuses} />
        </Panel>
        <Panel title={t("dashboard.sections.mixTitle")} detail={t("dashboard.sections.mixDetail")} deferred>
          <CategoryBars title={t("dashboard.sections.mixTitle")} items={categories} />
        </Panel>
        <Panel title={t("dashboard.sections.activityTitle")} detail={t("dashboard.sections.activityDetail")} deferred>
          <ActivityList transactions={data.recent_transactions} />
        </Panel>
      </section>
    </>
  );
}

function readError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "The request could not be completed.";
}

