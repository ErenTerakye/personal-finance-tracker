import { useId } from "react";
import { Download, FileText, ImageDown, PiggyBank, Plus } from "lucide-react";
import { artifactUrls } from "../../api/artifacts";
import { CategoryBars, CashflowTrend } from "../../shared/charts";
import { PeriodControl } from "../../shared/components/PeriodControl";
import {
  ActivityList,
  BudgetPressureList,
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
import { usePeriodTransition } from "../../shared/hooks/usePeriodTransition";
import { RollingNumber } from "../../shared/components/RollingNumber";

export function DashboardView({
  selectedPeriod,
  setSelectedPeriod,
  onNavigate,
  onCreateTransaction,
  onCreateBudget,
}: {
  selectedPeriod: { month: number; year: number };
  setSelectedPeriod: (period: { month: number; year: number }) => void;
  onNavigate: (view: View) => void;
  onCreateTransaction: () => void;
  onCreateBudget: () => void;
}) {
  const { t, locale, tUpper } = useI18n();
  const dashboard = useDashboard(selectedPeriod.month, selectedPeriod.year);
  const periodTransition = usePeriodTransition(selectedPeriod, dashboard);

  if (dashboard.status === "error" && !periodTransition.data) {
    return <ErrorBanner message={dashboard.error.message} />;
  }

  if (!periodTransition.data) {
    return (
      <Panel
        title={t("dashboard.empty.loadingTitle")}
        detail={t("dashboard.empty.fetching")}
      >
        <p className="loading-state">{t("dashboard.empty.preparing")}</p>
      </Panel>
    );
  }

  const data: DashboardData = periodTransition.data;

  const overBudget = data.budget_statuses.filter(
    (status) => status.status === "over budget",
  ).length;
  const nearLimit = data.budget_statuses.filter(
    (status) => status.status === "near limit",
  ).length;
  const categories = Object.entries(data.report.expenses_by_category)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => Number(b.value) - Number(a.value));
  const net = Number(data.report.net_savings);
  const netDelta = Number(data.report.net_savings_delta);
  const attention = [...data.budget_statuses]
    .filter((status) => status.status !== "ok")
    .sort((a, b) => {
      const priority = (value: string) =>
        value === "over budget" ? 2 : value === "near limit" ? 1 : 0;
      return (
        priority(b.status) - priority(a.status) ||
        Number(b.percent_used) - Number(a.percent_used)
      );
    });

  // Determine localized period label from month number if Turkish
  const displayPeriodLabel =
    locale === "tr" ? periodLabel(data.month, data.year) : data.period_label;

  return (
    <div
      className={`period-view dashboard-period-view${periodTransition.pending ? " is-period-pending" : ""}`}
      aria-busy={periodTransition.pending}
    >
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {!periodTransition.pending && periodTransition.presentedPeriod
          ? t("common.periodLoaded", { period: displayPeriodLabel })
          : ""}
      </p>
      {dashboard.status === "error" ? (
        <ErrorBanner message={dashboard.error.message} />
      ) : null}
      <section
        className="page-heading dashboard-heading dashboard-context-header"
        aria-labelledby="page-title"
      >
        <p className="eyebrow">{tUpper("dashboard.eyebrow")}</p>
        <h1 id="page-title" className="period-transition-heading">
          {displayPeriodLabel}
        </h1>
        <p className="dashboard-narrative period-transition-narrative">
          {net >= 0
            ? t("dashboard.narrative.positive", { amount: money(net) })
            : t("dashboard.narrative.negative", {
                amount: money(Math.abs(net)),
              })}
        </p>
        <div className="dashboard-command-row">
          <div
            className="dashboard-heading-tools dashboard-actions"
            aria-label={t("dashboard.toolsLabel")}
          >
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
          <div
            className="dashboard-primary-actions action-cluster"
            aria-label={t("dashboard.detail.actions")}
          >
            <ActionButton
              icon={Plus}
              variant="primary"
              onClick={onCreateTransaction}
            >
              {t("common.addEntry")}
            </ActionButton>
            <ActionButton
              icon={PiggyBank}
              variant="secondary"
              onClick={onCreateBudget}
            >
              {t("common.setBudget")}
            </ActionButton>
          </div>
        </div>
      </section>

      <div className="period-transition-content">
        <section
          className="dashboard-summary"
          aria-label={t("dashboard.summaryAria", {
            period: displayPeriodLabel,
          })}
        >
          <div className={`balance-story ${net < 0 ? "negative" : "positive"}`}>
            <p className="eyebrow">{tUpper("dashboard.kpi.netPosition")}</p>
            <strong>
              <RollingNumber
                value={Number(data.report.net_savings)}
                previousValue={Number(
                  periodTransition.previousData?.report.net_savings ??
                    data.report.net_savings,
                )}
                format={money}
              />
            </strong>
            <p>
              {netDelta === 0
                ? t("dashboard.narrative.unchanged")
                : t(
                    netDelta > 0
                      ? "dashboard.narrative.better"
                      : "dashboard.narrative.lower",
                    { amount: money(Math.abs(netDelta)) },
                  )}
            </p>
            <dl className="cashflow-comparison">
              <div className="cashflow-metric cashflow-metric-income">
                <dt>{t("dashboard.kpi.income")}</dt>
                <dd>
                  <RollingNumber
                    value={Number(data.report.total_income)}
                    previousValue={Number(
                      periodTransition.previousData?.report.total_income ??
                        data.report.total_income,
                    )}
                    format={money}
                  />
                </dd>
              </div>
              <div className="cashflow-metric cashflow-metric-expenses">
                <dt>{t("dashboard.kpi.expenses")}</dt>
                <dd>
                  <RollingNumber
                    value={Number(data.report.total_expenses)}
                    previousValue={Number(
                      periodTransition.previousData?.report.total_expenses ??
                        data.report.total_expenses,
                    )}
                    format={money}
                  />
                </dd>
              </div>
              <div
                className={`cashflow-metric cashflow-metric-savings ${
                  Number(data.savings_rate) < 0 ? "negative" : "positive"
                }`}
              >
                <dt>{t("dashboard.kpi.savingsRate")}</dt>
                <dd>
                  <RollingNumber
                    value={Number(data.savings_rate)}
                    previousValue={Number(
                      periodTransition.previousData?.savings_rate ??
                        data.savings_rate,
                    )}
                    format={percent}
                  />
                </dd>
              </div>
            </dl>
            <p>
              {t("dashboard.detail.entries", {
                count: data.report.transaction_count,
              })}
            </p>
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

        <section
          className="analysis-grid dashboard-priorities"
          aria-label={t("dashboard.title")}
        >
          <Panel
            title={t("dashboard.sections.attentionTitle")}
            detail={t("dashboard.detail.risk", {
              over: overBudget,
              near: nearLimit,
            })}
          >
            {attention.length ? (
              <BudgetPressureList statuses={attention} />
            ) : (
              <p className="quiet-state">{t("dashboard.attentionEmpty")}</p>
            )}
          </Panel>
        </section>

        <section
          className="analysis-grid dashboard-analysis-pair"
          aria-label={t("dashboard.title")}
        >
          <Panel
            title={t("dashboard.sections.activityTitle")}
            detail={t("dashboard.sections.activityDetail")}
            actions={
              <button
                className="button ghost"
                type="button"
                onClick={() => onNavigate("transactions")}
              >
                {t("dashboard.viewAllActivity")}
              </button>
            }
          >
            <ActivityList transactions={data.recent_transactions} />
          </Panel>
          <Panel
            title={t("dashboard.sections.mixTitle")}
            detail={t("dashboard.sections.mixDetail")}
          >
            <CategoryBars
              title={t("dashboard.sections.mixTitle")}
              items={categories}
            />
          </Panel>
        </section>
      </div>
    </div>
  );
}

function ReportMenu({ month, year }: { month: number; year: number }) {
  const id = useId();
  const { t } = useI18n();
  return (
    <div className="report-menu">
      <button
        className="button secondary"
        type="button"
        popoverTarget={id}
        aria-label={t("dashboard.downloadLabel")}
      >
        <Download aria-hidden="true" size={18} />
        <span>{t("dashboard.exportAction")}</span>
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
