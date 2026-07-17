import {
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  CircleAlert,
  Landmark,
  Plus,
  ShieldCheck,
  Sparkles,
  WalletCards,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActionButton } from "../../shared/components/actions";
import { Field } from "../../shared/components/fields";
import { formatDate, todayIso } from "../../shared/format/dates";
import { money, signedMoney } from "../../shared/format/money";
import { useI18n } from "../../shared/i18n/I18nProvider";
import type {
  NetWorthAccountAnalytics,
  NetWorthHistory,
  NetWorthOverview,
} from "../../types";

const supportedRanges = [6, 12, 24, 60, 120] as const;

export type NetWorthRange = (typeof supportedRanges)[number];

type OverviewActions = {
  onCheckIn: () => void;
  onAdd: () => void;
};

export function WealthFirstUse({ onAdd }: { onAdd: () => void }) {
  const { t } = useI18n();
  return (
    <section className="wealth-onboarding" aria-labelledby="wealth-first-title">
      <div className="wealth-onboarding-copy">
        <p className="eyebrow">{t("netWorth.firstUse.eyebrow")}</p>
        <h2 id="wealth-first-title">{t("netWorth.firstUse.title")}</h2>
        <p>{t("netWorth.firstUse.message")}</p>
        <ActionButton icon={Plus} onClick={onAdd}>
          {t("netWorth.actions.addAccount")}
        </ActionButton>
      </div>
      <div className="wealth-onboarding-preview" aria-hidden="true">
        <div className="onboarding-preview-total">
          <span>{t("netWorth.total")}</span>
          <strong>—</strong>
          <Sparkles />
        </div>
        <div className="onboarding-preview-cards">
          <span>
            <Landmark />
            {t("netWorth.assets")}
          </span>
          <span>
            <WalletCards />
            {t("netWorth.liabilities")}
          </span>
        </div>
        <svg viewBox="0 0 440 150" preserveAspectRatio="none">
          <path d="M8 132 C 70 112, 102 124, 152 84 S 252 92, 298 52 S 374 46, 432 10" />
        </svg>
      </div>
    </section>
  );
}

export function WealthToolbar({
  asOf,
  months,
  pending,
  onDateChange,
  onRangeChange,
}: {
  asOf: string;
  months: number;
  pending: boolean;
  onDateChange: (value: string) => void;
  onRangeChange: (value: NetWorthRange) => void;
}) {
  const { t } = useI18n();
  return (
    <section className="wealth-toolbar" aria-label={t("netWorth.controls")}>
      <Field
        id="net-worth-as-of"
        label={t("netWorth.asOfLabel")}
        hint={t("netWorth.asOfHint")}
      >
        <input
          id="net-worth-as-of"
          name="as_of"
          type="date"
          max={todayIso()}
          value={asOf || todayIso()}
          onChange={(event) =>
            onDateChange(
              event.target.value === todayIso() ? "" : event.target.value,
            )
          }
        />
      </Field>
      <fieldset>
        <legend>{t("netWorth.rangeLabel")}</legend>
        <div className="net-worth-range-options">
          {supportedRanges.map((range) => (
            <label key={range}>
              <input
                type="radio"
                name="history-range"
                value={range}
                checked={months === range}
                onChange={() => onRangeChange(range)}
              />
              <span>{t("netWorth.months", { count: range })}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <span className="net-worth-pending" role="status">
        {pending ? t("netWorth.refreshing") : ""}
      </span>
    </section>
  );
}

export function WealthOverview({
  data,
  asOf,
  months,
  pending,
  onDateChange,
  onRangeChange,
  onCheckIn,
}: {
  data: NetWorthOverview;
  asOf: string;
  months: number;
  pending: boolean;
  onDateChange: (value: string) => void;
  onRangeChange: (value: NetWorthRange) => void;
} & OverviewActions) {
  const { t } = useI18n();
  const total = Number(data.summary.total_net_worth);
  const change =
    data.comparison.change_amount === null
      ? null
      : Number(data.comparison.change_amount);
  const coverage = activeCoverage(data);
  const coveragePercent = Math.min(
    100,
    Math.round((coverage.resolved / Math.max(coverage.total, 1)) * 100),
  );

  return (
    <>
      <WealthToolbar
        asOf={asOf}
        months={months}
        pending={pending}
        onDateChange={onDateChange}
        onRangeChange={onRangeChange}
      />

      <section
        className="wealth-scoreboard"
        aria-label={t("netWorth.scoreboard")}
      >
        <article
          className={`wealth-primary-metric ${
            total < 0 ? "is-negative" : total > 0 ? "is-positive" : "is-zero"
          }`}
        >
          <div className="metric-label">
            <span>{t("netWorth.total")}</span>
            <span>
              {t("netWorth.hero.asOf", {
                date: formatDate(data.summary.as_of),
              })}
            </span>
          </div>
          <strong>{signedMoney(data.summary.total_net_worth)}</strong>
          {data.comparison.available && change !== null ? (
            <p className={change < 0 ? "negative" : "positive"}>
              {change < 0 ? (
                <ArrowDownRight aria-hidden="true" />
              ) : (
                <ArrowUpRight aria-hidden="true" />
              )}
              <span>
                {signedMoney(data.comparison.change_amount ?? "0")}
                {data.comparison.change_percent === null
                  ? ""
                  : ` · ${Number(data.comparison.change_percent).toFixed(1)}%`}
              </span>
              <small>
                {t("netWorth.hero.since", {
                  date: formatDate(data.comparison.start_date),
                })}
              </small>
            </p>
          ) : (
            <p className="metric-comparison-unavailable">
              {t("netWorth.hero.comparisonUnavailable")}
            </p>
          )}
        </article>

        <article className="wealth-metric-card assets">
          <span>{t("netWorth.assets")}</span>
          <strong>{money(data.summary.total_assets)}</strong>
          <small>{t("netWorth.metrics.assetDetail")}</small>
        </article>
        <article className="wealth-metric-card liabilities">
          <span>{t("netWorth.liabilities")}</span>
          <strong>{money(data.summary.total_liabilities)}</strong>
          <small>{t("netWorth.metrics.liabilityDetail")}</small>
        </article>
        <article className="wealth-metric-card coverage">
          <span>{t("netWorth.metrics.coverage")}</span>
          <strong>{coveragePercent}%</strong>
          <progress max="100" value={coveragePercent}>
            {coveragePercent}%
          </progress>
          <small>
            {t("netWorth.metrics.coverageDetail", {
              resolved: coverage.resolved,
              total: coverage.total,
            })}
          </small>
        </article>
      </section>

      <div className="wealth-analysis-grid">
        <TrendExplorer history={data.history} />
        <aside
          className="wealth-insight-rail"
          aria-label={t("netWorth.insights")}
        >
          <MovementInsight data={data} />
          <DataHealthInsight data={data} onCheckIn={onCheckIn} />
        </aside>
      </div>
    </>
  );
}

function TrendExplorer({ history }: { history: NetWorthHistory }) {
  const { t } = useI18n();
  const [selected, setSelected] = useState(
    Math.max(0, history.points.length - 1),
  );
  const pointRefs = useRef<(SVGCircleElement | null)[]>([]);

  useEffect(() => {
    setSelected(Math.max(0, history.points.length - 1));
  }, [history]);

  const chart = useMemo(() => buildChart(history), [history]);
  const selectedPoint = history.points[selected];

  if (!selectedPoint) {
    return (
      <section
        className="wealth-trend-card"
        aria-labelledby="wealth-trend-title"
      >
        <h2 id="wealth-trend-title">{t("netWorth.history.title")}</h2>
        <p className="wealth-muted">{t("netWorth.history.noComparison")}</p>
      </section>
    );
  }

  function selectPoint(index: number, moveFocus = false) {
    const next = Math.max(0, Math.min(history.points.length - 1, index));
    setSelected(next);
    if (moveFocus) pointRefs.current[next]?.focus();
  }

  return (
    <section className="wealth-trend-card" aria-labelledby="wealth-trend-title">
      <header className="wealth-card-heading">
        <div>
          <p className="eyebrow">{t("netWorth.history.eyebrow")}</p>
          <h2 id="wealth-trend-title">{t("netWorth.history.title")}</h2>
        </div>
        <div className="trend-selection" aria-live="polite">
          <span>{formatDate(selectedPoint.as_of)}</span>
          <strong>{signedMoney(selectedPoint.total_net_worth)}</strong>
        </div>
      </header>
      <figure className="wealth-chart">
        <svg
          viewBox={`0 0 ${chart.width} ${chart.height}`}
          role="img"
          aria-labelledby="net-worth-chart-title net-worth-chart-desc"
        >
          <title id="net-worth-chart-title">
            {t("netWorth.history.chartTitle")}
          </title>
          <desc id="net-worth-chart-desc">
            {t("netWorth.history.chartDesc")}
          </desc>
          <defs>
            <linearGradient id="net-worth-area" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.2" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>
          {chart.yTicks.map((tick) => (
            <g className="chart-grid-line" key={tick.value}>
              <line
                x1={chart.plotLeft}
                x2={chart.plotRight}
                y1={tick.y}
                y2={tick.y}
              />
              <text x={chart.plotLeft - 12} y={tick.y + 4}>
                {compactMoney(tick.value)}
              </text>
            </g>
          ))}
          {chart.zeroY !== null ? (
            <line
              className="net-worth-zero-line"
              x1={chart.plotLeft}
              x2={chart.plotRight}
              y1={chart.zeroY}
              y2={chart.zeroY}
            />
          ) : null}
          <path className="net-worth-area" d={chart.areaPath} />
          <path className="net-worth-line" d={chart.linePath} />
          <line
            className="chart-selection-line"
            x1={chart.points[selected].x}
            x2={chart.points[selected].x}
            y1={chart.plotTop}
            y2={chart.plotBottom}
          />
          {chart.points.map((point, index) => (
            <circle
              key={point.data.as_of}
              ref={(node) => {
                pointRefs.current[index] = node;
              }}
              className={selected === index ? "is-selected" : ""}
              cx={point.x}
              cy={point.y}
              r={selected === index ? 7 : 4.5}
              tabIndex={0}
              role="button"
              aria-label={t("netWorth.history.pointLabel", {
                date: formatDate(point.data.as_of),
                amount: money(point.data.total_net_worth),
              })}
              onFocus={() => setSelected(index)}
              onPointerEnter={() => setSelected(index)}
              onPointerDown={() => setSelected(index)}
              onKeyDown={(event) => {
                if (event.key === "ArrowLeft") {
                  event.preventDefault();
                  selectPoint(index - 1, true);
                }
                if (event.key === "ArrowRight") {
                  event.preventDefault();
                  selectPoint(index + 1, true);
                }
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  selectPoint(index);
                }
              }}
            />
          ))}
          {chart.xLabels.map((label) => (
            <text
              className="chart-date-label"
              key={`${label.text}-${label.x}`}
              x={label.x}
              y={chart.height - 10}
              textAnchor={label.anchor}
            >
              {label.text}
            </text>
          ))}
        </svg>
        <figcaption className="sr-only">
          {t("netWorth.history.selected", {
            date: formatDate(selectedPoint.as_of),
            amount: money(selectedPoint.total_net_worth),
          })}
        </figcaption>
      </figure>
      <details className="wealth-chart-table">
        <summary>{t("netWorth.history.tableToggle")}</summary>
        <div className="table-scroll">
          <table>
            <caption>{t("netWorth.history.tableCaption")}</caption>
            <thead>
              <tr>
                <th scope="col">{t("common.date")}</th>
                <th scope="col">{t("netWorth.assets")}</th>
                <th scope="col">{t("netWorth.liabilities")}</th>
                <th scope="col">{t("netWorth.total")}</th>
              </tr>
            </thead>
            <tbody>
              {history.points.map((point) => (
                <tr key={point.as_of}>
                  <th scope="row">{formatDate(point.as_of)}</th>
                  <td>{money(point.total_assets)}</td>
                  <td>{money(point.total_liabilities)}</td>
                  <td>{signedMoney(point.total_net_worth)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}

function MovementInsight({ data }: { data: NetWorthOverview }) {
  const { t } = useI18n();
  const accounts = [...data.accounts]
    .filter((account) => account.contribution_change !== null)
    .sort(
      (a, b) =>
        Math.abs(Number(b.contribution_change)) -
        Math.abs(Number(a.contribution_change)),
    )
    .slice(0, 3);

  return (
    <section className="wealth-insight-card" aria-labelledby="movement-title">
      <header className="wealth-card-heading">
        <div>
          <p className="eyebrow">{t("netWorth.movement.eyebrow")}</p>
          <h2 id="movement-title">{t("netWorth.movement.title")}</h2>
        </div>
      </header>
      <p className="insight-detail">
        {t("netWorth.movement.detail", {
          date: formatDate(data.comparison.start_date),
        })}
      </p>
      {accounts.length ? (
        <ol className="movement-list">
          {accounts.map((account) => {
            const change = Number(account.contribution_change);
            return (
              <li key={account.account_id}>
                <span className="movement-rank" aria-hidden="true">
                  {accounts.indexOf(account) + 1}
                </span>
                <div>
                  <strong>{account.name}</strong>
                  <span>{t(`netWorth.account.${account.type}`)}</span>
                </div>
                <span className={change < 0 ? "negative" : "positive"}>
                  {change < 0 ? (
                    <ArrowDownRight aria-hidden="true" />
                  ) : (
                    <ArrowUpRight aria-hidden="true" />
                  )}
                  {signedMoney(account.contribution_change ?? "0")}
                </span>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="wealth-muted">{t("netWorth.movement.unavailable")}</p>
      )}
    </section>
  );
}

function DataHealthInsight({
  data,
  onCheckIn,
}: {
  data: NetWorthOverview;
  onCheckIn: () => void;
}) {
  const { t } = useI18n();
  const coverage = activeCoverage(data);
  const unresolved = coverage.accounts.filter(
    (account) => account.current_balance === null,
  );
  const complete = unresolved.length === 0;

  return (
    <section
      className={`wealth-insight-card data-health ${complete ? "is-complete" : "needs-attention"}`}
      aria-labelledby="data-health-title"
    >
      <header className="data-health-heading">
        <span className="health-icon">
          {complete ? (
            <ShieldCheck aria-hidden="true" />
          ) : (
            <CircleAlert aria-hidden="true" />
          )}
        </span>
        <div>
          <p className="eyebrow">{t("netWorth.coveragePanel.eyebrow")}</p>
          <h2 id="data-health-title">
            {complete
              ? t("netWorth.health.completeTitle")
              : t("netWorth.health.attentionTitle")}
          </h2>
        </div>
      </header>
      <p>
        {complete
          ? t("netWorth.coverageComplete")
          : t("netWorth.coverage", { count: unresolved.length })}
      </p>
      <dl className="health-facts">
        <div>
          <dt>{t("netWorth.coveragePanel.resolved")}</dt>
          <dd>
            {coverage.resolved}/{coverage.total}
          </dd>
        </div>
        <div>
          <dt>{t("netWorth.coveragePanel.oldest")}</dt>
          <dd>
            {coverage.oldest
              ? formatDate(coverage.oldest)
              : t("netWorth.account.unresolved")}
          </dd>
        </div>
      </dl>
      {unresolved.length ? (
        <ul className="unresolved-account-list">
          {unresolved.slice(0, 3).map((account) => (
            <li key={account.account_id}>
              <CircleAlert aria-hidden="true" />
              <span>{account.name}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="health-confirmation">
          <CheckCircle2 aria-hidden="true" />
          {t("netWorth.health.ready")}
        </p>
      )}
      <ActionButton icon={WalletCards} variant="secondary" onClick={onCheckIn}>
        {t("netWorth.actions.updateBalances")}
      </ActionButton>
    </section>
  );
}

export function PortfolioWorkspace({
  data,
  includeArchived,
  onIncludeArchived,
  onUpdate,
  onManage,
}: {
  data: NetWorthOverview;
  includeArchived: boolean;
  onIncludeArchived: (value: boolean) => void;
  onUpdate: (account: NetWorthAccountAnalytics) => void;
  onManage: (account: NetWorthAccountAnalytics) => void;
}) {
  const { t } = useI18n();
  const [filter, setFilter] = useState<"all" | "asset" | "liability">("all");
  const accounts = data.accounts.filter(
    (account) => filter === "all" || account.type === filter,
  );

  return (
    <section className="portfolio-workspace" aria-labelledby="portfolio-title">
      <header className="wealth-card-heading portfolio-heading">
        <div>
          <p className="eyebrow">{t("netWorth.accounts.eyebrow")}</p>
          <h2 id="portfolio-title">{t("netWorth.accounts.title")}</h2>
          <p>{t("netWorth.accounts.detail")}</p>
        </div>
        <div className="portfolio-controls">
          <div
            className="portfolio-filter"
            role="group"
            aria-label={t("netWorth.accounts.filter")}
          >
            {(["all", "asset", "liability"] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={filter === option}
                onClick={() => setFilter(option)}
              >
                {t(`netWorth.accounts.${option}`)}
              </button>
            ))}
          </div>
          {data.summary.archived_account_count > 0 ? (
            <label className="archived-toggle">
              <input
                type="checkbox"
                checked={includeArchived}
                onChange={(event) => onIncludeArchived(event.target.checked)}
              />
              <span>{t("netWorth.actions.showArchived")}</span>
            </label>
          ) : null}
        </div>
      </header>
      <ul className="portfolio-list">
        {accounts.map((account) => (
          <PortfolioRow
            key={account.account_id}
            account={account}
            onUpdate={onUpdate}
            onManage={onManage}
          />
        ))}
      </ul>
      {!accounts.length ? (
        <p className="portfolio-empty">{t("netWorth.account.none")}</p>
      ) : null}
    </section>
  );
}

function PortfolioRow({
  account,
  onUpdate,
  onManage,
}: {
  account: NetWorthAccountAnalytics;
  onUpdate: (account: NetWorthAccountAnalytics) => void;
  onManage: (account: NetWorthAccountAnalytics) => void;
}) {
  const { t } = useI18n();
  const change =
    account.contribution_change === null
      ? null
      : Number(account.contribution_change);
  const share = Math.max(
    0,
    Math.min(100, Number(account.composition_percent ?? 0)),
  );

  return (
    <li className={account.archived_on ? "is-archived" : ""}>
      <div className={`portfolio-account-icon ${account.type}`}>
        {account.type === "asset" ? (
          <Landmark aria-hidden="true" />
        ) : (
          <WalletCards aria-hidden="true" />
        )}
      </div>
      <div className="portfolio-account-name">
        <strong>{account.name}</strong>
        <span>
          {account.archived_on
            ? t("netWorth.account.archived", {
                date: formatDate(account.archived_on),
              })
            : account.current_balance_date
              ? t("netWorth.account.balanceDate", {
                  date: formatDate(account.current_balance_date),
                })
              : t("netWorth.account.noEarlierBalance")}
        </span>
      </div>
      <div className="portfolio-account-share">
        <span>
          {t("netWorth.accounts.share", {
            percent: account.composition_percent ?? "0",
          })}
        </span>
        <div className={`composition-track ${account.type}`} aria-hidden="true">
          <span style={{ inlineSize: `${share}%` }} />
        </div>
      </div>
      <div className="portfolio-account-change">
        <span>{t("netWorth.accounts.periodChange")}</span>
        <strong
          className={
            change === null ? "" : change < 0 ? "negative" : "positive"
          }
        >
          {change === null
            ? t("netWorth.account.unresolved")
            : signedMoney(account.contribution_change ?? "0")}
        </strong>
      </div>
      <strong className="portfolio-account-balance">
        {account.current_balance === null
          ? t("netWorth.account.unresolved")
          : money(account.current_balance)}
      </strong>
      <div className="portfolio-account-actions">
        {!account.archived_on ? (
          <button
            className="button secondary"
            type="button"
            onClick={() => onUpdate(account)}
          >
            <WalletCards aria-hidden="true" size={17} />
            {t("netWorth.actions.updateBalance")}
          </button>
        ) : null}
        <button
          className="button ghost"
          type="button"
          onClick={() => onManage(account)}
        >
          {t("netWorth.actions.manage")}
        </button>
      </div>
    </li>
  );
}

function buildChart(history: NetWorthHistory) {
  const width = 820;
  const height = 350;
  const plotLeft = 76;
  const plotRight = width - 24;
  const plotTop = 22;
  const plotBottom = height - 42;
  const rawValues = history.points.map((point) =>
    Number(point.total_net_worth),
  );
  const rawMin = Math.min(0, ...rawValues);
  const rawMax = Math.max(0, ...rawValues);
  const rawSpan = rawMax - rawMin || Math.max(Math.abs(rawMax), 1);
  const padding = rawSpan * 0.12;
  const min = rawMin - padding;
  const max = rawMax + padding;
  const span = max - min;
  const x = (index: number) =>
    history.points.length === 1
      ? (plotLeft + plotRight) / 2
      : plotLeft +
        (index / (history.points.length - 1)) * (plotRight - plotLeft);
  const y = (value: number) =>
    plotTop + ((max - value) / span) * (plotBottom - plotTop);
  const points = history.points.map((data, index) => ({
    data,
    x: x(index),
    y: y(Number(data.total_net_worth)),
  }));
  const linePath = points
    .map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`)
    .join(" ");
  const areaPath = points.length
    ? `${linePath} L ${points.at(-1)?.x ?? plotRight} ${plotBottom} L ${
        points[0].x
      } ${plotBottom} Z`
    : "";
  const yTicks = Array.from({ length: 5 }, (_, index) => {
    const value = max - (span / 4) * index;
    return { value, y: y(value) };
  });
  const labelIndexes = Array.from(
    new Set([
      0,
      Math.floor((history.points.length - 1) / 2),
      history.points.length - 1,
    ]),
  ).filter((index) => index >= 0);
  const xLabels = labelIndexes.map((index) => ({
    text: formatShortDate(history.points[index].as_of),
    x: x(index),
    anchor:
      index === 0
        ? ("start" as const)
        : index === history.points.length - 1
          ? ("end" as const)
          : ("middle" as const),
  }));

  return {
    width,
    height,
    plotLeft,
    plotRight,
    plotTop,
    plotBottom,
    points,
    linePath,
    areaPath,
    yTicks,
    xLabels,
    zeroY: min < 0 && max > 0 ? y(0) : null,
  };
}

function compactMoney(value: number) {
  return new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function activeCoverage(data: NetWorthOverview) {
  const accounts = data.accounts.filter((account) => !account.archived_on);
  const knownDates = accounts
    .map((account) => account.current_balance_date)
    .filter((value): value is string => value !== null)
    .sort();
  return {
    accounts,
    total: accounts.length,
    resolved: accounts.filter((account) => account.current_balance !== null)
      .length,
    oldest: knownDates[0] ?? null,
  };
}

export function isSupportedNetWorthRange(
  value: number,
): value is NetWorthRange {
  return supportedRanges.includes(value as NetWorthRange);
}
