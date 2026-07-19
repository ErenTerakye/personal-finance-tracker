import {
  ArrowDownLeft,
  ArrowUpRight,
  MoreHorizontal,
  Pencil,
  Plus,
  ReceiptText,
  Trash2,
} from "lucide-react";
import type { CSSProperties } from "react";
import type { TransactionRecord } from "../../../types";
import { EmptyState } from "../../../shared/components/feedback";
import { formatDate, getFormatterLocale } from "../../../shared/format/dates";
import {
  absoluteMoney,
  compareMoney,
  money,
  subtractMoney,
  sumMoney,
} from "../../../shared/format/money";
import { useI18n } from "../../../shared/i18n/I18nProvider";

type ActivityGroup = {
  date: string;
  transactions: TransactionRecord[];
  income: string;
  expenses: string;
};

function groupTransactions(transactions: TransactionRecord[]): ActivityGroup[] {
  const groups = new Map<string, ActivityGroup>();
  for (const transaction of transactions) {
    const group = groups.get(transaction.date) ?? {
      date: transaction.date,
      transactions: [],
      income: "0.00",
      expenses: "0.00",
    };
    group.transactions.push(transaction);
    if (transaction.type === "income") {
      group.income = sumMoney([group.income, transaction.amount]);
    } else {
      group.expenses = sumMoney([group.expenses, transaction.amount]);
    }
    groups.set(transaction.date, group);
  }
  return [...groups.values()];
}

function dayLabel(dateValue: string) {
  const [year, month, day] = dateValue.split("-").map(Number);
  if (!year || !month || !day) return formatDate(dateValue);
  return new Intl.DateTimeFormat(getFormatterLocale(), {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date(year, month - 1, day));
}

export function ActivityLedger({
  transactions,
  onEdit,
  onDelete,
  onCreate,
  onClear,
  filtered,
}: {
  transactions: TransactionRecord[];
  onEdit: (transaction: TransactionRecord) => void;
  onDelete: (transaction: TransactionRecord) => void;
  onCreate: () => void;
  onClear: () => void;
  filtered: boolean;
}) {
  const { t } = useI18n();

  if (!transactions.length) {
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
          filtered ? (
            <button
              className="button secondary"
              type="button"
              onClick={onClear}
            >
              {t("transactions.empty.clearSearchAndFilters")}
            </button>
          ) : (
            <button className="button primary" type="button" onClick={onCreate}>
              <Plus aria-hidden="true" size={18} />
              <span>{t("common.addTransaction")}</span>
            </button>
          )
        }
      />
    );
  }

  return (
    <ol className="ledger-days" role="list">
      {groupTransactions(transactions).map((group) => {
        const net = subtractMoney(group.income, group.expenses);
        const netDirection = compareMoney(net, 0);
        return (
          <li className="ledger-day" key={group.date}>
            <header className="ledger-day-header">
              <div>
                <time dateTime={group.date}>{dayLabel(group.date)}</time>
                <span>
                  {t(
                    group.transactions.length === 1
                      ? "transactions.feed.entryCountOne"
                      : "transactions.feed.entryCount",
                    { count: group.transactions.length },
                  )}
                </span>
              </div>
              <strong className={netDirection >= 0 ? "income" : "expense"}>
                {netDirection >= 0 ? "+" : "−"}
                {money(absoluteMoney(net))}
              </strong>
            </header>
            <ol className="ledger-entries" role="list">
              {group.transactions.map((transaction) => {
                const isIncome = transaction.type === "income";
                const DirectionIcon = isIncome ? ArrowDownLeft : ArrowUpRight;
                const name = transaction.description || transaction.category;
                return (
                  <li
                    className={`ledger-entry ${transaction.type}`}
                    key={transaction.id}
                  >
                    <span className="ledger-entry-icon" aria-hidden="true">
                      <DirectionIcon size={19} />
                    </span>
                    <div className="ledger-entry-copy">
                      <strong>{name}</strong>
                      <span>
                        <span>{transaction.category}</span>
                        {transaction.description
                          ? ` · ${t(`common.${transaction.type}`)}`
                          : ""}
                      </span>
                    </div>
                    <strong className="ledger-entry-amount">
                      <span className="sr-only">
                        {t(`common.${transaction.type}`)}{" "}
                      </span>
                      {isIncome ? "+" : "−"}
                      {money(transaction.amount)}
                    </strong>
                    <div className="ledger-entry-actions">
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
                        <MoreHorizontal aria-hidden="true" size={19} />
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
                  </li>
                );
              })}
            </ol>
          </li>
        );
      })}
    </ol>
  );
}

function closePopover(id: string) {
  const popover = document.getElementById(id) as
    (HTMLElement & { hidePopover?: () => void }) | null;
  popover?.hidePopover?.();
}
