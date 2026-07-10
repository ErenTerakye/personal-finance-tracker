import { useId } from "react";
import { ArrowRight, Download, FileText, ImageDown } from "lucide-react";
import { artifactUrls } from "../../api/artifacts";
import {
  compactValue,
  CategoryBars,
  KpiCard,
  CashflowTrend,
  TrendLines,
} from "../../shared/charts";
import { PeriodControl } from "../../shared/components/PeriodControl";
import {
  ActivityList,
  BudgetPressureList,
  PageHeader,
  Panel,
} from "../../shared/components/lists";
import { ActionButton, DownloadLink } from "../../shared/components/actions";
import { ErrorBanner } from "../../shared/components/feedback";
import { money, percent } from "../../shared/format/money";
import { periodLabel } from "../../shared/format/periods";
import { useI18n } from "../../shared/i18n/I18nProvider";
import type { DashboardData } from "../../types";
import type { View } from "../../app/routes";
import { useDashboard } from "./useDashboard";

export function DashboardView({
  selectedPeriod,
  setSelectedPeriod,
  onNavigate,
}: {
  selectedPeriod: { month: number; year: number };
  setSelectedPeriod: (period: { month: number; year: number }) => void;
  onNavigate: (view: View) => void;
}) {
  const { t, locale, tUpper } = useI18n();
  const dashboard = useDashboard(selectedPeriod.month, selectedPeriod.year);

  if (dashboard.status === "error") {
    return <ErrorBanner message={dashboard.error.message} />;
  }

  if (dashboard.status !== "success") {
    return (
      <Panel
        title={t("dashboard.empty.loadingTitle")}
        detail={t("dashboard.empty.fetching")}
      >
        <p className="loading-state">{t("dashboard.empty.preparing")}</p>
      </Panel>
    );
  }

  const data: DashboardData = dashboard.data;

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
        <Panel
          title={t("dashboard.sections.contextTitle")}
          detail={t("dashboard.sections.contextDetail")}
          deferred
        >
          <TrendLines months={data.trend.months} />
        </Panel>
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
