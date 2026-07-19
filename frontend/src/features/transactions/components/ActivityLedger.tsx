import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRightLeft,
  Scale,
  Landmark,
  MoreHorizontal,
  Pencil,
  Plus,
  ReceiptText,
  Trash2,
} from "lucide-react";
import type { CSSProperties } from "react";
import type { ActivityRecord } from "../../../types";
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
  records: ActivityRecord[];
  income: string;
  expenses: string;
};

function groupActivities(records: ActivityRecord[]): ActivityGroup[] {
  const groups = new Map<string, ActivityGroup>();
  for (const record of records) {
    const group = groups.get(record.date) ?? {
      date: record.date,
      records: [],
      income: "0.00",
      expenses: "0.00",
    };
    group.records.push(record);
    if (record.kind === "income") {
      group.income = sumMoney([group.income, record.amount]);
    } else if (record.kind === "expense") {
      group.expenses = sumMoney([group.expenses, record.amount]);
    }
    groups.set(record.date, group);
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
  records,
  onEdit,
  onDelete,
  onAccount,
  onClear,
  filtered,
  onCreate,
}: {
  records: ActivityRecord[];
  onEdit: (record: ActivityRecord) => void;
  onDelete: (record: ActivityRecord) => void;
  onAccount: (id: number) => void;
  onClear: () => void;
  filtered: boolean;
  onCreate: () => void;
}) {
  const { t } = useI18n();

  if (!records.length) {
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
      {groupActivities(records).map((group) => {
        const net = subtractMoney(group.income, group.expenses);
        const netDirection = compareMoney(net, 0);
        return (
          <li className="ledger-day" key={group.date}>
            <header className="ledger-day-header">
              <div>
                <time dateTime={group.date}>{dayLabel(group.date)}</time>
                <span>
                  {t(
                    group.records.length === 1
                      ? "transactions.feed.entryCountOne"
                      : "transactions.feed.entryCount",
                    { count: group.records.length },
                  )}
                </span>
              </div>
              <strong className={netDirection >= 0 ? "income" : "expense"}>
                {netDirection >= 0 ? "+" : "−"}
                {money(absoluteMoney(net))}
              </strong>
            </header>
            <ol className="ledger-entries" role="list">
              {group.records.map((record) => {
                const isIncome = record.kind === "income";
                const isExpense = record.kind === "expense";
                const isTransfer = record.kind === "transfer";
                const isAdjustment = record.kind === "adjustment";

                const DirectionIcon = isIncome
                  ? ArrowDownLeft
                  : isExpense
                    ? ArrowUpRight
                    : isTransfer
                      ? ArrowRightLeft
                      : isAdjustment
                        ? Scale
                        : Landmark;

                const name =
                  record.description ||
                  record.category ||
                  t(`activity.kinds.${record.kind}`);

                const effects = [
                  record.account,
                  record.from_account,
                  record.to_account,
                ].filter((item): item is NonNullable<typeof item> =>
                  Boolean(item),
                );

                return (
                  <li className={`ledger-entry ${record.kind}`} key={record.id}>
                    <span className="ledger-entry-icon" aria-hidden="true">
                      <DirectionIcon size={19} />
                    </span>
                    <div className="ledger-entry-copy">
                      <strong>{name}</strong>
                      <span className="ledger-entry-subtitle">
                        {isIncome || isExpense ? (
                          <>
                            {record.category ? (
                              <span>{record.category}</span>
                            ) : null}
                            {record.category && record.account ? " · " : ""}
                            {record.account ? (
                              <button
                                className="link-button"
                                type="button"
                                onClick={() => onAccount(record.account!.id)}
                              >
                                {record.account.name}
                              </button>
                            ) : null}
                          </>
                        ) : isTransfer ? (
                          record.from_account && record.to_account ? (
                            <>
                              <button
                                className="link-button"
                                type="button"
                                onClick={() =>
                                  onAccount(record.from_account!.id)
                                }
                              >
                                {record.from_account.name}
                              </button>
                              {" → "}
                              <button
                                className="link-button"
                                type="button"
                                onClick={() => onAccount(record.to_account!.id)}
                              >
                                {record.to_account.name}
                              </button>
                            </>
                          ) : null
                        ) : record.account ? (
                          <button
                            className="link-button"
                            type="button"
                            onClick={() => onAccount(record.account!.id)}
                          >
                            {record.account.name}
                          </button>
                        ) : null}
                      </span>
                      {effects.length > 0 && (
                        <div
                          className="ledger-entry-effects"
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.15rem",
                            marginBlockStart: "0.25rem",
                          }}
                        >
                          {effects.map((effect) => (
                            <span
                              key={effect.role}
                              className={`balance-effect ${effect.balance_state}`}
                              style={{ fontSize: "var(--font-size-xs)" }}
                            >
                              {effect.name}: {money(effect.before_balance)} →{" "}
                              {money(effect.after_balance)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <strong className="ledger-entry-amount">
                      <span className="sr-only">
                        {t(`activity.kinds.${record.kind}`)}{" "}
                      </span>
                      {isIncome ? "+" : isExpense ? "−" : ""}
                      {money(record.amount)}
                    </strong>
                    <div className="ledger-entry-actions">
                      {record.kind !== "opening" ? (
                        <>
                          <button
                            className="icon-button ghost action-trigger-btn"
                            type="button"
                            popoverTarget={`row-actions-${record.id}`}
                            aria-label={t("common.actions")}
                            style={
                              {
                                anchorName: `--row-anchor-${record.id}`,
                              } as CSSProperties
                            }
                          >
                            <MoreHorizontal aria-hidden="true" size={19} />
                          </button>
                          <div
                            popover="auto"
                            id={`row-actions-${record.id}`}
                            className="row-action-panel"
                            style={
                              {
                                positionAnchor: `--row-anchor-${record.id}`,
                              } as CSSProperties
                            }
                          >
                            <button
                              className="row-action-item edit"
                              type="button"
                              onClick={() => {
                                closePopover(`row-actions-${record.id}`);
                                onEdit(record);
                              }}
                            >
                              <Pencil aria-hidden="true" size={16} />
                              <span>{t("common.edit")}</span>
                            </button>
                            <button
                              className="row-action-item delete"
                              type="button"
                              onClick={() => {
                                closePopover(`row-actions-${record.id}`);
                                onDelete(record);
                              }}
                            >
                              <Trash2 aria-hidden="true" size={16} />
                              <span>{t("common.delete")}</span>
                            </button>
                          </div>
                        </>
                      ) : (
                        <span
                          style={{
                            fontSize: "var(--font-size-xs)",
                            color: "var(--muted)",
                            paddingInlineEnd: "0.5rem",
                          }}
                        >
                          {t("activity.readOnly")}
                        </span>
                      )}
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
