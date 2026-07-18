import { CircleGauge, X } from "lucide-react";
import {
  absoluteMoney,
  compareMoney,
  money,
} from "../../../shared/format/money";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import type { BudgetRecord, BudgetStatus } from "../../../types";

export function BudgetInspector({
  status,
  open,
  id,
  titleId,
  tone,
  statusLabel,
  onClose,
  onReviewTransactions,
  onEdit,
  onDelete,
}: {
  status: BudgetStatus;
  open: boolean;
  id: string;
  titleId: string;
  tone: string;
  statusLabel: string;
  onClose: () => void;
  onReviewTransactions: (category: string, month: number, year: number) => void;
  onEdit: (budget: BudgetRecord) => void;
  onDelete: (budget: BudgetRecord) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="plan-inspector-layer" aria-hidden={!open} inert={!open}>
      <aside
        id={id}
        className={`plan-inspector ${tone}${open ? " is-open" : ""}`}
        aria-labelledby={titleId}
      >
        <div className="plan-inspector-content">
          <div className="plan-inspector-heading">
            <div>
              <span className="plan-status-badge">{statusLabel}</span>
              <h3 id={titleId}>{status.budget.category}</h3>
              <p>{t("budgets.inspector.summary")}</p>
            </div>
            <button
              className="icon-button secondary plan-inspector-close"
              type="button"
              aria-label={t("budgets.inspector.close")}
              onClick={onClose}
            >
              <X aria-hidden="true" size={18} />
            </button>
          </div>
          <dl className="plan-inspector-metrics">
            <div>
              <dt>{t("budgets.inspector.limit")}</dt>
              <dd>{money(status.budget.amount)}</dd>
            </div>
            <div>
              <dt>{t("budgets.inspector.spent")}</dt>
              <dd>{money(status.actual_expenses)}</dd>
            </div>
            <div>
              <dt>
                {t(
                  compareMoney(status.remaining, 0) < 0
                    ? "budgets.inspector.over"
                    : "budgets.inspector.available",
                )}
              </dt>
              <dd>{money(absoluteMoney(status.remaining))}</dd>
            </div>
          </dl>
          <div className="plan-inspector-footer">
            <p className="plan-inspector-insight">
              <CircleGauge aria-hidden="true" size={18} />
              {t("budgets.inspector.used", {
                percent: status.percent_used,
              })}
            </p>
            <div className="plan-inspector-actions">
              <button
                className="button secondary"
                type="button"
                onClick={() =>
                  onReviewTransactions(
                    status.budget.category,
                    status.budget.month,
                    status.budget.year,
                  )
                }
              >
                {t("budgets.inspector.viewTransactions")}
              </button>
              <button
                className="button primary"
                type="button"
                onClick={() => onEdit(status.budget)}
              >
                {t("budgets.inspector.edit", {
                  category: status.budget.category,
                })}
              </button>
              <button
                className="button danger"
                type="button"
                onClick={() => onDelete(status.budget)}
              >
                {t("budgets.dialog.deleteBtn")}
              </button>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
