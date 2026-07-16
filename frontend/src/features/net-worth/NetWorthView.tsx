import {
  Archive,
  CalendarDays,
  History,
  Landmark,
  Pencil,
  Plus,
  Save,
  Trash2,
  TrendingDown,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import "./net-worth.css";
import { useEffect, useMemo, useReducer, useState } from "react";
import { api } from "../../api/client";
import { ActionButton, SubmitButton } from "../../shared/components/actions";
import { ModalDialog } from "../../shared/components/dialogs";
import { EmptyState, ErrorBanner } from "../../shared/components/feedback";
import { Field } from "../../shared/components/fields";
import { PageHeader, Panel } from "../../shared/components/lists";
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
  NetWorthHistory,
} from "../../types";
import { useNetWorthData } from "./useNetWorthData";

type DialogState =
  | { kind: "add" }
  | { kind: "balance"; account: AccountRecord; snapshot?: BalanceSnapshot }
  | { kind: "edit"; account: AccountRecord }
  | { kind: "archive"; account: AccountRecord }
  | { kind: "history"; account: AccountRecord }
  | null;

const supportedRanges = [6, 12, 24] as const;

export function NetWorthView({
  setNotice,
  createRequestId,
}: {
  setNotice: (notice: string) => void;
  createRequestId: number;
}) {
  const { t, tUpper } = useI18n();
  const initial = useMemo(() => readUrlState(), []);
  const [asOf, setAsOf] = useState(initial.asOf);
  const [months, setMonths] = useState(initial.months);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [refreshKey, refresh] = useReducer((value: number) => value + 1, 0);
  const resource = useNetWorthData(asOf, months, includeArchived, refreshKey);

  useEffect(() => {
    if (createRequestId > 0) setDialog({ kind: "add" });
  }, [createRequestId]);

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
  const resolvedCount =
    data.summary.resolved_asset_count + data.summary.resolved_liability_count;
  const assets = data.accounts.filter((account) => account.type === "asset");
  const liabilities = data.accounts.filter(
    (account) => account.type === "liability",
  );
  const pending = resource.status === "loading";

  return (
    <div className={`net-worth-view${pending ? " is-refreshing" : ""}`}>
      {resource.status === "error" ? (
        <ErrorBanner
          message={resource.error.message}
          onRetry={resource.refetch}
        />
      ) : null}
      <PageHeader
        eyebrow={tUpper("netWorth.eyebrow")}
        title={t("netWorth.title")}
        summary={t("netWorth.summary")}
        actions={
          <ActionButton icon={Plus} onClick={() => setDialog({ kind: "add" })}>
            {t("netWorth.actions.addAccount")}
          </ActionButton>
        }
        className="net-worth-heading"
      />

      <section
        className="net-worth-controls"
        aria-label={t("netWorth.controls")}
      >
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
            onChange={(event) => {
              const next =
                event.target.value === todayIso() ? "" : event.target.value;
              setAsOf(next);
              updateUrl(next, months);
            }}
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
                  onChange={() => {
                    setMonths(range);
                    updateUrl(asOf, range);
                  }}
                />
                <span>{t("netWorth.months", { count: range })}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <p className="net-worth-pending" role="status">
          {pending ? t("netWorth.refreshing") : ""}
        </p>
      </section>

      {accountCount === 0 ? (
        <EmptyState
          icon={Landmark}
          eyebrow={t("netWorth.firstUse.eyebrow")}
          title={t("netWorth.firstUse.title")}
          message={t("netWorth.firstUse.message")}
          action={
            <ActionButton
              icon={Plus}
              onClick={() => setDialog({ kind: "add" })}
            >
              {t("netWorth.actions.addAccount")}
            </ActionButton>
          }
        />
      ) : resolvedCount === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title={t("netWorth.unresolvedAll.title")}
          message={t("netWorth.unresolvedAll.message", {
            date: formatDate(data.summary.as_of),
          })}
        />
      ) : (
        <NetWorthSummaryView summary={data.summary} />
      )}

      {accountCount > 0 ? (
        <>
          <section
            className="net-worth-composition"
            aria-labelledby="net-worth-composition-title"
          >
            <header className="net-worth-section-header">
              <div>
                <h2 id="net-worth-composition-title">
                  {t("netWorth.composition.title")}
                </h2>
                <p>{t("netWorth.composition.detail")}</p>
              </div>
              {data.summary.archived_account_count > 0 ? (
                <label className="archived-toggle">
                  <input
                    type="checkbox"
                    checked={includeArchived}
                    onChange={(event) =>
                      setIncludeArchived(event.target.checked)
                    }
                  />
                  <span>{t("netWorth.actions.showArchived")}</span>
                </label>
              ) : null}
            </header>
            <div className="net-worth-account-groups">
              <AccountGroup
                title={t("netWorth.assets")}
                accounts={assets}
                onAction={setDialog}
              />
              <AccountGroup
                title={t("netWorth.liabilities")}
                accounts={liabilities}
                onAction={setDialog}
              />
            </div>
          </section>
          <NetWorthHistoryView history={data.history} />
        </>
      ) : null}

      {dialog?.kind === "add" ? (
        <AddAccountDialog
          open
          onClose={() => setDialog(null)}
          onChanged={changed}
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

function NetWorthSummaryView({
  summary,
}: {
  summary: {
    as_of: string;
    total_assets: string;
    total_liabilities: string;
    total_net_worth: string;
    unresolved_account_count: number;
  };
}) {
  const { t } = useI18n();
  const total = Number(summary.total_net_worth);
  return (
    <section
      className={`net-worth-summary ${total < 0 ? "is-negative" : total > 0 ? "is-positive" : "is-zero"}`}
      aria-labelledby="net-worth-summary-title"
    >
      <div>
        <p className="eyebrow">{t("netWorth.currentPosition")}</p>
        <h2 id="net-worth-summary-title">{formatDate(summary.as_of)}</h2>
        <p>
          {total < 0
            ? t("netWorth.state.negative")
            : total > 0
              ? t("netWorth.state.positive")
              : t("netWorth.state.zero")}
        </p>
        {summary.unresolved_account_count ? (
          <p className="coverage-note">
            {t("netWorth.coverage", {
              count: summary.unresolved_account_count,
            })}
          </p>
        ) : (
          <p className="coverage-note">{t("netWorth.coverageComplete")}</p>
        )}
      </div>
      <dl>
        <div className="net-worth-total">
          <dt>{t("netWorth.total")}</dt>
          <dd>{signedMoney(summary.total_net_worth)}</dd>
        </div>
        <div>
          <dt>{t("netWorth.assets")}</dt>
          <dd>{money(summary.total_assets)}</dd>
        </div>
        <div>
          <dt>{t("netWorth.liabilities")}</dt>
          <dd>{money(summary.total_liabilities)}</dd>
        </div>
      </dl>
    </section>
  );
}

function AccountGroup({
  title,
  accounts,
  onAction,
}: {
  title: string;
  accounts: AccountRecord[];
  onAction: (dialog: DialogState) => void;
}) {
  const { t } = useI18n();
  return (
    <section className="account-group">
      <h3>{title}</h3>
      {accounts.length ? (
        <ul className="account-list">
          {accounts.map((account) => (
            <li
              key={account.id}
              className={account.archived_on ? "is-archived" : ""}
            >
              <div className="account-row-copy">
                <strong>{account.name}</strong>
                <span>
                  {account.archived_on
                    ? t("netWorth.account.archived", {
                        date: formatDate(account.archived_on),
                      })
                    : t(`netWorth.account.${account.type}`)}
                </span>
              </div>
              <div className="account-row-balance">
                <strong>
                  {account.resolved_balance === null
                    ? t("netWorth.account.unresolved")
                    : money(account.resolved_balance)}
                </strong>
                <span>
                  {account.resolved_balance_date
                    ? t("netWorth.account.balanceDate", {
                        date: formatDate(account.resolved_balance_date),
                      })
                    : t("netWorth.account.noEarlierBalance")}
                </span>
              </div>
              <div className="account-row-actions">
                <button
                  className="button ghost"
                  type="button"
                  onClick={() => onAction({ kind: "history", account })}
                >
                  <History aria-hidden="true" size={17} />
                  <span>{t("netWorth.actions.history")}</span>
                </button>
                {!account.archived_on ? (
                  <>
                    <button
                      className="button ghost"
                      type="button"
                      onClick={() => onAction({ kind: "balance", account })}
                    >
                      <WalletCards aria-hidden="true" size={17} />
                      <span>{t("netWorth.actions.updateBalance")}</span>
                    </button>
                    <button
                      className="icon-button"
                      type="button"
                      aria-label={t("netWorth.actions.editNameFor", {
                        name: account.name,
                      })}
                      onClick={() => onAction({ kind: "edit", account })}
                    >
                      <Pencil aria-hidden="true" size={17} />
                    </button>
                    <button
                      className="icon-button"
                      type="button"
                      aria-label={t("netWorth.actions.archiveFor", {
                        name: account.name,
                      })}
                      onClick={() => onAction({ kind: "archive", account })}
                    >
                      <Archive aria-hidden="true" size={17} />
                    </button>
                  </>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="account-group-empty">{t("netWorth.account.none")}</p>
      )}
    </section>
  );
}

function NetWorthHistoryView({ history }: { history: NetWorthHistory }) {
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
  const change = Number(history.change_amount ?? 0);
  return (
    <section
      className="net-worth-history"
      aria-labelledby="net-worth-history-title"
    >
      <header className="net-worth-section-header">
        <div>
          <h2 id="net-worth-history-title">{t("netWorth.history.title")}</h2>
          <p>
            {history.change_amount === null
              ? t("netWorth.history.noComparison")
              : t(
                  change > 0
                    ? "netWorth.history.increased"
                    : change < 0
                      ? "netWorth.history.decreased"
                      : "netWorth.history.unchanged",
                  { amount: money(Math.abs(change)) },
                )}
          </p>
        </div>
        {history.change_amount !== null ? (
          <span
            className={`history-change ${change < 0 ? "negative" : "positive"}`}
          >
            {change < 0 ? (
              <TrendingDown aria-hidden="true" />
            ) : (
              <TrendingUp aria-hidden="true" />
            )}
            {signedMoney(change)}
            {history.change_percent !== null
              ? ` · ${Number(history.change_percent).toFixed(1)}%`
              : ""}
          </span>
        ) : null}
      </header>
      <figure>
        <figcaption>
          {t("netWorth.history.selected", {
            date: formatDate(selectedPoint.as_of),
            amount: money(selectedPoint.total_net_worth),
          })}
        </figcaption>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-labelledby="net-worth-chart-title net-worth-chart-desc"
        >
          <title id="net-worth-chart-title">
            {t("netWorth.history.chartTitle")}
          </title>
          <desc id="net-worth-chart-desc">
            {t("netWorth.history.chartDesc")}
          </desc>
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
      </figure>
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
    </section>
  );
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
    months: supportedRanges.includes(rawMonths as 6 | 12 | 24) ? rawMonths : 12,
  };
}
