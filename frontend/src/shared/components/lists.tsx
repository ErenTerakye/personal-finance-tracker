import { AlertTriangle, ChevronDown, CircleAlert } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { formatActivityDate } from "../format/dates";
import { money, percent, signedMoney } from "../format/money";
import type { BudgetStatus, TransactionRecord } from "../../types";
import { EmptyState } from "./feedback";
import { useI18n } from "../i18n/I18nProvider";

export function PageHeader({
  eyebrow,
  title,
  summary,
  actions,
  className = "",
}: {
  eyebrow?: string;
  title: string;
  summary: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`page-heading ${className}`.trim()}
      aria-labelledby="page-title"
    >
      <div>
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1 id="page-title">{title}</h1>
        <p>{summary}</p>
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </section>
  );
}

export function Panel({
  title,
  detail,
  children,
  actions,
  className = "",
  deferred = false,
}: {
  title: string;
  detail?: string;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
  deferred?: boolean;
}) {
  return (
    <article
      className={`panel ${className} ${deferred ? "deferred-section" : ""}`.trim()}
    >
      <header className="panel-header">
        <div>
          <h2>{title}</h2>
          {detail ? <p>{detail}</p> : null}
        </div>
        {actions ? <div className="panel-actions">{actions}</div> : null}
      </header>
      {children}
    </article>
  );
}

export type BudgetReviewTarget = {
  category: string;
  month: number;
  year: number;
};

export type BudgetAttentionSummary = {
  overAmount: number;
  overCount: number;
  nearAmount: number;
  nearCount: number;
};

const INITIAL_ATTENTION_COUNT = 3;

export function rankBudgetAttention(statuses: BudgetStatus[]): BudgetStatus[] {
  return [...statuses]
    .filter((status) => status.status !== "ok")
    .sort((a, b) => {
      const priority = (value: string) =>
        value === "over budget" ? 2 : value === "near limit" ? 1 : 0;
      const priorityDifference = priority(b.status) - priority(a.status);
      if (priorityDifference !== 0) return priorityDifference;

      if (a.status === "over budget" && b.status === "over budget") {
        const impactDifference =
          Math.abs(Number(b.remaining)) - Math.abs(Number(a.remaining));
        if (impactDifference !== 0) return impactDifference;
      }

      if (a.status === "near limit" && b.status === "near limit") {
        const pressureDifference =
          Number(b.percent_used) - Number(a.percent_used);
        if (pressureDifference !== 0) return pressureDifference;
      }

      return a.budget.category.localeCompare(b.budget.category);
    });
}

export function summarizeBudgetAttention(
  statuses: BudgetStatus[],
): BudgetAttentionSummary {
  return statuses.reduce<BudgetAttentionSummary>(
    (summary, status) => {
      if (status.status === "over budget") {
        summary.overCount += 1;
        summary.overAmount += Math.max(0, -Number(status.remaining));
      } else if (status.status === "near limit") {
        summary.nearCount += 1;
        summary.nearAmount += Math.max(0, Number(status.remaining));
      }
      return summary;
    },
    { overAmount: 0, overCount: 0, nearAmount: 0, nearCount: 0 },
  );
}

export function BudgetPressureList({
  statuses,
  onReviewBudget,
}: {
  statuses: BudgetStatus[];
  onReviewBudget: (target: BudgetReviewTarget) => void;
}) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const disclosureId = useId();
  const rankedStatuses = rankBudgetAttention(statuses);
  const primaryStatuses = rankedStatuses.slice(0, INITIAL_ATTENTION_COUNT);
  const overflowStatuses = rankedStatuses.slice(INITIAL_ATTENTION_COUNT);
  const remainingCount = rankedStatuses.length - INITIAL_ATTENTION_COUNT;

  function renderStatus(status: BudgetStatus, index: number) {
    const tone = status.status.replaceAll(" ", "-");
    const overBudget = status.status === "over budget";
    const Icon = overBudget ? AlertTriangle : CircleAlert;
    const statusLabel = t(
      overBudget
        ? "dashboard.attention.statusOver"
        : "dashboard.attention.statusNear",
    );
    const variance = overBudget
      ? t("dashboard.attention.amountOver", {
          amount: money(Math.abs(Number(status.remaining))),
        })
      : t("dashboard.attention.amountLeft", {
          amount: money(status.remaining),
        });
    const actionLabel = t(
      overBudget
        ? "dashboard.attention.actionOver"
        : "dashboard.attention.actionNear",
    );
    const actionName = t(
      overBudget
        ? "dashboard.attention.reviewOver"
        : "dashboard.attention.reviewNear",
      { category: status.budget.category },
    );

    return (
      <li
        className={`pressure-row ${tone}${index === 0 ? " is-highest-priority" : ""}`}
        key={status.budget.id}
      >
        <div className="pressure-copy">
          <span className="pressure-status">
            <Icon aria-hidden="true" size={16} />
            <span>{statusLabel}</span>
          </span>
          <strong>{status.budget.category}</strong>
          <span className="pressure-spend">
            {t("dashboard.attention.spentOf", {
              spent: money(status.actual_expenses),
              limit: money(status.budget.amount),
            })}
          </span>
        </div>
        <strong className="pressure-variance">{variance}</strong>
        <progress
          max="100"
          value={Math.min(Number(status.percent_used), 100)}
          aria-label={t("dashboard.attention.progressLabel", {
            category: status.budget.category,
            percent: percent(status.percent_used),
          })}
        />
        <button
          className="button ghost pressure-review"
          type="button"
          aria-label={actionName}
          onClick={() =>
            onReviewBudget({
              category: status.budget.category,
              month: status.budget.month,
              year: status.budget.year,
            })
          }
        >
          <span aria-hidden="true">{actionLabel}</span>
        </button>
      </li>
    );
  }

  return (
    <div className="pressure-queue">
      <div className="pressure-surface">
        <ol className="pressure-list" role="list">
          {primaryStatuses.map(renderStatus)}
        </ol>
        {overflowStatuses.length ? (
          <div
            className={`pressure-overflow is-${expanded ? "expanded" : "collapsed"}`}
            id={disclosureId}
            aria-hidden={expanded ? undefined : "true"}
            inert={expanded ? undefined : true}
          >
            <div className="pressure-overflow-inner">
              <ol
                className="pressure-list pressure-list-extra"
                role="list"
                start={INITIAL_ATTENTION_COUNT + 1}
              >
                {overflowStatuses.map((status, index) =>
                  renderStatus(status, index + INITIAL_ATTENTION_COUNT),
                )}
              </ol>
            </div>
          </div>
        ) : null}
      </div>
      {remainingCount > 0 ? (
        <button
          className="button ghost pressure-disclosure"
          type="button"
          aria-controls={disclosureId}
          aria-expanded={expanded}
          onClick={() => setExpanded((current) => !current)}
        >
          <ChevronDown
            aria-hidden="true"
            className="pressure-disclosure-icon"
            size={18}
          />
          <span>
            {expanded
              ? t("dashboard.attention.showFewer")
              : t("dashboard.attention.showMore", { count: remainingCount })}
          </span>
        </button>
      ) : null}
    </div>
  );
}

export function ActivityList({
  transactions,
}: {
  transactions: TransactionRecord[];
}) {
  const { t } = useI18n();

  if (!transactions.length) {
    return (
      <EmptyState
        title={t("dashboard.activity.emptyTitle")}
        message={t("dashboard.activity.emptyMessage")}
      />
    );
  }

  return (
    <ul className="activity-list" role="list">
      {transactions.map((transaction) => {
        const isIncome = transaction.type === "income";
        const signedAmount = isIncome
          ? Math.abs(Number(transaction.amount))
          : -Math.abs(Number(transaction.amount));

        return (
          <li
            className={`activity-item ${isIncome ? "income" : "expense"}`}
            key={transaction.id}
          >
            <div className="activity-copy">
              <strong className="activity-category">
                {transaction.category}
              </strong>
              {transaction.description ? (
                <span className="activity-description">
                  {transaction.description}
                </span>
              ) : null}
            </div>
            <div className="activity-value">
              <strong className="activity-amount">
                {signedMoney(signedAmount)}
              </strong>
              <span className="activity-meta">
                <span>{t(isIncome ? "common.income" : "common.expense")}</span>
                <span aria-hidden="true">·</span>
                <time dateTime={transaction.date}>
                  {formatActivityDate(transaction.date)}
                </time>
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
