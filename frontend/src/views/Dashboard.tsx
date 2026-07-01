import { FormEvent, useEffect, useState } from "react";
import { ArrowRight, CalendarDays } from "lucide-react";
import { api } from "../api";
import { compactValue, CategoryBars, KpiCard, StatementTape, TrendLines } from "../components/Charts";
import { ActivityList, BudgetPressureList } from "../components/Lists";
import { ErrorBanner, IconButton, PageHeader, Panel } from "../components/ui";
import { money, monthNames, percent, periodLabel } from "../format";
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
  const [draft, setDraft] = useState(selectedPeriod);
  const [error, setError] = useState("");

  useEffect(() => {
    setDraft(selectedPeriod);
    setError("");
    setData(null);
    api
      .dashboard(selectedPeriod.month, selectedPeriod.year)
      .then(setData)
      .catch((err: Error) => setError(readError(err)));
  }, [selectedPeriod]);

  function submitPeriod(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSelectedPeriod({ month: Number(draft.month), year: Number(draft.year) });
  }

  if (error) {
    return <ErrorBanner message={error} />;
  }

  if (!data) {
    return (
      <Panel title="Loading workspace" detail="Fetching local ledger data">
        <p className="loading-state">Preparing the cashflow desk.</p>
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
        eyebrow="Cashflow desk"
        title="Dashboard"
        summary="Review cashflow, budget pressure, and recent ledger activity for one period."
        className="dashboard-heading"
        actions={
          <form className="period-form" onSubmit={submitPeriod} aria-label="Change dashboard period">
            <output className="period-current" aria-label="Selected period">
              {data.period_label}
            </output>
            <div className="field-group">
              <label htmlFor="dashboard-month">Month</label>
              <select
                id="dashboard-month"
                value={draft.month}
                onChange={(event) => setDraft({ ...draft, month: Number(event.target.value) })}
              >
                {monthNames.slice(1).map((name, index) => (
                  <option key={name} value={index + 1}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field-group">
              <label htmlFor="dashboard-year">Year</label>
              <input
                id="dashboard-year"
                min="1"
                type="number"
                value={draft.year}
                onChange={(event) => setDraft({ ...draft, year: Number(event.target.value) })}
              />
            </div>
            <button className="button secondary" type="submit">
              <CalendarDays aria-hidden="true" size={18} />
              <span>Review</span>
            </button>
          </form>
        }
      />

      <section className="dashboard-summary" aria-label="Dashboard totals">
        <KpiCard
          label="Net position"
          value={money(data.report.net_savings)}
          detail={`${data.report.transaction_count} entries`}
          tone={Number(data.report.net_savings) >= 0 ? "cash" : "outflow"}
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
          <IconButton icon={ArrowRight} variant="primary" onClick={() => onNavigate("transactions")}>
            Add entry
          </IconButton>
          <IconButton icon={ArrowRight} variant="secondary" onClick={() => onNavigate("budgets")}>
            Set budget
          </IconButton>
        </div>
      </section>

      <section className="dashboard-lead" aria-label="Dashboard summary">
        <Panel title="Statement tape" className="tape-panel">
          <StatementTape months={data.trend.months} />
        </Panel>
      </section>

      <section className="kpi-grid" aria-label="Monthly totals">
        <KpiCard label="Income cleared" value={money(data.report.total_income)} tone="cash" />
        <KpiCard label="Outflow posted" value={money(data.report.total_expenses)} tone="outflow" />
        <KpiCard label="Trend net" value={money(data.trend.net_savings)} detail="Six-month total" />
        <KpiCard
          label="Trend entries"
          value={String(data.trend.transaction_count)}
          detail={periodLabel(data.trend.months[0]?.month ?? data.month, data.trend.months[0]?.year ?? data.year)}
        />
      </section>

      <section className="analysis-grid" aria-label="Dashboard analysis">
        <Panel title="Trend context" detail="Income, outflow, and net lines" deferred>
          <TrendLines months={data.trend.months} />
        </Panel>
        <Panel title="Budget pressure" deferred>
          <BudgetPressureList statuses={data.budget_statuses} />
        </Panel>
        <Panel title="Outflow mix" detail="Spending by category" deferred>
          <CategoryBars title="Expense categories" items={categories} />
        </Panel>
        <Panel title="Recent ledger" detail="Latest local activity" deferred>
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
