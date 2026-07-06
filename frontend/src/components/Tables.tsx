import { Pencil, Trash2 } from "lucide-react";
import { money, periodLabel } from "../format";
import type { BudgetRecord, TransactionRecord } from "../types";
import { EmptyState, IconButton } from "./ui";
import { useI18n } from "../i18n";

export function TransactionTable({
  transactions,
  onEdit,
  onDelete
}: {
  transactions: TransactionRecord[];
  onEdit: (transaction: TransactionRecord) => void;
  onDelete: (transaction: TransactionRecord) => void;
}) {
  const { t } = useI18n();

  if (!transactions.length) {
    return (
      <EmptyState
        title={t("transactions.empty.noTransactions")}
        message={t("transactions.empty.noTransactionsMsg")}
      />
    );
  }

  return (
    <div className="table-wrap">
      <table className="data-table transaction-table">
        <caption>{t("transactions.historyTitle")}</caption>
        <thead>
          <tr>
            <th scope="col">{t("common.date")}</th>
            <th scope="col">{t("common.type")}</th>
            <th scope="col">{t("common.category")}</th>
            <th scope="col">{t("common.description")}</th>
            <th scope="col">{t("common.amount")}</th>
            <th scope="col">{t("common.actions")}</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((transaction) => (
            <tr key={transaction.id}>
              <td data-label={t("common.date")}>{transaction.date}</td>
              <td data-label={t("common.type")}>
                <span className={`type-chip ${transaction.type}`}>
                  {t(`common.${transaction.type}`) || transaction.type}
                </span>
              </td>
              <td data-label={t("common.category")}>{transaction.category}</td>
              <td data-label={t("common.description")}>{transaction.description || t("common.all")}</td> {/* fallback empty or "None" */}
              <td data-label={t("common.amount")}>
                <strong className={transaction.type}>{money(transaction.amount)}</strong>
              </td>
              <td data-label={t("common.actions")}>
                <div className="row-actions">
                  <IconButton
                    icon={Pencil}
                    label={t("common.editTransaction", { name: transaction.category })}
                    variant="secondary"
                    onClick={() => onEdit(transaction)}
                  />
                  <IconButton
                    icon={Trash2}
                    label={t("common.deleteTransaction", { name: transaction.category })}
                    variant="danger"
                    onClick={() => onDelete(transaction)}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function BudgetTable({
  budgets,
  onEdit,
  onDelete
}: {
  budgets: BudgetRecord[];
  onEdit: (budget: BudgetRecord) => void;
  onDelete: (budget: BudgetRecord) => void;
}) {
  const { t } = useI18n();

  if (!budgets.length) {
    return (
      <EmptyState
        title={t("budgets.empty.noRecords")}
        message={t("budgets.empty.noRecordsMsg")}
      />
    );
  }

  return (
    <div className="table-wrap">
      <table className="data-table budget-table">
        <caption>{t("budgets.recordsTitle")}</caption>
        <thead>
          <tr>
            <th scope="col">{t("common.period")}</th>
            <th scope="col">{t("common.category")}</th>
            <th scope="col">{t("common.amount")}</th>
            <th scope="col">{t("common.actions")}</th>
          </tr>
        </thead>
        <tbody>
          {budgets.map((budget) => (
            <tr key={budget.id}>
              <td data-label={t("common.period")}>{periodLabel(budget.month, budget.year)}</td>
              <td data-label={t("common.category")}>{budget.category}</td>
              <td data-label={t("common.amount")}>
                <strong>{money(budget.amount)}</strong>
              </td>
              <td data-label={t("common.actions")}>
                <div className="row-actions">
                  <IconButton
                    icon={Pencil}
                    label={t("common.editBudget", { name: budget.category })}
                    variant="secondary"
                    onClick={() => onEdit(budget)}
                  />
                  <IconButton
                    icon={Trash2}
                    label={t("common.deleteBudget", { name: budget.category })}
                    variant="danger"
                    onClick={() => onDelete(budget)}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

