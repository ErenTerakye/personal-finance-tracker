import { MoreVertical, Pencil, Plus, ReceiptText, Trash2 } from "lucide-react";
import type { CSSProperties } from "react";
import { formatDate } from "../format/dates";
import { money } from "../format/money";
import { periodLabel } from "../format/periods";
import type { BudgetRecord, TransactionRecord } from "../../types";
import { useI18n } from "../i18n/I18nProvider";
import { IconButton } from "./actions";
import { EmptyState } from "./feedback";

export function TransactionTable({
  transactions,
  onEdit,
  onDelete,
  onCreate,
  emptyVariant = "initial",
  onClearEmpty,
}: {
  transactions: TransactionRecord[];
  onEdit: (transaction: TransactionRecord) => void;
  onDelete: (transaction: TransactionRecord) => void;
  onCreate?: () => void;
  emptyVariant?: "initial" | "filtered";
  onClearEmpty?: () => void;
}) {
  const { t, tUpper } = useI18n();

  if (!transactions.length) {
    const filtered = emptyVariant === "filtered";
    return (
      <EmptyState
        icon={ReceiptText}
        title={t(
          filtered
            ? "transactions.empty.noMatches"
            : "transactions.empty.noTransactions",
        )}
        message={t(
          filtered
            ? "transactions.empty.noMatchesMsg"
            : "transactions.empty.noTransactionsMsg",
        )}
        action={
          filtered && onClearEmpty ? (
            <button
              className="button secondary"
              type="button"
              onClick={onClearEmpty}
            >
              <span>{t("transactions.empty.clearSearchAndFilters")}</span>
            </button>
          ) : onCreate ? (
            <button className="button primary" type="button" onClick={onCreate}>
              <Plus aria-hidden="true" size={18} />
              <span>{t("common.addEntry")}</span>
            </button>
          ) : undefined
        }
      />
    );
  }

  return (
    <div className="table-wrap">
      <table className="data-table transaction-table">
        <caption>{t("transactions.historyTitle")}</caption>
        <thead>
          <tr>
            <th scope="col">{tUpper("common.date")}</th>
            <th scope="col">{tUpper("common.type")}</th>
            <th scope="col">{tUpper("common.category")}</th>
            <th scope="col">{tUpper("common.description")}</th>
            <th scope="col">{tUpper("common.amount")}</th>
            <th scope="col">{tUpper("common.actions")}</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((transaction) => (
            <tr key={transaction.id}>
              <td data-label={t("common.date")}>
                {formatDate(transaction.date)}
              </td>
              <td data-label={t("common.type")}>
                <span className={`type-chip ${transaction.type}`}>
                  {t(`common.${transaction.type}`) || transaction.type}
                </span>
              </td>
              <td data-label={t("common.category")}>{transaction.category}</td>
              <td data-label={t("common.description")}>
                {transaction.description || t("common.all")}
              </td>
              <td data-label={t("common.amount")}>
                <strong className={transaction.type}>
                  {money(transaction.amount)}
                </strong>
              </td>
              <td data-label={t("common.actions")}>
                <div className="row-actions-container">
                  <button
                    className="icon-button ghost action-trigger-btn"
                    type="button"
                    popoverTarget={`row-actions-${transaction.id}`}
                    aria-label={t("common.actions")}
                    style={
                      {
                        anchorName: `--row-anchor-${transaction.id}`,
                      } as CSSProperties
                    }
                  >
                    <MoreVertical aria-hidden="true" size={18} />
                  </button>
                  <div
                    popover="auto"
                    id={`row-actions-${transaction.id}`}
                    className="row-action-panel"
                    style={
                      {
                        positionAnchor: `--row-anchor-${transaction.id}`,
                      } as CSSProperties
                    }
                  >
                    <button
                      className="row-action-item edit"
                      type="button"
                      onClick={() => {
                        closePopover(`row-actions-${transaction.id}`);
                        onEdit(transaction);
                      }}
                    >
                      <Pencil aria-hidden="true" size={16} />
                      <span>{t("common.edit")}</span>
                    </button>
                    <button
                      className="row-action-item delete"
                      type="button"
                      onClick={() => {
                        closePopover(`row-actions-${transaction.id}`);
                        onDelete(transaction);
                      }}
                    >
                      <Trash2 aria-hidden="true" size={16} />
                      <span>{t("common.delete")}</span>
                    </button>
                  </div>
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
  onDelete,
}: {
  budgets: BudgetRecord[];
  onEdit: (budget: BudgetRecord) => void;
  onDelete: (budget: BudgetRecord) => void;
}) {
  const { t, tUpper } = useI18n();

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
            <th scope="col">{tUpper("common.period")}</th>
            <th scope="col">{tUpper("common.category")}</th>
            <th scope="col">{tUpper("common.amount")}</th>
            <th scope="col">{tUpper("common.actions")}</th>
          </tr>
        </thead>
        <tbody>
          {budgets.map((budget) => (
            <tr key={budget.id}>
              <td data-label={t("common.period")}>
                {periodLabel(budget.month, budget.year)}
              </td>
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

function closePopover(id: string) {
  const popover = document.getElementById(id) as
    (HTMLElement & { hidePopover?: () => void }) | null;
  popover?.hidePopover?.();
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="skeleton-container" aria-hidden="true">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="skeleton-row">
          <div className="skeleton-cell skeleton-cell-date" />
          <div className="skeleton-cell skeleton-cell-badge" />
          <div className="skeleton-cell skeleton-cell-text" />
          <div className="skeleton-cell skeleton-cell-description" />
          <div className="skeleton-cell skeleton-cell-amount" />
          <div className="skeleton-cell skeleton-cell-actions" />
        </div>
      ))}
    </div>
  );
}
