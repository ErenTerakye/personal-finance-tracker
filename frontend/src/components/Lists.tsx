import { AlertTriangle, CheckCircle2, CircleDollarSign } from "lucide-react";
import { money, percent, formatActivityDate } from "../format";
import type { BudgetStatus, TransactionRecord } from "../types";
import { EmptyState } from "./ui";

export function BudgetPressureList({ statuses }: { statuses: BudgetStatus[] }) {
  if (!statuses.length) {
    return (
      <EmptyState
        title="No budgets for this period"
        message="Set a category budget to start tracking pressure."
      />
    );
  }

  return (
    <div className="pressure-list">
      {statuses.map((status) => {
        const tone = status.status.replaceAll(" ", "-");
        const Icon = status.status === "ok" ? CheckCircle2 : AlertTriangle;
        return (
          <article className={`pressure-row ${tone}`} key={status.budget.id}>
            <div>
              <strong>{status.budget.category}</strong>
              <span>
                {money(status.actual_expenses)} of {money(status.budget.amount)}
              </span>
            </div>
            <progress
              max="100"
              value={Math.min(Number(status.percent_used), 100)}
              aria-label={`${status.budget.category} budget used ${percent(status.percent_used)}`}
            />
            <em>
              <Icon aria-hidden="true" size={15} />
              <span>{status.status}</span>
            </em>
          </article>
        );
      })}
    </div>
  );
}

export function ActivityList({
  transactions,
}: {
  transactions: TransactionRecord[];
}) {
  if (!transactions.length) {
    return (
      <EmptyState
        title="No recent activity"
        message="New ledger entries will appear here after they are posted."
      />
    );
  }

  return (
    <ul className="activity-list">
      {transactions.map((transaction) => (
        <li key={transaction.id}>
          <div>
            <CircleDollarSign aria-hidden="true" size={18} />
            <span>
              <strong>{transaction.category}</strong>
              <em>
                {formatActivityDate(transaction.date)}
                {transaction.description ? ` • ${transaction.description}` : ""}
              </em>
            </span>
          </div>
          <strong className={transaction.type}>
            {money(transaction.amount)}
          </strong>
        </li>
      ))}
    </ul>
  );
}
