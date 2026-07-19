import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  CircleDollarSign,
  CreditCard,
  Landmark,
  RotateCcw,
  Save,
  Sparkles,
} from "lucide-react";
import { useMemo, useState } from "react";
import { api } from "../../api/client";
import { SubmitButton } from "../../shared/components/actions";
import { ModalDialog } from "../../shared/components/dialogs";
import { ErrorBanner } from "../../shared/components/feedback";
import { Field } from "../../shared/components/fields";
import { formatDate, todayIso } from "../../shared/format/dates";
import {
  compareMoney,
  currencySymbol,
  money,
  signedMoney,
  subtractMoney,
  sumMoney,
} from "../../shared/format/money";
import { useMutation } from "../../shared/hooks/useMutation";
import { useI18n } from "../../shared/i18n/I18nProvider";
import type { NetWorthAccountAnalytics } from "../../types";

type DialogProps = {
  open: boolean;
  onClose: () => void;
  onChanged: (response: { notice: string; notice_code?: string }) => void;
};

export function BalanceCheckInDialog({
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
    async (payload: {
      effectiveDate: string;
      updates: { account_id: number; amount: string }[];
    }) => {
      await Promise.all(
        payload.updates.map((update) =>
          api.createActivity({
            kind: "adjustment",
            amount: update.amount,
            date: payload.effectiveDate,
            account_id: update.account_id,
            description: "Balance check-in",
          }),
        ),
      );
      return {
        notice: t("accounts.updated"),
        notice_code: "balance_check_in.saved",
      };
    },
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
  const currentNetWorth = sumMoney(
    accounts.map((account) =>
      account.type === "asset"
        ? (account.current_balance ?? "0.00")
        : `-${account.current_balance ?? "0.00"}`,
    ),
  );
  const projectedNetWorth = sumMoney(
    accounts.map((account) => {
      const amount = amounts[account.account_id]?.trim();
      const resolvedAmount =
        amount && Number.isFinite(Number(amount))
          ? amount
          : (account.current_balance ?? "0.00");
      return account.type === "asset" ? resolvedAmount : `-${resolvedAmount}`;
    }),
  );
  const projectedChange = subtractMoney(projectedNetWorth, currentNetWorth);
  const projectedDirection = compareMoney(projectedChange, 0);
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
                projectedDirection === 0
                  ? "balance-impact-change"
                  : `balance-impact-change ${
                      projectedDirection > 0 ? "positive" : "negative"
                    }`
              }
            >
              {projectedDirection === 0 ? (
                <ArrowRight aria-hidden="true" />
              ) : projectedDirection > 0 ? (
                <ArrowUpRight aria-hidden="true" />
              ) : (
                <ArrowDownRight aria-hidden="true" />
              )}
              {projectedDirection === 0
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
          const current = account.current_balance ?? "0.00";
          const difference =
            value.trim() && Number.isFinite(Number(value))
              ? subtractMoney(value, current)
              : "0.00";
          const differenceDirection = compareMoney(difference, 0);
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
                        differenceDirection === 0
                          ? "balance-delta"
                          : `balance-delta ${
                              differenceDirection > 0 ? "positive" : "negative"
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
  if (!Number.isFinite(Number(next))) return true;
  return compareMoney(next, account.current_balance) !== 0;
}
