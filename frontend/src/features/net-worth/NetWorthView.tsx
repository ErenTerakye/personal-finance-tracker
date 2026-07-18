import { CalendarDays, CircleDollarSign, WalletCards } from "lucide-react";
import "./net-worth.css";
import { useEffect, useMemo, useReducer, useState } from "react";
import { ActionButton } from "../../shared/components/actions";
import { EmptyState, ErrorBanner } from "../../shared/components/feedback";
import { PageHeader, Panel } from "../../shared/components/lists";
import { formatDate, todayIso } from "../../shared/format/dates";
import { invalidateResourceTags } from "../../shared/hooks/resourceCache";
import { resourceTags } from "../../shared/hooks/resourceKeys";
import { useI18n } from "../../shared/i18n/I18nProvider";
import { localizedNotice } from "../../shared/i18n/notices";
import { BalanceCheckInDialog } from "./BalanceCheckInDialog";
import {
  AccountInspectorDialog,
  AddAccountDialog,
  ArchiveDialog,
  BalanceDialog,
  EditAccountDialog,
  SnapshotHistoryDialog,
  toAccountRecord,
  type DialogState,
} from "./AccountLifecycleDialogs";
import { preloadNetWorthData, useNetWorthData } from "./useNetWorthData";
import {
  isSupportedNetWorthRange,
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
  const initial = useMemo(() => readUrlState(), []);
  const [asOf, setAsOf] = useState(initial.asOf);
  const [months, setMonths] = useState(initial.months);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [refreshKey, refresh] = useReducer((value: number) => value + 1, 0);
  const resource = useNetWorthData(asOf, months, includeArchived, refreshKey);

  useEffect(() => {
    const next = readUrlState();
    // Browser-history changes intentionally hydrate the feature's route state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAsOf(next.asOf);
    setMonths(next.months);
  }, [locationVersion]);

  useEffect(() => {
    const closeTransientUi = () => setDialog(null);
    window.addEventListener("finance-tracker:route-leave", closeTransientUi);
    return () =>
      window.removeEventListener(
        "finance-tracker:route-leave",
        closeTransientUi,
      );
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
    invalidateResourceTags(resourceTags.accounts, resourceTags.dashboard);
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
