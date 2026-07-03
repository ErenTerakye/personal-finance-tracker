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
      <Panel title="Loading dashboard" detail="Fetching transaction records">
        <p className="loading-state">Preparing the cashflow trend.</p>
      </Panel>
    );
  }

  const overBudget = data.budget_statuses.filter((status) => status.status === "over budget").length;
  const nearLimit = data.budget_statuses.filter((status) => status.status === "near limit").length;
  const categories = Object.entries(data.report.expenses_by_category)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => Number(b.value) - Number(a.value));

  return (
    <>
      <PageHeader
        eyebrow="Cashflow Overview"
        title="Dashboard"
        summary="Review cashflow, budget pressure, and recent activity."
        className="dashboard-heading"
        actions={
          <div className="dashboard-actions">
            <PeriodControl
              label="Change dashboard period"
              value={selectedPeriod}
              onChange={setSelectedPeriod}
            />
            <div className="artifact-actions" aria-label="Download dashboard artifacts">
              <DownloadLink
                icon={FileText}
                href={artifactUrls.monthlyReport(selectedPeriod.month, selectedPeriod.year)}
                download
              >
                Month report
              </DownloadLink>
              <DownloadLink
                icon={ImageDown}
                href={artifactUrls.monthlyChart(selectedPeriod.month, selectedPeriod.year)}
                download
              >
                Month chart
              </DownloadLink>
              <DownloadLink
                icon={FileText}
                href={artifactUrls.trendReport(selectedPeriod.month, selectedPeriod.year)}
                download
              >
                Trend report
              </DownloadLink>
              <DownloadLink
                icon={ImageDown}
                href={artifactUrls.trendChart(selectedPeriod.month, selectedPeriod.year)}
                download
              >
                Trend chart
              </DownloadLink>
            </div>
          </div>
        }
      />

      <section className="dashboard-summary" aria-label={`Dashboard totals for ${data.period_label}`}>
        <KpiCard
          label="Net position"
          value={money(data.report.net_savings)}
          detail={`${data.report.transaction_count} entries`}
          tone={Number(data.report.net_savings) >= 0 ? "cash" : "expenses"}
          featured
        />
        <KpiCard
          label="Savings rate"
          value={percent(data.savings_rate)}
          detail={`${compactValue(data.report.total_income)} income`}
          tone="neutral"
        />
        <KpiCard
          label="Budget risk"
          value={String(overBudget + nearLimit)}
          detail={`${overBudget} over, ${nearLimit} near`}
          tone={overBudget ? "warning" : "cash"}
        />
        <div className="quick-actions" aria-label="Next actions">
          <ActionButton icon={ArrowRight} variant="primary" onClick={() => onNavigate("transactions")}>
            Add entry
          </ActionButton>
          <ActionButton icon={ArrowRight} variant="secondary" onClick={() => onNavigate("budgets")}>
            Set budget
          </ActionButton>
        </div>
      </section>

      <section className="dashboard-lead" aria-label="Dashboard summary">
        <Panel title="Cashflow Trend" className="tape-panel">
          <CashflowTrend months={data.trend.months} />
        </Panel>
      </section>

      <section className="kpi-grid" aria-label="Monthly totals">
        <KpiCard label="Income" value={money(data.report.total_income)} tone="cash" />
        <KpiCard label="Expenses" value={money(data.report.total_expenses)} tone="expenses" />
        <KpiCard
          label="MoM net"
          value={money(data.report.net_savings_delta)}
          detail="Compared with prior month"
          tone={Number(data.report.net_savings_delta) >= 0 ? "cash" : "warning"}
        />
        <KpiCard
          label="YTD net"
          value={money(data.report.ytd_net_savings)}
          detail={`${compactValue(data.report.ytd_income)} income`}
          tone={Number(data.report.ytd_net_savings) >= 0 ? "cash" : "expenses"}
        />
        <KpiCard label="Trend net" value={money(data.trend.net_savings)} detail="Six-month total" />
        <KpiCard
          label="Trend entries"
          value={String(data.trend.transaction_count)}
          detail={periodLabel(data.trend.months[0]?.month ?? data.month, data.trend.months[0]?.year ?? data.year)}
        />
      </section>

      <section className="analysis-grid" aria-label="Dashboard analysis">
        <Panel title="Trend context" detail="Income, expenses, and net savings" deferred>
          <TrendLines months={data.trend.months} />
        </Panel>
        <Panel title="Budget pressure" deferred>
          <BudgetPressureList statuses={data.budget_statuses} />
        </Panel>
        <Panel title="Expense mix" detail="Spending by category" deferred>
          <CategoryBars title="Expense categories" items={categories} />
        </Panel>
        <Panel title="Recent activity" detail="Latest activity" deferred>
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
