import { Pencil, Trash2 } from "lucide-react";
import { money, periodLabel } from "../format";
import type { BudgetRecord, TransactionRecord } from "../types";
import { EmptyState, IconButton } from "./ui";

export function TransactionTable({
  transactions,
  onEdit,
  onDelete
}: {
  transactions: TransactionRecord[];
  onEdit: (transaction: TransactionRecord) => void;
  onDelete: (transaction: TransactionRecord) => void;
}) {
  if (!transactions.length) {
    return (
      <EmptyState
        title="No transactions found"
        message="Change the filters or add a new ledger entry."
      />
    );
  }

  return (
    <div className="table-wrap">
      <table className="data-table">
        <caption>Transaction ledger</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Type</th>
            <th scope="col">Category</th>
            <th scope="col">Description</th>
            <th scope="col">Amount</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((transaction) => (
            <tr key={transaction.id}>
              <td data-label="Date">{transaction.date}</td>
              <td data-label="Type">
                <span className={`type-chip ${transaction.type}`}>{transaction.type}</span>
              </td>
              <td data-label="Category">{transaction.category}</td>
              <td data-label="Description">{transaction.description || "None"}</td>
              <td data-label="Amount">
                <strong className={transaction.type}>{money(transaction.amount)}</strong>
              </td>
              <td data-label="Actions">
                <div className="row-actions">
                  <IconButton icon={Pencil} variant="secondary" onClick={() => onEdit(transaction)}>
                    Edit
                  </IconButton>
                  <IconButton icon={Trash2} variant="danger" onClick={() => onDelete(transaction)}>
                    Delete
                  </IconButton>
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
  if (!budgets.length) {
    return (
      <EmptyState
        title="No budgets found"
        message="Change the filters or set a budget for this period."
      />
    );
  }

  return (
    <div className="table-wrap">
      <table className="data-table">
        <caption>Budget records</caption>
        <thead>
          <tr>
            <th scope="col">Period</th>
            <th scope="col">Category</th>
            <th scope="col">Amount</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {budgets.map((budget) => (
            <tr key={budget.id}>
              <td data-label="Period">{periodLabel(budget.month, budget.year)}</td>
              <td data-label="Category">{budget.category}</td>
              <td data-label="Amount">
                <strong>{money(budget.amount)}</strong>
              </td>
              <td data-label="Actions">
                <div className="row-actions">
                  <IconButton icon={Pencil} variant="secondary" onClick={() => onEdit(budget)}>
                    Update
                  </IconButton>
                  <IconButton icon={Trash2} variant="danger" onClick={() => onDelete(budget)}>
                    Delete
                  </IconButton>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
