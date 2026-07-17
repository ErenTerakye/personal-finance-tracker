import { useEffect, useId, useRef, useState } from "react";
import "./dashboard-components.css";
import "./dashboard.css";
import "./dashboard-overrides.css";
import {
  CheckCircle2,
  ChevronDown,
  Download,
  FileText,
  ImageDown,
  PiggyBank,
  Plus,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import { artifactUrls } from "../../api/artifacts";
import { CashflowTrend, ExpenseMix } from "../../shared/charts";
import { PeriodControl } from "../../shared/components/PeriodControl";
import {
  ActivityList,
  BudgetPressureList,
  PageHeader,
  Panel,
  rankBudgetAttention,
  summarizeBudgetAttention,
  type BudgetReviewTarget,
} from "../../shared/components/lists";
import { ActionButton } from "../../shared/components/actions";
import { EmptyState, ErrorBanner } from "../../shared/components/feedback";
import { money, percent } from "../../shared/format/money";
import { useMediaQuery } from "../../shared/hooks/useMediaQuery";
import { periodLabel } from "../../shared/format/periods";
import { useI18n } from "../../shared/i18n/I18nProvider";
import type { DashboardData, TransactionRecord } from "../../types";
import { preloadDashboard, useDashboard } from "./useDashboard";
import { usePeriodTransition } from "../../shared/hooks/usePeriodTransition";
import { RollingNumber } from "../../shared/components/RollingNumber";
import DashboardNetWorthPanel from "./DashboardNetWorthPanel";

export function preloadDashboardView(period: { month: number; year: number }) {
  return preloadDashboard(period.month, period.year);
}

export function DashboardView({
  selectedPeriod,
  setSelectedPeriod,
  onAddTransaction,
  onCreateBudget,
  onReviewAccounts,
  onReviewBudget,
  onReviewCategory,
  onReviewTransaction,
  onViewTransactions,
}: {
  selectedPeriod: { month: number; year: number };
  setSelectedPeriod: (period: { month: number; year: number }) => void;
  onAddTransaction: () => void;
  onCreateBudget: () => void;
  onReviewAccounts: (asOf?: string) => void;
  onReviewBudget: (target: BudgetReviewTarget) => void;
  onReviewCategory: (category: string) => void;
  onReviewTransaction: (transaction: TransactionRecord) => void;
  onViewTransactions: () => void;
}) {
  const { t, locale, tUpper } = useI18n();
  const dashboard = useDashboard(selectedPeriod.month, selectedPeriod.year);
  const periodTransition = usePeriodTransition(selectedPeriod, dashboard);

  if (dashboard.status === "error" && !periodTransition.data) {
    return (
      <ErrorBanner
        message={dashboard.error.message}
        onRetry={dashboard.refetch}
      />
    );
  }

  if (!periodTransition.data) {
    return (
      <Panel
        title={t("dashboard.empty.loadingTitle")}
        detail={t("dashboard.empty.fetching")}
      >
        <p className="loading-state">{t("dashboard.empty.preparing")}</p>
      </Panel>
    );
  }

  const data: DashboardData = periodTransition.data;

  const categories = Object.entries(data.report.expenses_by_category)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => Number(b.value) - Number(a.value));
  const net = Number(data.report.net_savings);
  const netDelta = Number(data.report.net_savings_delta);
  const attention = rankBudgetAttention(data.budget_statuses);
  const attentionSummary = summarizeBudgetAttention(attention);
  const attentionDetail =
    attentionSummary.overCount && attentionSummary.nearCount
      ? t("dashboard.attention.summaryCombined", {
          over: attentionSummary.overCount,
          overAmount: money(attentionSummary.overAmount),
          near: attentionSummary.nearCount,
          nearAmount: money(attentionSummary.nearAmount),
        })
      : attentionSummary.overCount
        ? t("dashboard.attention.summaryOver", {
            count: attentionSummary.overCount,
            amount: money(attentionSummary.overAmount),
          })
        : attentionSummary.nearCount
          ? t("dashboard.attention.summaryNear", {
              count: attentionSummary.nearCount,
              amount: money(attentionSummary.nearAmount),
            })
          : data.budget_statuses.length
            ? t("dashboard.attention.safeDetail", {
                count: data.budget_statuses.length,
              })
            : t("dashboard.attention.noBudgetsDetail");

  // Determine localized period label from month number if Turkish
  const displayPeriodLabel =
    locale === "tr" ? periodLabel(data.month, data.year) : data.period_label;

  return (
    <div
      className={`period-view dashboard-period-view${periodTransition.pending ? " is-period-pending" : ""}`}
      aria-busy={periodTransition.pending}
    >
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {!periodTransition.pending && periodTransition.presentedPeriod
          ? t("common.periodLoaded", { period: displayPeriodLabel })
          : ""}
      </p>
      {dashboard.status === "error" ? (
        <ErrorBanner
          message={dashboard.error.message}
          onRetry={dashboard.refetch}
        />
      ) : null}
      <PageHeader
        eyebrow={tUpper("dashboard.eyebrow")}
        title={t("dashboard.overviewTitle")}
        summary={
          net >= 0
            ? t("dashboard.narrative.positive", { amount: money(net) })
            : t("dashboard.narrative.negative", {
                amount: money(Math.abs(net)),
              })
        }
        className="dashboard-heading dashboard-context-header"
        context={
          <div
            className="dashboard-heading-tools dashboard-actions"
            aria-label={t("dashboard.toolsLabel")}
          >
            <PeriodControl
              label={t("dashboard.changePeriod")}
              value={selectedPeriod}
              onChange={setSelectedPeriod}
              onPrepare={(period) => {
                void preloadDashboard(period.month, period.year).catch(
                  () => undefined,
                );
              }}
              busy={periodTransition.pending}
            />
            <ReportMenu
              month={selectedPeriod.month}
              year={selectedPeriod.year}
            />
          </div>
        }
        actions={
          <div
            className="action-cluster"
            aria-label={t("dashboard.detail.actions")}
          >
            <ActionButton icon={Plus} onClick={onAddTransaction}>
              {t("common.addTransaction")}
            </ActionButton>
            <ActionButton
              icon={PiggyBank}
              variant="secondary"
              onClick={onCreateBudget}
            >
              {t("common.setBudget")}
            </ActionButton>
          </div>
        }
      />

      <div className="period-transition-content">
        <section
          className="dashboard-summary"
          aria-label={t("dashboard.summaryAria", {
            period: displayPeriodLabel,
          })}
        >
          <div className={`balance-story ${net < 0 ? "negative" : "positive"}`}>
            <p className="eyebrow">{tUpper("dashboard.kpi.netPosition")}</p>
            <strong>
              <RollingNumber
                value={Number(data.report.net_savings)}
                previousValue={Number(
                  periodTransition.previousData?.report.net_savings ??
                    data.report.net_savings,
                )}
                format={money}
              />
            </strong>
            <p>
              {netDelta === 0
                ? t("dashboard.narrative.unchanged")
                : t(
                    netDelta > 0
                      ? "dashboard.narrative.better"
                      : "dashboard.narrative.lower",
                    { amount: money(Math.abs(netDelta)) },
                  )}
            </p>
            <dl className="cashflow-comparison">
              <div className="cashflow-metric cashflow-metric-income">
                <dt>{t("dashboard.kpi.income")}</dt>
                <dd>
                  <RollingNumber
                    value={Number(data.report.total_income)}
                    previousValue={Number(
                      periodTransition.previousData?.report.total_income ??
                        data.report.total_income,
                    )}
                    format={money}
                  />
                </dd>
              </div>
              <div className="cashflow-metric cashflow-metric-expenses">
                <dt>{t("dashboard.kpi.expenses")}</dt>
                <dd>
                  <RollingNumber
                    value={Number(data.report.total_expenses)}
                    previousValue={Number(
                      periodTransition.previousData?.report.total_expenses ??
                        data.report.total_expenses,
                    )}
                    format={money}
                  />
                </dd>
              </div>
              <div
                className={`cashflow-metric cashflow-metric-savings ${
                  Number(data.savings_rate) < 0 ? "negative" : "positive"
                }`}
              >
                <dt>{t("dashboard.kpi.savingsRate")}</dt>
                <dd>
                  <RollingNumber
                    value={Number(data.savings_rate)}
                    previousValue={Number(
                      periodTransition.previousData?.savings_rate ??
                        data.savings_rate,
                    )}
                    format={percent}
                  />
                </dd>
              </div>
            </dl>
            <p>
              {t("dashboard.detail.entries", {
                count: data.report.transaction_count,
              })}
            </p>
          </div>
        </section>

        <section className="dashboard-lead" aria-label={t("dashboard.title")}>
          <Panel
            title={t("charts.title")}
            detail={t("charts.desc")}
            className="tape-panel"
          >
            <CashflowTrend months={data.trend.months} />
          </Panel>
        </section>

        <DashboardNetWorthPanel
          netWorth={data.net_worth}
          onNavigate={() => onReviewAccounts(data.net_worth.as_of)}
        />

        <section
          className="analysis-grid dashboard-priorities"
          aria-label={t("dashboard.title")}
        >
          <Panel
            title={t("dashboard.sections.attentionTitle")}
            detail={attentionDetail}
            className="attention-panel"
          >
            {attention.length ? (
              <BudgetPressureList
                key={`${selectedPeriod.year}-${selectedPeriod.month}`}
                statuses={attention}
                onReviewBudget={onReviewBudget}
              />
            ) : data.budget_statuses.length ? (
              <EmptyState
                icon={CheckCircle2}
                title={t("dashboard.attention.safeTitle")}
                message={t("dashboard.attention.safeMessage")}
              />
            ) : (
              <EmptyState
                icon={PiggyBank}
                title={t("dashboard.attention.noBudgetsTitle")}
                message={t("dashboard.attention.noBudgetsMessage")}
                action={
                  <ActionButton icon={PiggyBank} onClick={onCreateBudget}>
                    {t("common.setBudget")}
                  </ActionButton>
                }
              />
            )}
          </Panel>
        </section>

        <section
          className="analysis-grid dashboard-analysis-pair"
          aria-label={t("dashboard.title")}
        >
          <Panel
            title={t("dashboard.sections.activityTitle")}
            actions={
              <button
                className="button ghost activity-view-all"
                type="button"
                onClick={onViewTransactions}
              >
                {t("dashboard.viewAllActivity")}
                <ArrowRight aria-hidden="true" size={17} />
              </button>
            }
          >
            <ActivityList
              transactions={data.recent_transactions}
              onSelect={onReviewTransaction}
            />
          </Panel>
          <Panel
            title={t("dashboard.sections.mixTitle")}
            detail={t("dashboard.sections.mixDetail")}
          >
            <ExpenseMix
              title={t("dashboard.sections.mixTitle")}
              items={categories}
              onClickCategory={(category) => {
                const otherLabel = t("charts.otherCategories");
                if (category === otherLabel) {
                  onReviewCategory("");
                } else {
                  onReviewCategory(category);
                }
              }}
            />
          </Panel>
        </section>
      </div>
    </div>
  );
}

function sizeCompactReportPopover(
  trigger: HTMLButtonElement,
  popover: HTMLDivElement,
): void {
  const appBar = document.querySelector<HTMLElement>(".compact-app-bar");
  const bottomNavigation = document.querySelector<HTMLElement>(
    ".compact-primary-navigation",
  );
  if (
    !appBar ||
    !bottomNavigation ||
    getComputedStyle(appBar).display === "none" ||
    getComputedStyle(bottomNavigation).display === "none"
  ) {
    popover.style.removeProperty("max-block-size");
    return;
  }

  const gap = 8;
  const safeTop = appBar.getBoundingClientRect().bottom + gap;
  const safeBottom = bottomNavigation.getBoundingClientRect().top - gap;
  const anchoredTop = Math.max(
    trigger.getBoundingClientRect().bottom + gap,
    safeTop,
  );
  const rootFontSize =
    Number.parseFloat(getComputedStyle(document.documentElement).fontSize) ||
    16;
  popover.style.maxBlockSize = `${Math.min(
    20 * rootFontSize,
    Math.max(0, safeBottom - anchoredTop),
  )}px`;
}

function ReportMenu({ month, year }: { month: number; year: number }) {
  const id = useId();
  const titleId = `${id}-title`;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const compactLayout = useMediaQuery("(max-width: 63.999rem)");
  const [compactOpen, setCompactOpen] = useState(false);
  useEffect(() => {
    const closeTransientUi = () => setCompactOpen(false);
    window.addEventListener("finance-tracker:route-leave", closeTransientUi);
    return () =>
      window.removeEventListener(
        "finance-tracker:route-leave",
        closeTransientUi,
      );
  }, []);
  const { t } = useI18n();

  useEffect(() => {
    const popover = popoverRef.current;
    if (!popover) return;

    let animationFrame = 0;
    const syncCompactPosition = (event?: Event) => {
      if (event?.target instanceof Node && popover.contains(event.target))
        return;

      cancelAnimationFrame(animationFrame);
      animationFrame = requestAnimationFrame(() => {
        const trigger = triggerRef.current;
        const open = compactLayout
          ? popover.dataset.open === "true"
          : popover.matches(":popover-open");
        if (!trigger || !open) return;

        sizeCompactReportPopover(trigger, popover);
      });
    };

    popover.addEventListener("toggle", syncCompactPosition);
    document.addEventListener("scroll", syncCompactPosition, true);
    window.addEventListener("resize", syncCompactPosition);
    window.visualViewport?.addEventListener("resize", syncCompactPosition);
    syncCompactPosition();
    return () => {
      cancelAnimationFrame(animationFrame);
      popover.removeEventListener("toggle", syncCompactPosition);
      document.removeEventListener("scroll", syncCompactPosition, true);
      window.removeEventListener("resize", syncCompactPosition);
      window.visualViewport?.removeEventListener("resize", syncCompactPosition);
    };
  }, [compactLayout, compactOpen]);

  useEffect(() => {
    if (!compactLayout || !compactOpen) return;

    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (
        popoverRef.current?.contains(target) ||
        triggerRef.current?.contains(target)
      )
        return;
      setCompactOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setCompactOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [compactLayout, compactOpen]);

  const prepareCompactPopover = () => {
    const trigger = triggerRef.current;
    const popover = popoverRef.current;
    if (!trigger || !popover || popover.matches(":popover-open")) return;
    sizeCompactReportPopover(trigger, popover);
  };

  return (
    <div className="report-menu">
      <button
        ref={triggerRef}
        className="button secondary"
        type="button"
        popoverTarget={compactLayout ? undefined : id}
        aria-label={t("dashboard.downloadLabel")}
        aria-controls={id}
        aria-expanded={compactLayout ? compactOpen : undefined}
        onClick={
          compactLayout
            ? () => setCompactOpen((open) => !open)
            : prepareCompactPopover
        }
      >
        <Download aria-hidden="true" size={18} />
        <span>{t("dashboard.exportAction")}</span>
        <ChevronDown
          className="report-menu-chevron"
          aria-hidden="true"
          size={16}
        />
      </button>
      <div
        ref={popoverRef}
        className="artifact-popover"
        id={id}
        popover={compactLayout ? undefined : "auto"}
        hidden={compactLayout ? !compactOpen : undefined}
        data-open={compactLayout && compactOpen ? "true" : undefined}
        role="group"
        aria-labelledby={titleId}
        onClick={(event) => {
          if (compactLayout && event.target instanceof Element) {
            if (event.target.closest("a")) setCompactOpen(false);
          }
        }}
      >
        <div className="artifact-popover-header">
          <h2 id={titleId}>{t("dashboard.reportMenu")}</h2>
        </div>
        <div className="artifact-popover-list">
          <ArtifactLink
            icon={FileText}
            label={t("dashboard.monthReport")}
            format="TXT"
            href={artifactUrls.monthlyReport(month, year)}
          />
          <ArtifactLink
            icon={ImageDown}
            label={t("dashboard.monthChart")}
            format="PNG"
            href={artifactUrls.monthlyChart(month, year)}
          />
          <ArtifactLink
            icon={FileText}
            label={t("dashboard.trendReport")}
            format="TXT"
            href={artifactUrls.trendReport(month, year)}
          />
          <ArtifactLink
            icon={ImageDown}
            label={t("dashboard.trendChart")}
            format="PNG"
            href={artifactUrls.trendChart(month, year)}
          />
        </div>
      </div>
    </div>
  );
}

function ArtifactLink({
  icon: Icon,
  label,
  format,
  href,
}: {
  icon: LucideIcon;
  label: string;
  format: "TXT" | "PNG";
  href: string;
}) {
  return (
    <a className="artifact-link" href={href} download>
      <span className="artifact-link-icon" aria-hidden="true">
        <Icon size={18} />
      </span>
      <strong>{label}</strong>
      <span className="artifact-link-format" aria-hidden="true">
        {format}
      </span>
    </a>
  );
}
