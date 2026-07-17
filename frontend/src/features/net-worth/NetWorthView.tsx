import {
  Archive,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  CircleDollarSign,
  CreditCard,
  History,
  Landmark,
  Pencil,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
  WalletCards,
} from "lucide-react";
import "./net-worth.css";
import { useMemo, useReducer, useState } from "react";
import { api } from "../../api/client";
import { ActionButton, SubmitButton } from "../../shared/components/actions";
import { ModalDialog } from "../../shared/components/dialogs";
import { EmptyState, ErrorBanner } from "../../shared/components/feedback";
import { Field } from "../../shared/components/fields";
import { PageHeader, Panel } from "../../shared/components/lists";
import { formatDate, todayIso } from "../../shared/format/dates";
import { currencySymbol, money, signedMoney } from "../../shared/format/money";
import { useMutation } from "../../shared/hooks/useMutation";
import { useResource } from "../../shared/hooks/useResource";
import { useI18n } from "../../shared/i18n/I18nProvider";
import { localizedNotice } from "../../shared/i18n/notices";
import type {
  AccountInput,
  AccountRecord,
  BalanceSnapshot,
  NetWorthAccountAnalytics,
  NetWorthOverview,
} from "../../types";
import { useNetWorthData } from "./useNetWorthData";
import {
  isSupportedNetWorthRange,
  PortfolioWorkspace,
  WealthFirstUse,
  WealthOverview,
  WealthToolbar,
} from "./WealthOverview";

type DialogState =
  | { kind: "add" }
  | { kind: "checkIn" }
  | { kind: "inspector"; account: AccountRecord }
  | { kind: "balance"; account: AccountRecord; snapshot?: BalanceSnapshot }
  | { kind: "edit"; account: AccountRecord }
  | { kind: "archive"; account: AccountRecord }
  | { kind: "history"; account: AccountRecord }
  | null;

export function NetWorthView({
  setNotice,
}: {
  setNotice: (notice: string) => void;
}) {
  const { t } = useI18n();
  const initial = useMemo(() => readUrlState(), []);
  const [asOf, setAsOf] = useState(initial.asOf);
  const [months, setMonths] = useState(initial.months);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [refreshKey, refresh] = useReducer((value: number) => value + 1, 0);
  const resource = useNetWorthData(asOf, months, includeArchived, refreshKey);
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
      <PageHeader
        eyebrow={t("netWorth.eyebrow")}
        title={t("netWorth.accountsTitle")}
        summary={t("netWorth.accountsSummary")}
        actions={
          <div className="wealth-header-actions">
            <ActionButton
              icon={accountCount ? WalletCards : CircleDollarSign}
              onClick={() =>
                setDialog(accountCount ? { kind: "checkIn" } : { kind: "add" })
              }
            >
              {t(
                accountCount
                  ? "netWorth.actions.updateBalances"
                  : "netWorth.actions.addAccount",
              )}
            </ActionButton>
            {accountCount ? (
              <ActionButton
                icon={CircleDollarSign}
                variant="secondary"
                onClick={() => setDialog({ kind: "add" })}
              >
                {t("netWorth.actions.addAccount")}
              </ActionButton>
            ) : null}
          </div>
        }
      />
      {resource.status === "error" ? (
        <ErrorBanner
          message={resource.error.message}
          onRetry={resource.refetch}
        />
      ) : null}
      {accountCount === 0 ? (
        <WealthFirstUse onAdd={() => setDialog({ kind: "add" })} />
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
        <WealthOverview
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

      {accountCount > 0 ? (
        <PortfolioWorkspace
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

function BalanceCheckInDialog({
  open,
  accounts,
  onClose,
  onChanged,
}: DialogProps & { accounts: NetWorthAccountAnalytics[] }) {
  const { t } = useI18n();
  const [effectiveDate, setEffectiveDate] = useState(todayIso());
  const initialAmounts = useMemo(
    () =>
      Object.fromEntries(
        accounts.map((account) => [
          account.account_id,
          account.current_balance ?? "",
        ]),
      ),
    [accounts],
  );
  const [amounts, setAmounts] =
    useState<Record<number, string>>(initialAmounts);
  const mutation = useMutation(
    (payload: {
      effectiveDate: string;
      updates: { account_id: number; amount: string }[];
    }) => api.checkInBalances(payload.effectiveDate, payload.updates),
    { onSuccess: onChanged },
  );
  const updates = accounts
    .filter((account) =>
      balanceChanged(account, amounts[account.account_id] ?? ""),
    )
    .map((account) => ({
      account_id: account.account_id,
      amount: amounts[account.account_id].trim(),
    }));
  const assets = accounts.filter((account) => account.type === "asset");
  const liabilities = accounts.filter(
    (account) => account.type === "liability",
  );
  const currentNetWorth = accounts.reduce(
    (total, account) =>
      total +
      (account.type === "asset" ? 1 : -1) *
        Number(account.current_balance ?? 0),
    0,
  );
  const projectedNetWorth = accounts.reduce((total, account) => {
    const amount = amounts[account.account_id]?.trim();
    const resolvedAmount =
      amount && Number.isFinite(Number(amount))
        ? Number(amount)
        : Number(account.current_balance ?? 0);
    return total + (account.type === "asset" ? 1 : -1) * resolvedAmount;
  }, 0);
  const projectedChange = projectedNetWorth - currentNetWorth;
  const hasInvalidAmount = updates.some(
    (update) =>
      update.amount === "" ||
      !Number.isFinite(Number(update.amount)) ||
      Number(update.amount) < 0,
  );

  function setAmount(accountId: number, value: string) {
    setAmounts((current) => ({ ...current, [accountId]: value }));
  }

  function resetAll() {
    setAmounts(initialAmounts);
  }

  return (
    <ModalDialog
      open={open}
      title={t("netWorth.checkIn.title")}
      description={t("netWorth.checkIn.description")}
      onClose={onClose}
      initialFocusId="balance-check-in-date"
      className="balance-check-in-dialog balance-studio-dialog"
    >
      {mutation.status === "error" ? (
        <ErrorBanner message={mutation.error.message} />
      ) : null}
      <form
        className="balance-studio"
        onSubmit={(event) => {
          event.preventDefault();
          if (updates.length && !hasInvalidAmount) {
            void mutation.mutate({ effectiveDate, updates });
          }
        }}
      >
        <section className="balance-studio-overview">
          <div className="balance-date-card">
            <div className="balance-studio-icon" aria-hidden="true">
              <CalendarDays />
            </div>
            <Field
              id="balance-check-in-date"
              label={t("netWorth.form.effectiveDate")}
              hint={t("netWorth.form.replaceHint")}
            >
              <input
                id="balance-check-in-date"
                name="effective_date"
                type="date"
                max={todayIso()}
                value={effectiveDate}
                onChange={(event) => setEffectiveDate(event.target.value)}
                required
              />
            </Field>
          </div>
          <div className="balance-impact-card">
            <span className="balance-impact-label">
              <Sparkles aria-hidden="true" />
              {t("netWorth.checkIn.projected")}
            </span>
            <strong>{money(projectedNetWorth)}</strong>
            <span
              className={
                projectedChange === 0
                  ? "balance-impact-change"
                  : `balance-impact-change ${
                      projectedChange > 0 ? "positive" : "negative"
                    }`
              }
            >
              {projectedChange === 0 ? (
                <ArrowRight aria-hidden="true" />
              ) : projectedChange > 0 ? (
                <ArrowUpRight aria-hidden="true" />
              ) : (
                <ArrowDownRight aria-hidden="true" />
              )}
              {projectedChange === 0
                ? t("netWorth.checkIn.noImpact")
                : t("netWorth.checkIn.impact", {
                    amount: signedMoney(projectedChange),
                  })}
            </span>
          </div>
        </section>

        <div className="balance-studio-guide">
          <CircleDollarSign aria-hidden="true" />
          <p>
            <strong>{t("netWorth.checkIn.guideTitle")}</strong>
            <span>{t("netWorth.checkIn.guide")}</span>
          </p>
        </div>

        <div className="balance-account-groups">
          <BalanceAccountGroup
            accounts={assets}
            amounts={amounts}
            kind="asset"
            onAmountChange={setAmount}
          />
          <BalanceAccountGroup
            accounts={liabilities}
            amounts={amounts}
            kind="liability"
            onAmountChange={setAmount}
          />
        </div>

        <footer className="balance-studio-actions">
          <div className="balance-save-status" aria-live="polite">
            <span
              className={`balance-change-count${
                updates.length ? " has-changes" : ""
              }`}
            >
              {updates.length ? (
                <Check aria-hidden="true" />
              ) : (
                <CircleDollarSign aria-hidden="true" />
              )}
            </span>
            <p>
              <strong>
                {updates.length
                  ? t("netWorth.checkIn.ready", { count: updates.length })
                  : t("netWorth.checkIn.noChanges")}
              </strong>
              <span>
                {updates.length
                  ? t("netWorth.checkIn.readyDetail", {
                      date: formatDate(effectiveDate),
                    })
                  : t("netWorth.checkIn.noChangesDetail")}
              </span>
            </p>
          </div>
          <div className="balance-action-buttons">
            {updates.length ? (
              <button className="button ghost" type="button" onClick={resetAll}>
                <RotateCcw aria-hidden="true" size={17} />
                <span>{t("netWorth.checkIn.reset")}</span>
              </button>
            ) : (
              <button
                className="button secondary"
                type="button"
                onClick={onClose}
              >
                {t("common.cancel")}
              </button>
            )}
            <SubmitButton
              busy={mutation.status === "pending"}
              icon={Save}
              disabled={!updates.length || hasInvalidAmount}
            >
              {t("netWorth.checkIn.save", { count: updates.length })}
            </SubmitButton>
          </div>
        </footer>
      </form>
    </ModalDialog>
  );
}

function BalanceAccountGroup({
  accounts,
  amounts,
  kind,
  onAmountChange,
}: {
  accounts: NetWorthAccountAnalytics[];
  amounts: Record<number, string>;
  kind: "asset" | "liability";
  onAmountChange: (accountId: number, value: string) => void;
}) {
  const { t } = useI18n();
  if (!accounts.length) return null;

  const Icon = kind === "asset" ? Landmark : CreditCard;
  return (
    <fieldset className={`balance-account-group ${kind}`}>
      <legend>
        <span className="balance-group-icon" aria-hidden="true">
          <Icon />
        </span>
        <span>
          <strong>{t(`netWorth.accounts.${kind}`)}</strong>
          <small>
            {t("netWorth.checkIn.accountCount", { count: accounts.length })}
          </small>
        </span>
      </legend>
      <ul className="balance-account-list">
        {accounts.map((account) => {
          const id = `check-in-${account.account_id}`;
          const value = amounts[account.account_id] ?? "";
          const changed = balanceChanged(account, value);
          const current = Number(account.current_balance ?? 0);
          const next = Number(value);
          const difference =
            value.trim() && Number.isFinite(next) ? next - current : 0;
          return (
            <li
              className={`balance-account-row${changed ? " is-changed" : ""}`}
              key={account.account_id}
            >
              <div className="balance-account-identity">
                <span className="balance-account-mark" aria-hidden="true">
                  {account.name.slice(0, 1).toLocaleUpperCase()}
                </span>
                <span>
                  <label htmlFor={id}>{account.name}</label>
                  <small>
                    {account.current_balance === null
                      ? t("netWorth.account.unresolved")
                      : t("netWorth.checkIn.lastRecorded", {
                          date: formatDate(account.current_balance_date ?? ""),
                        })}
                  </small>
                </span>
              </div>
              <div className="balance-previous-value">
                <span>{t("netWorth.checkIn.previous")}</span>
                <strong>
                  {account.current_balance === null
                    ? "—"
                    : money(account.current_balance)}
                </strong>
              </div>
              <div className="balance-amount-field">
                <span className="balance-currency" aria-hidden="true">
                  {currencySymbol()}
                </span>
                <input
                  id={id}
                  name={`balance_${account.account_id}`}
                  inputMode="decimal"
                  enterKeyHint="next"
                  type="number"
                  min="0"
                  step="0.01"
                  value={value}
                  onFocus={(event) => event.currentTarget.select()}
                  onChange={(event) =>
                    onAmountChange(account.account_id, event.target.value)
                  }
                  aria-label={t("netWorth.checkIn.newBalanceFor", {
                    name: account.name,
                  })}
                  aria-describedby={
                    kind === "liability" ? "check-in-liability-hint" : undefined
                  }
                  required={changed}
                />
              </div>
              <div className="balance-row-state">
                {changed ? (
                  <>
                    <span
                      className={
                        difference === 0
                          ? "balance-delta"
                          : `balance-delta ${
                              difference > 0 ? "positive" : "negative"
                            }`
                      }
                    >
                      {account.current_balance === null
                        ? t("netWorth.checkIn.new")
                        : signedMoney(difference)}
                    </span>
                    <button
                      className="balance-row-reset"
                      type="button"
                      onClick={() =>
                        onAmountChange(
                          account.account_id,
                          account.current_balance ?? "",
                        )
                      }
                      aria-label={t("netWorth.checkIn.resetFor", {
                        name: account.name,
                      })}
                    >
                      <RotateCcw aria-hidden="true" />
                    </button>
                  </>
                ) : (
                  <span className="balance-unchanged">
                    {t("netWorth.checkIn.unchanged")}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {kind === "liability" ? (
        <p id="check-in-liability-hint" className="balance-liability-hint">
          {t("netWorth.form.liabilityHint")}
        </p>
      ) : null}
    </fieldset>
  );
}

function balanceChanged(
  account: NetWorthAccountAnalytics,
  value: string,
): boolean {
  const next = value.trim();
  if (!next) return false;
  if (account.current_balance === null) return true;
  const nextNumber = Number(next);
  const currentNumber = Number(account.current_balance);
  return (
    !Number.isFinite(nextNumber) ||
    !Number.isFinite(currentNumber) ||
    nextNumber !== currentNumber
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
    months: isSupportedNetWorthRange(rawMonths) ? rawMonths : 12,
  };
}
