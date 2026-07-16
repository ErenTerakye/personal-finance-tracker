import {
  Archive,
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  History,
  Landmark,
  Pencil,
  Plus,
  Save,
  Trash2,
  WalletCards,
} from "lucide-react";
import "./net-worth.css";
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { api } from "../../api/client";
import { ActionButton, SubmitButton } from "../../shared/components/actions";
import { ModalDialog } from "../../shared/components/dialogs";
import { EmptyState, ErrorBanner } from "../../shared/components/feedback";
import { Field } from "../../shared/components/fields";
import { Panel } from "../../shared/components/lists";
import { formatDate, todayIso } from "../../shared/format/dates";
import { money, signedMoney } from "../../shared/format/money";
import { useMutation } from "../../shared/hooks/useMutation";
import { useResource } from "../../shared/hooks/useResource";
import { useI18n } from "../../shared/i18n/I18nProvider";
import { localizedNotice } from "../../shared/i18n/notices";
import type {
  AccountInput,
  AccountRecord,
  BalanceSnapshot,
  NetWorthAccountAnalytics,
  NetWorthHistory,
  NetWorthOverview,
} from "../../types";
import { useNetWorthData } from "./useNetWorthData";

type DialogState =
  | { kind: "add" }
  | { kind: "checkIn" }
  | { kind: "inspector"; account: AccountRecord }
  | { kind: "balance"; account: AccountRecord; snapshot?: BalanceSnapshot }
  | { kind: "edit"; account: AccountRecord }
  | { kind: "archive"; account: AccountRecord }
  | { kind: "history"; account: AccountRecord }
  | null;

const supportedRanges = [6, 12, 24, 60, 120] as const;

export function NetWorthView({
  setNotice,
  createRequestId,
  onAccountAvailabilityChange,
}: {
  setNotice: (notice: string) => void;
  createRequestId: number;
  onAccountAvailabilityChange: (hasAccounts: boolean) => void;
}) {
  const { t } = useI18n();
  const initial = useMemo(() => readUrlState(), []);
  const [asOf, setAsOf] = useState(initial.asOf);
  const [months, setMonths] = useState(initial.months);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [refreshKey, refresh] = useReducer((value: number) => value + 1, 0);
  const resource = useNetWorthData(asOf, months, includeArchived, refreshKey);
  const handledCreateRequest = useRef(0);

  useEffect(() => {
    if (
      createRequestId > handledCreateRequest.current &&
      resource.data !== undefined
    ) {
      handledCreateRequest.current = createRequestId;
      setDialog(
        resource.data.summary.active_account_count > 0
          ? { kind: "checkIn" }
          : { kind: "add" },
      );
    }
  }, [createRequestId, resource.data]);

  useEffect(() => {
    onAccountAvailabilityChange(
      Boolean(resource.data?.summary?.active_account_count),
    );
  }, [
    onAccountAvailabilityChange,
    resource.data?.summary?.active_account_count,
  ]);

  function updateUrl(nextAsOf: string, nextMonths: number) {
    const url = new URL(window.location.href);
    if (nextAsOf) url.searchParams.set("as_of", nextAsOf);
    else url.searchParams.delete("as_of");
    if (nextMonths === 12) url.searchParams.delete("months");
    else url.searchParams.set("months", String(nextMonths));
    window.history.replaceState({}, "", `${url.pathname}${url.search}`);
  }

  function changed(response: { notice: string; notice_code?: string }) {
    setNotice(localizedNotice(response, t));
    setDialog(null);
    refresh();
  }

  const data = resource.data;
  if (resource.status === "error" && !data) {
    return (
      <ErrorBanner
        message={resource.error.message}
        onRetry={resource.refetch}
      />
    );
  }
  if (!data) {
    return (
      <Panel title={t("netWorth.loading")} detail={t("netWorth.loadingDetail")}>
        <p className="loading-state">{t("netWorth.loadingDetail")}</p>
      </Panel>
    );
  }

  const accountCount =
    data.summary.active_account_count + data.summary.archived_account_count;
  const resolvedCount = data.coverage.resolved_account_count;
  const activeAccounts = data.accounts.filter(
    (account) => !account.archived_on,
  );
  const pending = resource.status === "loading";

  return (
    <div
      className={`net-worth-view${pending ? " is-refreshing" : ""}`}
      aria-busy={pending}
    >
      {resource.status === "error" ? (
        <ErrorBanner
          message={resource.error.message}
          onRetry={resource.refetch}
        />
      ) : null}
      {accountCount === 0 ? (
        <FirstUse onAdd={() => setDialog({ kind: "add" })} />
      ) : resolvedCount === 0 ? (
        <>
          <WealthToolbar
            asOf={asOf}
            months={months}
            pending={pending}
            onDateChange={(next) => {
              setAsOf(next);
              updateUrl(next, months);
            }}
            onRangeChange={(next) => {
              setMonths(next);
              updateUrl(asOf, next);
            }}
          />
          <EmptyState
            icon={CalendarDays}
            title={t("netWorth.unresolvedAll.title")}
            message={t("netWorth.unresolvedAll.message", {
              date: formatDate(data.summary.as_of),
            })}
            action={
              <ActionButton
                icon={WalletCards}
                onClick={() => setDialog({ kind: "checkIn" })}
              >
                {t("netWorth.actions.updateBalances")}
              </ActionButton>
            }
          />
        </>
      ) : (
        <WealthHero
          data={data}
          asOf={asOf}
          months={months}
          pending={pending}
          onDateChange={(next) => {
            setAsOf(next);
            updateUrl(next, months);
          }}
          onRangeChange={(next) => {
            setMonths(next);
            updateUrl(asOf, next);
          }}
          onCheckIn={() => setDialog({ kind: "checkIn" })}
          onAdd={() => setDialog({ kind: "add" })}
        />
      )}

      {resolvedCount > 0 ? (
        <>
          <div className="wealth-insight-grid">
            <MovementSection data={data} />
            <CompositionSection data={data} />
          </div>
          <CoverageSection data={data} />
        </>
      ) : null}

      {accountCount > 0 ? (
        <AccountsSection
          data={data}
          includeArchived={includeArchived}
          onIncludeArchived={setIncludeArchived}
          onUpdate={(account) =>
            setDialog({
              kind: "balance",
              account: toAccountRecord(account, data),
            })
          }
          onManage={(account) =>
            setDialog({
              kind: "inspector",
              account: toAccountRecord(account, data),
            })
          }
        />
      ) : null}

      {dialog?.kind === "add" ? (
        <AddAccountDialog
          open
          onClose={() => setDialog(null)}
          onChanged={changed}
        />
      ) : null}
      {dialog?.kind === "checkIn" ? (
        <BalanceCheckInDialog
          open
          accounts={activeAccounts}
          onClose={() => setDialog(null)}
          onChanged={changed}
        />
      ) : null}
      {dialog?.kind === "inspector" ? (
        <AccountInspectorDialog
          open
          account={dialog.account}
          onClose={() => setDialog(null)}
          onAction={setDialog}
        />
      ) : null}
      {dialog?.kind === "balance" ? (
        <BalanceDialog
          open
          account={dialog.account}
          snapshot={dialog.snapshot}
          onClose={() => setDialog(null)}
          onChanged={changed}
        />
      ) : null}
      {dialog?.kind === "edit" ? (
        <EditAccountDialog
          open
          account={dialog.account}
          onClose={() => setDialog(null)}
          onChanged={changed}
        />
      ) : null}
      {dialog?.kind === "archive" ? (
        <ArchiveDialog
          open
          account={dialog.account}
          onClose={() => setDialog(null)}
          onChanged={changed}
        />
      ) : null}
      {dialog?.kind === "history" ? (
        <SnapshotHistoryDialog
          open
          account={dialog.account}
          onClose={() => setDialog(null)}
          onChanged={changed}
          onEditSnapshot={(snapshot) =>
            setDialog({ kind: "balance", account: dialog.account, snapshot })
          }
        />
      ) : null}
    </div>
  );
}

function FirstUse({ onAdd }: { onAdd: () => void }) {
  const { t, tUpper } = useI18n();
  return (
    <section className="wealth-first-use" aria-labelledby="page-title">
      <div>
        <p className="eyebrow">{tUpper("netWorth.firstUse.eyebrow")}</p>
        <h1 id="page-title">{t("netWorth.title")}</h1>
        <h2>{t("netWorth.firstUse.title")}</h2>
        <p>{t("netWorth.firstUse.message")}</p>
        <ActionButton icon={Plus} onClick={onAdd}>
          {t("netWorth.actions.addAccount")}
        </ActionButton>
      </div>
      <Landmark aria-hidden="true" />
    </section>
  );
}

function WealthToolbar({
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
  onRangeChange: (value: number) => void;
}) {
  const { t } = useI18n();
  return (
    <section className="wealth-toolbar" aria-label={t("netWorth.controls")}>
      <Field id="net-worth-as-of" label={t("netWorth.asOfLabel")}>
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

function WealthHero({
  data,
  asOf,
  months,
  pending,
  onDateChange,
  onRangeChange,
  onCheckIn,
  onAdd,
}: {
  data: NetWorthOverview;
  asOf: string;
  months: number;
  pending: boolean;
  onDateChange: (value: string) => void;
  onRangeChange: (value: number) => void;
  onCheckIn: () => void;
  onAdd: () => void;
}) {
  const { t, tUpper } = useI18n();
  const total = Number(data.summary.total_net_worth);
  const change =
    data.comparison.change_amount === null
      ? null
      : Number(data.comparison.change_amount);
  return (
    <section
      className={`wealth-hero ${total < 0 ? "is-negative" : total > 0 ? "is-positive" : "is-zero"}`}
      aria-labelledby="page-title"
    >
      <WealthToolbar
        asOf={asOf}
        months={months}
        pending={pending}
        onDateChange={onDateChange}
        onRangeChange={onRangeChange}
      />
      <div className="wealth-hero-grid">
        <header className="wealth-position">
          <p className="eyebrow">{tUpper("netWorth.eyebrow")}</p>
          <h1 id="page-title">{t("netWorth.title")}</h1>
          <p className="wealth-as-of">
            {t("netWorth.hero.asOf", {
              date: formatDate(data.summary.as_of),
            })}
          </p>
          <strong className="wealth-total">
            {signedMoney(data.summary.total_net_worth)}
          </strong>
          {data.comparison.available && change !== null ? (
            <p
              className={`wealth-change ${change < 0 ? "negative" : "positive"}`}
            >
              {change < 0 ? (
                <ArrowDownRight aria-hidden="true" />
              ) : (
                <ArrowUpRight aria-hidden="true" />
              )}
              <span>
                {signedMoney(change)}
                {data.comparison.change_percent !== null
                  ? ` · ${Number(data.comparison.change_percent).toFixed(1)}%`
                  : ""}
              </span>
              <small>
                {t("netWorth.hero.since", {
                  date: formatDate(data.comparison.start_date),
                })}
              </small>
            </p>
          ) : (
            <p className="wealth-change is-unavailable">
              <small>{t("netWorth.hero.comparisonUnavailable")}</small>
            </p>
          )}
          <dl className="wealth-equation">
            <div>
              <dt>{t("netWorth.assets")}</dt>
              <dd>{money(data.summary.total_assets)}</dd>
            </div>
            <span aria-hidden="true">−</span>
            <div>
              <dt>{t("netWorth.liabilities")}</dt>
              <dd>{money(data.summary.total_liabilities)}</dd>
            </div>
            <span aria-hidden="true">=</span>
            <div>
              <dt>{t("netWorth.total")}</dt>
              <dd>{signedMoney(data.summary.total_net_worth)}</dd>
            </div>
          </dl>
          <div className="wealth-actions">
            <ActionButton icon={WalletCards} onClick={onCheckIn}>
              {t("netWorth.actions.updateBalances")}
            </ActionButton>
            <ActionButton icon={Plus} variant="secondary" onClick={onAdd}>
              {t("netWorth.actions.addAccount")}
            </ActionButton>
          </div>
        </header>
        <NetWorthHistoryChart history={data.history} />
      </div>
    </section>
  );
}

function NetWorthHistoryChart({ history }: { history: NetWorthHistory }) {
  const { t } = useI18n();
  const [selected, setSelected] = useState(history.points.length - 1);
  useEffect(() => setSelected(history.points.length - 1), [history]);
  const values = history.points.map((point) => Number(point.total_net_worth));
  const minValue = Math.min(0, ...values);
  const maxValue = Math.max(0, ...values);
  const span = maxValue - minValue || Math.max(Math.abs(maxValue), 1);
  const width = 640;
  const height = 240;
  const padding = 28;
  const x = (index: number) =>
    history.points.length === 1
      ? width / 2
      : padding + (index / (history.points.length - 1)) * (width - padding * 2);
  const y = (value: number) =>
    padding + ((maxValue - value) / span) * (height - padding * 2);
  const path = history.points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"} ${x(index)} ${y(Number(point.total_net_worth))}`,
    )
    .join(" ");
  const selectedPoint = history.points[selected];
  return (
    <figure className="wealth-history">
      <div className="wealth-chart-heading">
        <h2>{t("netWorth.history.title")}</h2>
        <figcaption>
          {t("netWorth.history.selected", {
            date: formatDate(selectedPoint.as_of),
            amount: money(selectedPoint.total_net_worth),
          })}
        </figcaption>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-labelledby="net-worth-chart-title net-worth-chart-desc"
      >
        <title id="net-worth-chart-title">
          {t("netWorth.history.chartTitle")}
        </title>
        <desc id="net-worth-chart-desc">{t("netWorth.history.chartDesc")}</desc>
        {minValue < 0 && maxValue > 0 ? (
          <line
            className="net-worth-zero-line"
            x1={padding}
            x2={width - padding}
            y1={y(0)}
            y2={y(0)}
          />
        ) : null}
        <path className="net-worth-line" d={path} />
        {history.points.map((point, index) => (
          <circle
            key={point.as_of}
            className={selected === index ? "is-selected" : ""}
            cx={x(index)}
            cy={y(Number(point.total_net_worth))}
            r={selected === index ? 7 : 5}
            tabIndex={0}
            role="button"
            aria-label={t("netWorth.history.pointLabel", {
              date: formatDate(point.as_of),
              amount: money(point.total_net_worth),
            })}
            onFocus={() => setSelected(index)}
            onPointerDown={() => setSelected(index)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setSelected(index);
              }
            }}
          />
        ))}
      </svg>
      <details>
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
    </figure>
  );
}

function MovementSection({ data }: { data: NetWorthOverview }) {
  const { t } = useI18n();
  const known = data.accounts.filter(
    (account) => account.contribution_change !== null,
  );
  return (
    <section className="wealth-panel" aria-labelledby="wealth-movement-title">
      <header className="wealth-section-heading">
        <div>
          <p className="eyebrow">{t("netWorth.movement.eyebrow")}</p>
          <h2 id="wealth-movement-title">{t("netWorth.movement.title")}</h2>
        </div>
        <p>
          {t("netWorth.movement.detail", {
            date: formatDate(data.comparison.start_date),
          })}
        </p>
      </header>
      {known.length ? (
        <ol className="movement-list">
          {known.map((account) => {
            const change = Number(account.contribution_change);
            return (
              <li key={account.account_id}>
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

function CompositionSection({ data }: { data: NetWorthOverview }) {
  const { t } = useI18n();
  return (
    <section
      className="wealth-panel"
      aria-labelledby="wealth-composition-title"
    >
      <header className="wealth-section-heading">
        <div>
          <p className="eyebrow">{t("netWorth.composition.eyebrow")}</p>
          <h2 id="wealth-composition-title">
            {t("netWorth.composition.title")}
          </h2>
        </div>
        <p>{t("netWorth.composition.detail")}</p>
      </header>
      <div className="composition-groups">
        {(["asset", "liability"] as const).map((type) => {
          const accounts = data.accounts.filter(
            (account) =>
              account.type === type && account.current_balance !== null,
          );
          return (
            <section key={type}>
              <h3>
                {t(
                  type === "asset" ? "netWorth.assets" : "netWorth.liabilities",
                )}
              </h3>
              {accounts.length ? (
                <ul className="composition-list">
                  {accounts.map((account) => (
                    <li key={account.account_id}>
                      <div>
                        <strong>{account.name}</strong>
                        <span>{money(account.current_balance ?? "0")}</span>
                      </div>
                      <div
                        className="composition-track"
                        aria-label={t("netWorth.composition.share", {
                          name: account.name,
                          percent: account.composition_percent ?? "0",
                        })}
                      >
                        <span
                          style={{
                            inlineSize: `${Math.max(
                              0,
                              Math.min(
                                100,
                                Number(account.composition_percent ?? 0),
                              ),
                            )}%`,
                          }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="wealth-muted">{t("netWorth.account.none")}</p>
              )}
            </section>
          );
        })}
      </div>
    </section>
  );
}

function CoverageSection({ data }: { data: NetWorthOverview }) {
  const { t } = useI18n();
  const unresolved = data.accounts.filter(
    (account) => account.current_balance === null,
  );
  const dated = data.accounts
    .filter((account) => account.current_balance_date !== null)
    .sort((a, b) =>
      (a.current_balance_date ?? "").localeCompare(
        b.current_balance_date ?? "",
      ),
    );
  return (
    <section
      className="wealth-panel coverage-panel"
      aria-labelledby="coverage-title"
    >
      <header className="wealth-section-heading">
        <div>
          <p className="eyebrow">{t("netWorth.coveragePanel.eyebrow")}</p>
          <h2 id="coverage-title">{t("netWorth.coveragePanel.title")}</h2>
        </div>
        <p>
          {unresolved.length
            ? t("netWorth.coverage", { count: unresolved.length })
            : t("netWorth.coverageComplete")}
        </p>
      </header>
      <div className="coverage-summary">
        <div>
          {unresolved.length ? (
            <CircleAlert aria-hidden="true" />
          ) : (
            <CheckCircle2 aria-hidden="true" />
          )}
          <span>{t("netWorth.coveragePanel.resolved")}</span>
          <strong>
            {data.coverage.resolved_account_count}/
            {data.summary.active_account_count}
          </strong>
        </div>
        <div>
          <CalendarDays aria-hidden="true" />
          <span>{t("netWorth.coveragePanel.oldest")}</span>
          <strong>
            {data.coverage.oldest_balance_date
              ? formatDate(data.coverage.oldest_balance_date)
              : t("netWorth.account.unresolved")}
          </strong>
        </div>
      </div>
      <ul className="balance-date-list">
        {unresolved.map((account) => (
          <li key={account.account_id} className="is-unresolved">
            <strong>{account.name}</strong>
            <span>{t("netWorth.account.noEarlierBalance")}</span>
          </li>
        ))}
        {dated.map((account) => (
          <li key={account.account_id}>
            <strong>{account.name}</strong>
            <span>
              {t("netWorth.account.balanceDate", {
                date: formatDate(account.current_balance_date ?? ""),
              })}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function AccountsSection({
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
  return (
    <section
      className="wealth-panel accounts-workspace"
      aria-labelledby="accounts-title"
    >
      <header className="wealth-section-heading">
        <div>
          <p className="eyebrow">{t("netWorth.accounts.eyebrow")}</p>
          <h2 id="accounts-title">{t("netWorth.accounts.title")}</h2>
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
      </header>
      <div className="account-groups">
        {(["asset", "liability"] as const).map((type) => (
          <section key={type}>
            <h3>
              {t(type === "asset" ? "netWorth.assets" : "netWorth.liabilities")}
            </h3>
            <ul className="wealth-account-list">
              {data.accounts
                .filter((account) => account.type === type)
                .map((account) => (
                  <li
                    key={account.account_id}
                    className={account.archived_on ? "is-archived" : ""}
                  >
                    <div>
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
                    <strong>
                      {account.current_balance === null
                        ? t("netWorth.account.unresolved")
                        : money(account.current_balance)}
                    </strong>
                    <div className="account-actions">
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
                        <ChevronRight aria-hidden="true" size={17} />
                      </button>
                    </div>
                  </li>
                ))}
            </ul>
          </section>
        ))}
      </div>
    </section>
  );
}

function BalanceCheckInDialog({
  open,
  accounts,
  onClose,
  onChanged,
}: DialogProps & { accounts: NetWorthAccountAnalytics[] }) {
  const { t } = useI18n();
  const [effectiveDate, setEffectiveDate] = useState(todayIso());
  const [amounts, setAmounts] = useState<Record<number, string>>({});
  const mutation = useMutation(
    (payload: {
      effectiveDate: string;
      updates: { account_id: number; amount: string }[];
    }) => api.checkInBalances(payload.effectiveDate, payload.updates),
    { onSuccess: onChanged },
  );
  const updates = accounts
    .filter((account) => (amounts[account.account_id] ?? "").trim() !== "")
    .map((account) => ({
      account_id: account.account_id,
      amount: amounts[account.account_id].trim(),
    }));
  return (
    <ModalDialog
      open={open}
      title={t("netWorth.checkIn.title")}
      description={t("netWorth.checkIn.description")}
      onClose={onClose}
      initialFocusId="balance-check-in-date"
      className="balance-check-in-dialog"
    >
      {mutation.status === "error" ? (
        <ErrorBanner message={mutation.error.message} />
      ) : null}
      <form
        className="net-worth-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (updates.length) {
            void mutation.mutate({ effectiveDate, updates });
          }
        }}
      >
        <Field
          id="balance-check-in-date"
          label={t("netWorth.form.effectiveDate")}
          hint={t("netWorth.form.replaceHint")}
        >
          <input
            id="balance-check-in-date"
            type="date"
            max={todayIso()}
            value={effectiveDate}
            onChange={(event) => setEffectiveDate(event.target.value)}
            required
          />
        </Field>
        <ul className="check-in-list">
          {accounts.map((account) => {
            const id = `check-in-${account.account_id}`;
            return (
              <li key={account.account_id}>
                <label htmlFor={id}>
                  <strong>{account.name}</strong>
                  <span>
                    {account.current_balance === null
                      ? t("netWorth.account.unresolved")
                      : t("netWorth.checkIn.current", {
                          amount: money(account.current_balance),
                          date: formatDate(account.current_balance_date ?? ""),
                        })}
                  </span>
                </label>
                <input
                  id={id}
                  inputMode="decimal"
                  type="number"
                  min="0"
                  step="0.01"
                  value={amounts[account.account_id] ?? ""}
                  onChange={(event) =>
                    setAmounts((current) => ({
                      ...current,
                      [account.account_id]: event.target.value,
                    }))
                  }
                  aria-describedby={
                    account.type === "liability"
                      ? "check-in-liability-hint"
                      : undefined
                  }
                />
              </li>
            );
          })}
        </ul>
        <p id="check-in-liability-hint" className="form-hint">
          {t("netWorth.form.liabilityHint")}
        </p>
        <footer className="dialog-actions">
          <button className="button secondary" type="button" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <SubmitButton
            busy={mutation.status === "pending"}
            icon={Save}
            disabled={!updates.length}
          >
            {t("netWorth.checkIn.save", { count: updates.length })}
          </SubmitButton>
        </footer>
      </form>
    </ModalDialog>
  );
}

function AccountInspectorDialog({
  open,
  account,
  onClose,
  onAction,
}: {
  open: boolean;
  account: AccountRecord;
  onClose: () => void;
  onAction: (dialog: DialogState) => void;
}) {
  const { t } = useI18n();
  return (
    <ModalDialog
      open={open}
      title={account.name}
      description={t("netWorth.inspector.description", {
        type: t(`netWorth.account.${account.type}`),
      })}
      onClose={onClose}
      initialFocusId="account-inspector-history"
      className="account-inspector-dialog"
    >
      <dl className="inspector-summary">
        <div>
          <dt>{t("netWorth.inspector.balance")}</dt>
          <dd>
            {account.resolved_balance === null
              ? t("netWorth.account.unresolved")
              : money(account.resolved_balance)}
          </dd>
        </div>
        <div>
          <dt>{t("common.date")}</dt>
          <dd>
            {account.resolved_balance_date
              ? formatDate(account.resolved_balance_date)
              : t("netWorth.account.noEarlierBalance")}
          </dd>
        </div>
      </dl>
      <div className="inspector-actions">
        <button
          id="account-inspector-history"
          className="button secondary"
          type="button"
          onClick={() => onAction({ kind: "history", account })}
        >
          <History aria-hidden="true" />
          {t("netWorth.actions.history")}
        </button>
        {!account.archived_on ? (
          <>
            <button
              className="button secondary"
              type="button"
              onClick={() => onAction({ kind: "edit", account })}
            >
              <Pencil aria-hidden="true" />
              {t("netWorth.inspector.editName")}
            </button>
            <button
              className="button danger"
              type="button"
              onClick={() => onAction({ kind: "archive", account })}
            >
              <Archive aria-hidden="true" />
              {t("netWorth.actions.archive")}
            </button>
          </>
        ) : null}
      </div>
    </ModalDialog>
  );
}

function toAccountRecord(
  account: NetWorthAccountAnalytics,
  data: NetWorthOverview,
): AccountRecord {
  return {
    id: account.account_id,
    name: account.name,
    type: account.type,
    archived_on: account.archived_on,
    created_at: "",
    as_of: data.summary.as_of,
    resolved_balance: account.current_balance,
    resolved_balance_date: account.current_balance_date,
    currency: data.currency,
  };
}

function AddAccountDialog({ open, onClose, onChanged }: DialogProps) {
  const { t } = useI18n();
  const [form, setForm] = useState<AccountInput>({
    name: "",
    type: "asset",
    initial_balance: "",
    initial_balance_date: todayIso(),
  });
  const mutation = useMutation(api.createAccount, { onSuccess: onChanged });
  return (
    <ModalDialog
      open={open}
      title={t("netWorth.dialog.addTitle")}
      description={t("netWorth.dialog.addDescription")}
      onClose={onClose}
      initialFocusId="account-name"
    >
      {mutation.status === "error" ? (
        <ErrorBanner message={mutation.error.message} />
      ) : null}
      <form
        className="net-worth-form"
        onSubmit={(event) => {
          event.preventDefault();
          void mutation.mutate(form);
        }}
      >
        <Field id="account-name" label={t("netWorth.form.name")}>
          <input
            id="account-name"
            name="name"
            required
            autoComplete="off"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
        </Field>
        <fieldset>
          <legend>{t("netWorth.form.type")}</legend>
          <div className="account-type-options">
            {(["asset", "liability"] as const).map((type) => (
              <label key={type}>
                <input
                  type="radio"
                  name="account-type"
                  checked={form.type === type}
                  onChange={() => setForm({ ...form, type })}
                />
                <span>{t(`netWorth.account.${type}`)}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <Field
          id="initial-balance"
          label={t("netWorth.form.initialBalance")}
          hint={t("netWorth.form.liabilityHint")}
        >
          <input
            id="initial-balance"
            name="initial_balance"
            inputMode="decimal"
            pattern="[0-9]+(?:\.[0-9]{1,2})?"
            required
            value={form.initial_balance}
            onChange={(event) =>
              setForm({ ...form, initial_balance: event.target.value })
            }
          />
        </Field>
        <Field id="initial-date" label={t("netWorth.form.effectiveDate")}>
          <input
            id="initial-date"
            name="initial_balance_date"
            type="date"
            max={todayIso()}
            required
            value={form.initial_balance_date}
            onChange={(event) =>
              setForm({ ...form, initial_balance_date: event.target.value })
            }
          />
        </Field>
        <DialogActions
          busy={mutation.status === "pending"}
          onClose={onClose}
          submit={t("netWorth.actions.addAccount")}
        />
      </form>
    </ModalDialog>
  );
}

function BalanceDialog({
  open,
  account,
  snapshot,
  onClose,
  onChanged,
}: DialogProps & { account: AccountRecord; snapshot?: BalanceSnapshot }) {
  const { t } = useI18n();
  const [amount, setAmount] = useState(snapshot?.amount ?? "");
  const [effectiveDate, setEffectiveDate] = useState(
    snapshot?.effective_date ?? todayIso(),
  );
  const mutation = useMutation(
    () => api.setBalanceSnapshot(account.id, effectiveDate, amount),
    { onSuccess: onChanged },
  );
  return (
    <ModalDialog
      open={open}
      title={
        snapshot
          ? t("netWorth.dialog.correctTitle")
          : t("netWorth.dialog.balanceTitle")
      }
      description={t("netWorth.dialog.balanceDescription", {
        name: account.name,
        type: t(`netWorth.account.${account.type}`),
      })}
      onClose={onClose}
      initialFocusId="balance-amount"
    >
      {mutation.status === "error" ? (
        <ErrorBanner message={mutation.error.message} />
      ) : null}
      <form
        className="net-worth-form"
        onSubmit={(event) => {
          event.preventDefault();
          void mutation.mutate(undefined);
        }}
      >
        <Field id="balance-amount" label={t("common.amount")}>
          <input
            id="balance-amount"
            name="amount"
            inputMode="decimal"
            pattern="[0-9]+(?:\.[0-9]{1,2})?"
            required
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </Field>
        <Field
          id="balance-date"
          label={t("netWorth.form.effectiveDate")}
          hint={t("netWorth.form.replaceHint")}
        >
          <input
            id="balance-date"
            name="effective_date"
            type="date"
            max={todayIso()}
            required
            value={effectiveDate}
            disabled={Boolean(snapshot)}
            onChange={(event) => setEffectiveDate(event.target.value)}
          />
        </Field>
        <DialogActions
          busy={mutation.status === "pending"}
          onClose={onClose}
          submit={t("common.save")}
        />
      </form>
    </ModalDialog>
  );
}

function EditAccountDialog({
  open,
  account,
  onClose,
  onChanged,
}: DialogProps & { account: AccountRecord }) {
  const { t } = useI18n();
  const [name, setName] = useState(account.name);
  const mutation = useMutation(() => api.updateAccount(account.id, { name }), {
    onSuccess: onChanged,
  });
  return (
    <ModalDialog
      open={open}
      title={t("netWorth.dialog.editTitle")}
      description={t("netWorth.dialog.editDescription", {
        type: t(`netWorth.account.${account.type}`),
      })}
      onClose={onClose}
      initialFocusId="edit-account-name"
    >
      {mutation.status === "error" ? (
        <ErrorBanner message={mutation.error.message} />
      ) : null}
      <form
        className="net-worth-form"
        onSubmit={(event) => {
          event.preventDefault();
          void mutation.mutate(undefined);
        }}
      >
        <Field id="edit-account-name" label={t("netWorth.form.name")}>
          <input
            id="edit-account-name"
            name="name"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        <DialogActions
          busy={mutation.status === "pending"}
          onClose={onClose}
          submit={t("common.save")}
        />
      </form>
    </ModalDialog>
  );
}

function ArchiveDialog({
  open,
  account,
  onClose,
  onChanged,
}: DialogProps & { account: AccountRecord }) {
  const { t } = useI18n();
  const [closingDate, setClosingDate] = useState(todayIso());
  const [confirmed, setConfirmed] = useState(false);
  const mutation = useMutation(
    () =>
      api.archiveAccount(account.id, {
        closing_date: closingDate,
        confirm_zero_balance: confirmed,
      }),
    { onSuccess: onChanged },
  );
  return (
    <ModalDialog
      open={open}
      title={t("netWorth.dialog.archiveTitle", { name: account.name })}
      description={t("netWorth.dialog.archiveDescription")}
      onClose={onClose}
    >
      {mutation.status === "error" ? (
        <ErrorBanner message={mutation.error.message} />
      ) : null}
      <form
        className="net-worth-form"
        onSubmit={(event) => {
          event.preventDefault();
          void mutation.mutate(undefined);
        }}
      >
        <Field id="closing-date" label={t("netWorth.form.closingDate")}>
          <input
            id="closing-date"
            name="closing_date"
            type="date"
            max={todayIso()}
            required
            value={closingDate}
            onChange={(event) => setClosingDate(event.target.value)}
          />
        </Field>
        <label className="confirmation-check">
          <input
            type="checkbox"
            required
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
          />
          <span>{t("netWorth.form.confirmZero")}</span>
        </label>
        <DialogActions
          busy={mutation.status === "pending"}
          onClose={onClose}
          submit={t("netWorth.actions.archive")}
          danger
        />
      </form>
    </ModalDialog>
  );
}

function SnapshotHistoryDialog({
  open,
  account,
  onClose,
  onChanged,
  onEditSnapshot,
}: DialogProps & {
  account: AccountRecord;
  onEditSnapshot: (snapshot: BalanceSnapshot) => void;
}) {
  const { t } = useI18n();
  const [refreshKey, refresh] = useReducer((value: number) => value + 1, 0);
  const [confirmation, setConfirmation] = useState<
    | { kind: "snapshot"; snapshot: BalanceSnapshot }
    | { kind: "account"; snapshot: BalanceSnapshot }
    | null
  >(null);
  const load = useMemo(
    () => (signal: AbortSignal) => api.balanceSnapshots(account.id, signal),
    [account.id],
  );
  const resource = useResource(load, `${account.id}:${refreshKey}`);
  const deleteSnapshot = useMutation(
    (snapshot: BalanceSnapshot) =>
      api.deleteBalanceSnapshot(account.id, snapshot.effective_date),
    {
      onSuccess: (response) => {
        setConfirmation(null);
        onChanged(response);
        refresh();
      },
    },
  );
  const deleteAccount = useMutation(() => api.deleteAccount(account.id), {
    onSuccess: (response) => {
      setConfirmation(null);
      onChanged(response);
    },
  });
  const snapshots = resource.data?.balance_snapshots ?? [];
  const confirmationSnapshot = confirmation?.snapshot;
  return (
    <>
      <ModalDialog
        open={open}
        title={t("netWorth.dialog.historyTitle", { name: account.name })}
        description={t("netWorth.dialog.historyDescription")}
        onClose={onClose}
      >
        {resource.status === "error" ? (
          <ErrorBanner
            message={resource.error.message}
            onRetry={resource.refetch}
          />
        ) : null}
        {resource.status === "loading" ? (
          <p>{t("netWorth.loading")}</p>
        ) : (
          <ul className="snapshot-list">
            {snapshots.map((snapshot) => (
              <li key={snapshot.id}>
                <div>
                  <strong>{money(snapshot.amount)}</strong>
                  <span>{formatDate(snapshot.effective_date)}</span>
                </div>
                {!account.archived_on ? (
                  <div>
                    <button
                      className="button ghost"
                      type="button"
                      onClick={() => onEditSnapshot(snapshot)}
                    >
                      <Pencil aria-hidden="true" size={16} />
                      <span>{t("common.edit")}</span>
                    </button>
                    {snapshots.length > 1 ? (
                      <button
                        className="icon-button danger"
                        type="button"
                        aria-label={t("netWorth.actions.deleteSnapshot", {
                          date: formatDate(snapshot.effective_date),
                        })}
                        onClick={() => {
                          deleteSnapshot.reset();
                          setConfirmation({ kind: "snapshot", snapshot });
                        }}
                      >
                        <Trash2 aria-hidden="true" size={16} />
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {!account.archived_on && snapshots.length === 1 ? (
          <div className="eligible-delete">
            <p>{t("netWorth.confirm.deleteAccountDetail")}</p>
            <button
              className="button danger"
              type="button"
              onClick={() => {
                deleteAccount.reset();
                setConfirmation({ kind: "account", snapshot: snapshots[0] });
              }}
            >
              <Trash2 aria-hidden="true" size={17} />
              <span>{t("netWorth.actions.deleteAccount")}</span>
            </button>
          </div>
        ) : null}
      </ModalDialog>
      <ModalDialog
        open={confirmation !== null}
        title={
          confirmation?.kind === "snapshot" && confirmationSnapshot
            ? t("netWorth.actions.deleteSnapshot", {
                date: formatDate(confirmationSnapshot.effective_date),
              })
            : t("netWorth.confirm.deleteAccount", { name: account.name })
        }
        description={
          confirmation?.kind === "snapshot" && confirmationSnapshot
            ? t("netWorth.confirm.deleteSnapshot", {
                amount: money(confirmationSnapshot.amount),
                date: formatDate(confirmationSnapshot.effective_date),
              })
            : confirmationSnapshot
              ? t("netWorth.confirm.deleteAccountSnapshot", {
                  amount: money(confirmationSnapshot.amount),
                  date: formatDate(confirmationSnapshot.effective_date),
                })
              : undefined
        }
        onClose={() => setConfirmation(null)}
        initialFocusId="net-worth-delete-cancel"
      >
        {confirmation?.kind === "snapshot" &&
        deleteSnapshot.status === "error" ? (
          <ErrorBanner message={deleteSnapshot.error.message} />
        ) : null}
        {confirmation?.kind === "account" &&
        deleteAccount.status === "error" ? (
          <ErrorBanner message={deleteAccount.error.message} />
        ) : null}
        <footer className="dialog-actions">
          <button
            id="net-worth-delete-cancel"
            className="button secondary"
            type="button"
            onClick={() => setConfirmation(null)}
          >
            {t("common.cancel")}
          </button>
          <button
            className="button danger"
            type="button"
            disabled={
              deleteSnapshot.status === "pending" ||
              deleteAccount.status === "pending"
            }
            onClick={() => {
              if (confirmation?.kind === "snapshot") {
                void deleteSnapshot.mutate(confirmation.snapshot);
              } else if (confirmation?.kind === "account") {
                void deleteAccount.mutate(undefined);
              }
            }}
          >
            <Trash2 aria-hidden="true" size={17} />
            <span>
              {confirmation?.kind === "snapshot"
                ? t("netWorth.actions.deleteSnapshotConfirm")
                : t("netWorth.actions.deleteAccount")}
            </span>
          </button>
        </footer>
      </ModalDialog>
    </>
  );
}

function DialogActions({
  busy,
  onClose,
  submit,
  danger = false,
}: {
  busy: boolean;
  onClose: () => void;
  submit: string;
  danger?: boolean;
}) {
  const { t } = useI18n();
  return (
    <footer className="dialog-actions">
      <button className="button secondary" type="button" onClick={onClose}>
        {t("common.cancel")}
      </button>
      <SubmitButton
        busy={busy}
        icon={danger ? Archive : Save}
        variant={danger ? "danger" : "primary"}
      >
        {submit}
      </SubmitButton>
    </footer>
  );
}

type DialogProps = {
  open: boolean;
  onClose: () => void;
  onChanged: (response: { notice: string; notice_code?: string }) => void;
};

function readUrlState(): { asOf: string; months: number } {
  const params = new URLSearchParams(window.location.search);
  const rawDate = params.get("as_of") ?? "";
  const rawMonths = Number(params.get("months"));
  const validDate =
    /^\d{4}-\d{2}-\d{2}$/.test(rawDate) &&
    !Number.isNaN(new Date(`${rawDate}T00:00:00`).getTime()) &&
    rawDate <= todayIso();
  return {
    asOf: validDate && rawDate !== todayIso() ? rawDate : "",
    months: supportedRanges.includes(
      rawMonths as (typeof supportedRanges)[number],
    )
      ? rawMonths
      : 12,
  };
}
