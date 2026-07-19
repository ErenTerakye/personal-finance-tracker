import { useCallback, useEffect, useMemo, useState } from "react";
import "./net-worth.css";
import { api } from "../../api/client";
import { invalidateResourceTags } from "../../shared/hooks/resourceCache";
import { resourceTags } from "../../shared/hooks/resourceKeys";
import { useResource } from "../../shared/hooks/useResource";
import { localizedNotice } from "../../shared/i18n/notices";
import { useI18n } from "../../shared/i18n/I18nProvider";
import { EmptyState, ErrorBanner } from "../../shared/components/feedback";
import { Panel } from "../../shared/components/lists";
import { money } from "../../shared/format/money";
import { formatDate } from "../../shared/format/dates";
import {
  AccountInspectorDialog,
  AddAccountDialog,
  ArchiveDialog,
  BalanceDialog,
  EditAccountDialog,
  toAccountRecord,
  type DialogState,
} from "./AccountLifecycleDialogs";
import { BalanceCheckInDialog } from "./BalanceCheckInDialog";
import { PageHeader } from "../../shared/components/lists";
import { ActionButton } from "../../shared/components/actions";
import { Plus, WalletCards, CalendarDays } from "lucide-react";
import { preloadNetWorthData, useNetWorthData } from "./useNetWorthData";
import {
  PortfolioWorkspace,
  WealthFirstUse,
  WealthOverview,
  WealthToolbar,
} from "./WealthOverview";

export function preloadNetWorthView() {
  const { asOf, months } = readUrlState();
  return preloadNetWorthData(asOf, months, false);
}

export function NetWorthView({
  setNotice,
  locationVersion = 0,
}: {
  setNotice: (notice: string) => void;
  locationVersion?: number;
}) {
  const { t } = useI18n();
  const initial = readUrlState();
  const [asOf, setAsOf] = useState(initial.asOf);
  const [months, setMonths] = useState(initial.months);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [dialog, setDialog] = useState<DialogState>(null);

  const overview = useNetWorthData(asOf, months, includeArchived, refreshKey);
  const accounts = useAccounts(asOf, refreshKey);

  useEffect(() => {
    const next = readUrlState();
    let current = true;
    queueMicrotask(() => {
      if (!current) return;
      setAsOf(next.asOf);
      setMonths(next.months);
    });
    return () => {
      current = false;
    };
  }, [locationVersion]);

  useEffect(() => {
    const close = () => setDialog(null);
    window.addEventListener("finance-tracker:route-leave", close);
    return () =>
      window.removeEventListener("finance-tracker:route-leave", close);
  }, []);

  function updateUrl(nextAsOf: string, nextMonths: number) {
    const url = new URL(window.location.href);
    if (nextAsOf) url.searchParams.set("as_of", nextAsOf);
    else url.searchParams.delete("as_of");
    if (nextMonths === 12) url.searchParams.delete("months");
    else url.searchParams.set("months", String(nextMonths));
    window.history.replaceState({}, "", `${url.pathname}${url.search}`);
  }

  function changed(response: { notice: string; notice_code?: string }) {
    invalidateResourceTags(
      resourceTags.accounts,
      resourceTags.activities,
      resourceTags.dashboard,
    );
    setNotice(localizedNotice(response, t));
    setDialog(null);
    setRefreshKey((value) => value + 1);
  }

  const data = overview.data;

  const analyticsWithOpening = useMemo(() => {
    if (!accounts.data) return [];
    const analyticsMap = new Map(
      (data?.accounts ?? []).map((a) => [a.account_id, a]),
    );
    return accounts.data.accounts.map((acc) => {
      const analytic = analyticsMap.get(acc.id);
      return {
        account_id: acc.id,
        name: acc.name,
        type: acc.type as "asset" | "liability",
        archived_on: acc.archived_on,
        current_balance: acc.balance,
        current_balance_date: acc.as_of,
        comparison_balance: analytic?.comparison_balance ?? acc.balance,
        comparison_balance_date: analytic?.comparison_balance_date ?? acc.as_of,
        contribution_change: analytic?.contribution_change ?? "0.00",
        composition_percent: analytic?.composition_percent ?? "0.00",
        balance_state: acc.balance_state ?? "normal",
        currency: acc.currency ?? data?.currency ?? "USD",
        subtype: acc.subtype ?? "other",
        opening_balance: acc.opening_balance ?? "0.00",
        opening_date: acc.opening_date ?? "",
      };
    });
  }, [data, accounts.data]);

  const augmentedData = useMemo(() => {
    if (!data) return null;
    return {
      ...data,
      accounts: analyticsWithOpening,
    };
  }, [data, analyticsWithOpening]);

  if (
    (overview.status === "error" && !data) ||
    (accounts.status === "error" && !accounts.data)
  ) {
    return (
      <ErrorBanner
        message={
          (overview.error ?? accounts.error)?.message ??
          t("common.errorFallback")
        }
      />
    );
  }

  if (!data || !accounts.data || !augmentedData) {
    return (
      <Panel title={t("netWorth.loading")} detail={t("netWorth.loadingDetail")}>
        <p>{t("common.loading")}</p>
      </Panel>
    );
  }

  const accountCount =
    data.summary.active_account_count + data.summary.archived_account_count;
  const resolvedCount =
    data.coverage?.resolved_account_count ??
    data.summary.resolved_asset_count + data.summary.resolved_liability_count;
  const activeAccounts = analyticsWithOpening.filter(
    (account) => !account.archived_on,
  );

  const pending = overview.status === "loading";

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
          accountCount ? (
            <div className="wealth-header-actions">
              <ActionButton
                icon={WalletCards}
                onClick={() => setDialog({ kind: "checkIn" })}
              >
                {t("netWorth.actions.updateBalances")}
              </ActionButton>
              <ActionButton
                icon={Plus}
                variant="secondary"
                onClick={() => setDialog({ kind: "add" })}
              >
                {t("netWorth.actions.addAccount")}
              </ActionButton>
            </div>
          ) : null
        }
      />

      {overview.status === "error" ? (
        <ErrorBanner
          message={overview.error.message}
          onRetry={overview.refetch}
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
        <>
          <WealthOverview
            data={augmentedData}
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

          <Panel
            title={t("accounts.provenanceTitle")}
            detail={t("accounts.provenanceDetail")}
          >
            <dl className="inspector-summary">
              <div>
                <dt>{t("accounts.cashflowChange")}</dt>
                <dd>{money(data.attribution.cashflow)}</dd>
              </div>
              <div>
                <dt>{t("accounts.adjustmentChange")}</dt>
                <dd>{money(data.attribution.adjustments)}</dd>
              </div>
              <div>
                <dt>{t("accounts.transferChange")}</dt>
                <dd>{money(data.attribution.transfers)}</dd>
              </div>
            </dl>
          </Panel>
        </>
      )}

      {accountCount > 0 ? (
        <PortfolioWorkspace
          data={augmentedData}
          includeArchived={includeArchived}
          onIncludeArchived={setIncludeArchived}
          onUpdate={(account) =>
            setDialog({
              kind: "balance",
              account: toAccountRecord(account, augmentedData),
            })
          }
          onManage={(account) =>
            setDialog({
              kind: "inspector",
              account: toAccountRecord(account, augmentedData),
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
    </div>
  );
}

function useAccounts(asOf: string, refreshKey: number) {
  const load = useCallback(
    (signal: AbortSignal) =>
      api.accounts(
        { as_of: asOf || undefined, include_archived: true },
        signal,
      ),
    [asOf],
  );
  return useResource(load, `accounts:${asOf}:${refreshKey}`, {
    cacheKey: `accounts:${asOf}:${refreshKey}`,
    retainData: true,
  });
}

function readUrlState() {
  const params = new URLSearchParams(window.location.search);
  const parsedMonths = Number(params.get("months") ?? "12");
  return {
    asOf: params.get("as_of") ?? "",
    months: parsedMonths >= 1 && parsedMonths <= 120 ? parsedMonths : 12,
  };
}
