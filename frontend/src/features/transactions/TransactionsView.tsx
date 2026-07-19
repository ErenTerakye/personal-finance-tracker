import {
  type FormEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import "./transactions-components.css";
import "./transactions.css";
import "./transactions-overrides.css";
import "./components/TransactionFormDialog.css";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRightLeft,
  Check,
  Download,
  ListFilter,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Scale,
  Search,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { artifactUrls } from "../../api/artifacts";
import { api, type ActivityFilters } from "../../api/client";
import {
  ActionButton,
  DownloadLink,
  SubmitButton,
} from "../../shared/components/actions";
import { CsvImportDialog } from "../../shared/components/CsvImportDialog";
import { ModalDialog } from "../../shared/components/dialogs";
import { ErrorBanner } from "../../shared/components/feedback";
import { Field, FilterBar } from "../../shared/components/fields";
import { PageHeader } from "../../shared/components/lists";
import { PeriodControl } from "../../shared/components/PeriodControl";
import {
  absoluteMoney,
  compareMoney,
  currencySymbol,
  money,
  negateMoney,
  subtractMoney,
  sumMoney,
} from "../../shared/format/money";
import { todayIso } from "../../shared/format/dates";
import { useResource } from "../../shared/hooks/useResource";
import { localizedNotice } from "../../shared/i18n/notices";
import { useI18n } from "../../shared/i18n/I18nProvider";
import type {
  AccountRecord,
  ActivityInput,
  ActivityKind,
  ActivityRecord,
} from "../../types";
import {
  preloadActivities,
  useActivities,
  useActivityImport,
  useActivityPreview,
  useDeleteActivity,
  useSaveActivity,
} from "./useTransactions";
import { ActivityLedger } from "./components/ActivityLedger";
import { normalizeAmountDraft } from "./transactionForm";

type EditableKind = "income" | "expense" | "transfer" | "adjustment";
type Draft = {
  kind: EditableKind;
  amount: string;
  category: string;
  description: string;
  date: string;
  accountId: string;
  fromAccountId: string;
  toAccountId: string;
};

const emptyDraft = (): Draft => ({
  kind: "expense",
  amount: "",
  category: "",
  description: "",
  date: todayIso(),
  accountId: "",
  fromAccountId: "",
  toAccountId: "",
});

export function preloadTransactionsView(period: {
  month: number;
  year: number;
}) {
  return preloadActivities({ month: period.month, year: period.year });
}

export function TransactionsView({
  selectedPeriod,
  setNotice,
  createRequestId = 0,
  locationVersion = 0,
}: {
  selectedPeriod: { month: number; year: number };
  setNotice: (notice: string) => void;
  createRequestId?: number;
  locationVersion?: number;
}) {
  const { t } = useI18n();
  const [filters, setFilters] = useState<ActivityFilters>(() =>
    filtersFromUrl(selectedPeriod),
  );
  const [dialog, setDialog] = useState<"create" | "edit" | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ActivityRecord | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return (
      params.has("kind") || params.has("account_id") || params.has("search")
    );
  });
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const commandBarRef = useRef<HTMLDivElement>(null);
  const commandBarScrollAnchor = useRef<{
    top: number;
    periodKey: string;
  } | null>(null);
  const handledCreate = useRef(0);
  const resource = useActivities(filters);
  const accounts = useActiveAccounts();
  const records = resource.data?.activities;

  const requestedPeriod = {
    month: Number(filters.month || selectedPeriod.month),
    year: Number(filters.year || selectedPeriod.year),
  };
  const requestedPeriodKey = activityPeriodKey(requestedPeriod);

  const save = useSaveActivity((response) => {
    setNotice(localizedNotice(response, t));
    setDialog(null);
    setDraft(emptyDraft());
    setEditingId(null);
    resource.refetch();
    accounts.refetch();
  });
  const remove = useDeleteActivity((response) => {
    setNotice(localizedNotice(response, t));
    setDeleteTarget(null);
    resource.refetch();
    accounts.refetch();
  });
  const preview = useActivityPreview();
  const importMutation = useActivityImport((response) => {
    setNotice(localizedNotice(response, t));
    preview.reset();
    resource.refetch();
    accounts.refetch();
  });

  const openCreate = useCallback(() => {
    const accountFromUrl =
      new URLSearchParams(window.location.search).get("account_id") ?? "";
    setDraft({ ...emptyDraft(), accountId: accountFromUrl });
    setEditingId(null);
    save.reset();
    setDialog("create");
  }, [save]);

  useEffect(() => {
    if (createRequestId <= handledCreate.current) return;
    handledCreate.current = createRequestId;
    openCreate();
  }, [createRequestId, openCreate]);

  useEffect(() => {
    const next = filtersFromUrl(selectedPeriod);
    const shouldImport =
      new URLSearchParams(window.location.search).get("data") === "import";
    let current = true;
    queueMicrotask(() => {
      if (!current) return;
      setFilters(next);
      setImportOpen(shouldImport);
    });
    return () => {
      current = false;
    };
  }, [locationVersion, selectedPeriod]);

  useEffect(() => {
    const close = () => {
      setDialog(null);
      setDeleteTarget(null);
      setImportOpen(false);
    };
    window.addEventListener("finance-tracker:route-leave", close);
    return () =>
      window.removeEventListener("finance-tracker:route-leave", close);
  }, []);

  useLayoutEffect(() => {
    const anchor = commandBarScrollAnchor.current;
    if (!anchor || anchor.periodKey !== requestedPeriodKey) return;

    restoreTransactionScrollAnchor(commandBarRef.current, anchor.top);
    if (resource.status !== "success") return;

    let finalFrame = 0;
    const settleFrame = window.requestAnimationFrame(() => {
      restoreTransactionScrollAnchor(commandBarRef.current, anchor.top);
      finalFrame = window.requestAnimationFrame(() => {
        restoreTransactionScrollAnchor(commandBarRef.current, anchor.top);
        if (commandBarScrollAnchor.current === anchor) {
          commandBarScrollAnchor.current = null;
        }
      });
    });
    return () => {
      window.cancelAnimationFrame(settleFrame);
      window.cancelAnimationFrame(finalFrame);
    };
  }, [resource.status, requestedPeriodKey]);

  function updateFilters(next: ActivityFilters) {
    const periodChanged =
      Number(next.month) !== Number(filters.month) ||
      Number(next.year) !== Number(filters.year);
    const commandBar = commandBarRef.current;
    if (periodChanged && commandBar && window.scrollY > 0) {
      commandBarScrollAnchor.current = {
        top: commandBar.getBoundingClientRect().top,
        periodKey: activityPeriodKey({
          month: Number(next.month),
          year: Number(next.year),
        }),
      };
    }
    setFilters(next);
    writeFilters(next);
  }

  function openEdit(record: ActivityRecord) {
    if (record.kind === "opening") return;
    setDraft({
      kind: record.kind as EditableKind,
      amount: record.amount,
      category: record.category ?? "",
      description: record.description,
      date: record.date,
      accountId: String(record.account?.id ?? ""),
      fromAccountId: String(record.from_account?.id ?? ""),
      toAccountId: String(record.to_account?.id ?? ""),
    });
    setEditingId(record.id);
    save.reset();
    setDialog("edit");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void save.mutate({
      id: dialog === "edit" ? (editingId ?? undefined) : undefined,
      payload: payloadFromDraft(draft),
    });
  }

  function clearSearchAndFilters() {
    const next = {
      month: selectedPeriod.month,
      year: selectedPeriod.year,
      kind: "" as const,
      account_id: "" as const,
      search: "",
    };
    updateFilters(next);
  }

  const activeAccountsList = accounts.data?.accounts ?? [];

  const visibleRecords = useMemo(() => {
    const list = [...(records ?? [])];
    return list.sort((a, b) => {
      const byDate = b.date.localeCompare(a.date) || b.id - a.id;
      return sort === "oldest" ? -byDate : byDate;
    });
  }, [records, sort]);

  const activitySummary = useMemo(() => {
    return {
      income: sumMoney(
        visibleRecords
          .filter((record) => record.kind === "income")
          .map((record) => record.amount),
      ),
      expenses: sumMoney(
        visibleRecords
          .filter((record) => record.kind === "expense")
          .map((record) => record.amount),
      ),
    };
  }, [visibleRecords]);
  const netActivity = subtractMoney(
    activitySummary.income,
    activitySummary.expenses,
  );
  const netDirection = compareMoney(netActivity, 0);

  const detailLabel =
    resource.status === "loading"
      ? t("transactions.historyDetail.loading")
      : t("transactions.historyDetail.count", {
          count: visibleRecords.length,
        });

  const activeFilterLabels = [
    Number(filters.month) !== selectedPeriod.month ||
    Number(filters.year) !== selectedPeriod.year
      ? `${filters.year}-${String(filters.month).padStart(2, "0")}`
      : null,
    filters.kind
      ? `${t("activity.kind")}: ${t(`activity.kinds.${filters.kind}`)}`
      : null,
    filters.account_id
      ? `${t("activity.account")}: ${activeAccountsList.find((a) => a.id === filters.account_id)?.name || filters.account_id}`
      : null,
  ].filter((label): label is string => Boolean(label));

  const hasActiveFilters = Boolean(
    (filters.search && filters.search.trim()) ||
    filters.kind ||
    filters.account_id ||
    Number(filters.month) !== selectedPeriod.month ||
    Number(filters.year) !== selectedPeriod.year,
  );

  return (
    <div className="transactions-period-view">
      <PageHeader
        eyebrow={t("activity.eyebrow")}
        title={t("activity.title")}
        summary={t("activity.summary", {
          count: resource.data?.page?.total ?? records?.length ?? 0,
        })}
        className="activity-hero"
        actions={
          <div className="activity-hero-actions">
            <ActionButton icon={Plus} onClick={openCreate}>
              {t("activity.add")}
            </ActionButton>
            <details className="data-menu">
              <summary className="button secondary">
                <MoreHorizontal aria-hidden="true" size={18} />
                <span>{t("transactions.dataMenu")}</span>
              </summary>
              <div className="data-menu-popover">
                <ActionButton
                  icon={Upload}
                  variant="ghost"
                  onClick={() => setImportOpen(true)}
                >
                  {t("common.importCsv")}
                </ActionButton>
                <DownloadLink
                  icon={Download}
                  href={artifactUrls.activitiesCsv(filters)}
                  download
                  variant="ghost"
                >
                  {t("common.exportCsv")}
                </DownloadLink>
                <p>{t("transactions.exportScope")}</p>
              </div>
            </details>
          </div>
        }
      />

      {resource.status === "error" ? (
        <ErrorBanner
          message={resource.error.message}
          onRetry={resource.refetch}
        />
      ) : null}

      <section className="activity-workspace" aria-label={t("activity.title")}>
        <section
          className="activity-snapshot"
          aria-label={t("transactions.snapshot.title")}
        >
          <article className="activity-stat income">
            <span className="activity-stat-icon">
              <ArrowDownLeft aria-hidden="true" size={20} />
            </span>
            <div>
              <span>{t("transactions.snapshot.income")}</span>
              <strong>{money(activitySummary.income)}</strong>
            </div>
          </article>
          <article className="activity-stat expense">
            <span className="activity-stat-icon">
              <ArrowUpRight aria-hidden="true" size={20} />
            </span>
            <div>
              <span>{t("transactions.snapshot.expenses")}</span>
              <strong>{money(activitySummary.expenses)}</strong>
            </div>
          </article>
          <article
            className={`activity-stat net ${netDirection < 0 ? "negative" : "positive"}`}
          >
            <span className="activity-stat-icon">
              <Scale aria-hidden="true" size={20} />
            </span>
            <div>
              <span>{t("transactions.snapshot.net")}</span>
              <strong>
                {netDirection > 0 ? "+" : netDirection < 0 ? "−" : ""}
                {money(absoluteMoney(netActivity))}
              </strong>
            </div>
          </article>
        </section>

        <div className="activity-command-bar" ref={commandBarRef}>
          <div className="transaction-search">
            <label htmlFor="activity-search">{t("activity.search")}</label>
            <div className="search-control">
              <Search size={18} aria-hidden="true" />
              <input
                id="activity-search"
                type="search"
                placeholder={t("transactions.historyDetail.searchPlaceholder")}
                value={filters.search ?? ""}
                onChange={(event) =>
                  updateFilters({ ...filters, search: event.target.value })
                }
              />
            </div>
          </div>
          <div className="transaction-filter-toggle-container">
            <button
              className="button secondary transaction-filter-toggle"
              type="button"
              aria-expanded={filtersOpen}
              onClick={() => setFiltersOpen((open) => !open)}
            >
              <ListFilter aria-hidden="true" size={18} />
              <span>{t("transactions.filters.open")}</span>
            </button>
          </div>
          {filtersOpen ? (
            <div className="transaction-filter-panel">
              <FilterBar
                title={t("activity.filters")}
                summary={t("activity.filtersSummary")}
              >
                <form
                  className="filter-form"
                  onSubmit={(event) => event.preventDefault()}
                >
                  <PeriodControl
                    label={t("transactions.filterPeriod")}
                    value={requestedPeriod}
                    onChange={(nextPeriod) =>
                      updateFilters({ ...filters, ...nextPeriod })
                    }
                  />
                  <Field id="filter-kind" label={t("activity.kind")}>
                    <select
                      id="filter-kind"
                      value={filters.kind ?? ""}
                      onChange={(event) =>
                        updateFilters({
                          ...filters,
                          kind: event.target.value as ActivityKind | "",
                        })
                      }
                    >
                      <option value="">{t("common.all")}</option>
                      {(
                        [
                          "opening",
                          "income",
                          "expense",
                          "transfer",
                          "adjustment",
                        ] as const
                      ).map((kind) => (
                        <option key={kind} value={kind}>
                          {t(`activity.kinds.${kind}`)}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field id="filter-account" label={t("activity.account")}>
                    <select
                      id="filter-account"
                      value={filters.account_id ?? ""}
                      onChange={(event) =>
                        updateFilters({
                          ...filters,
                          account_id: event.target.value
                            ? Number(event.target.value)
                            : "",
                        })
                      }
                    >
                      <option value="">{t("common.all")}</option>
                      {activeAccountsList.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <div className="filter-actions">
                    <ActionButton
                      icon={RotateCcw}
                      variant="ghost"
                      disabled={!hasActiveFilters}
                      onClick={clearSearchAndFilters}
                    >
                      {t("common.resetFilters")}
                    </ActionButton>
                  </div>
                </form>
              </FilterBar>
            </div>
          ) : null}
          {activeFilterLabels.length > 0 ? (
            <div className="active-filter-summary">
              {activeFilterLabels.map((label) => (
                <span className="filter-chip" key={label}>
                  {label}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <div className="activity-ledger">
          <header className="activity-ledger-header">
            <div>
              <h2>{t("activity.ledger")}</h2>
              <p>{detailLabel}</p>
            </div>
            <div className="activity-sort">
              <span>{t("transactions.historyDetail.sortLabel")}</span>
              <select
                value={sort}
                onChange={(event) =>
                  setSort(event.target.value as "newest" | "oldest")
                }
              >
                <option value="newest">{t("transactions.sort.newest")}</option>
                <option value="oldest">{t("transactions.sort.oldest")}</option>
              </select>
            </div>
          </header>
          <div className="activity-ledger-body">
            <ActivityLedger
              records={visibleRecords}
              onEdit={openEdit}
              onDelete={(record) => setDeleteTarget(record)}
              onAccount={(id) => updateFilters({ ...filters, account_id: id })}
              onClear={clearSearchAndFilters}
              filtered={hasActiveFilters}
              onCreate={openCreate}
            />
          </div>
        </div>
      </section>

      <ActivityDialog
        open={dialog !== null}
        mode={dialog ?? "create"}
        draft={draft}
        accounts={activeAccountsList}
        error={save.status === "error" ? save.error.message : ""}
        saving={save.status === "pending"}
        onChange={setDraft}
        onClose={() => setDialog(null)}
        onSubmit={submit}
      />

      <ModalDialog
        open={deleteTarget !== null}
        title={t("activity.deleteTitle")}
        description={t("activity.deleteDescription")}
        onClose={() => setDeleteTarget(null)}
      >
        {remove.status === "error" ? (
          <ErrorBanner message={remove.error.message} />
        ) : null}
        <div className="dialog-actions">
          <button
            className="button secondary"
            type="button"
            onClick={() => setDeleteTarget(null)}
          >
            {t("common.cancel")}
          </button>
          <button
            className="button danger"
            type="button"
            disabled={remove.status === "pending"}
            onClick={() => deleteTarget && void remove.mutate(deleteTarget.id)}
          >
            <Trash2 aria-hidden="true" size={18} /> {t("common.delete")}
          </button>
        </div>
      </ModalDialog>

      <CsvImportDialog
        open={importOpen}
        title={t("activity.importTitle")}
        description={t("activity.importDescription")}
        result={importMutation.data ?? null}
        preview={preview.data ?? null}
        error={
          preview.status === "error"
            ? preview.error.message
            : importMutation.status === "error"
              ? importMutation.error.message
              : ""
        }
        uploading={importMutation.status === "pending"}
        previewing={preview.status === "pending"}
        onClose={() => setImportOpen(false)}
        onPreview={(text) => preview.mutate(text)}
        onImport={(csvText, allowDuplicates = false) =>
          importMutation.mutate({ csvText, allowDuplicates })
        }
        onReset={() => {
          preview.reset();
          importMutation.reset();
        }}
      />
    </div>
  );
}

function ActivityDialog({
  open,
  mode,
  draft,
  accounts,
  error,
  saving,
  onChange,
  onClose,
  onSubmit,
}: {
  open: boolean;
  mode: "create" | "edit";
  draft: Draft;
  accounts: AccountRecord[];
  error: string;
  saving: boolean;
  onChange: (draft: Draft) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const { t } = useI18n();
  const errorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);
  const projection = useMemo(
    () => projectedEffects(draft, accounts),
    [draft, accounts],
  );
  const kindLocked =
    mode === "edit" && ["transfer", "adjustment"].includes(draft.kind);
  return (
    <ModalDialog
      open={open}
      title={mode === "edit" ? t("activity.editTitle") : t("activity.add")}
      description={t("activity.formDescription")}
      onClose={onClose}
      initialFocusId="activity-amount"
      className="entry-dialog activity-composer-dialog"
    >
      {error ? (
        <div ref={errorRef} tabIndex={-1}>
          <ErrorBanner message={error} />
        </div>
      ) : null}
      <form className="activity-composer-form" onSubmit={onSubmit}>
        <div className="activity-composer-body">
          <div className="activity-composer-fields">
            <section
              className="entry-amount-stage"
              style={{ marginInline: 0, marginBlockEnd: "1rem" }}
            >
              <div className="entry-amount-heading">
                <label htmlFor="activity-amount">{t("common.amount")}</label>
              </div>
              <div className="entry-amount-control">
                <span className="entry-currency" aria-hidden="true">
                  {currencySymbol()}
                </span>
                <input
                  id="activity-amount"
                  required
                  inputMode="decimal"
                  pattern="[0-9]+(?:\.[0-9]{1,2})?"
                  placeholder="0.00"
                  value={draft.amount}
                  onChange={(event) => {
                    const amount = normalizeAmountDraft(event.target.value);
                    if (amount !== null) {
                      onChange({ ...draft, amount });
                    } else {
                      event.target.value = draft.amount;
                    }
                  }}
                />
              </div>
            </section>
            {mode === "create" ? (
              <fieldset
                className="entry-kind-picker"
                style={{ paddingInline: 0, border: 0, marginBlock: 0 }}
              >
                <legend
                  style={{
                    paddingBlockStart: 0,
                    marginBlockEnd: "0.55rem",
                    fontSize: "var(--font-size-sm)",
                    fontWeight: "var(--font-weight-semibold)",
                  }}
                >
                  {t("activity.chooseKind")}
                </legend>
                <div className="entry-kind-options">
                  {(
                    ["income", "expense", "transfer", "adjustment"] as const
                  ).map((kind) => {
                    const Icon =
                      kind === "income"
                        ? ArrowDownLeft
                        : kind === "expense"
                          ? ArrowUpRight
                          : kind === "transfer"
                            ? ArrowRightLeft
                            : Scale;
                    return (
                      <label key={kind} className={`entry-kind-option ${kind}`}>
                        <input
                          type="radio"
                          name="activity-kind"
                          value={kind}
                          checked={draft.kind === kind}
                          aria-label={t(`activity.kinds.${kind}`)}
                          onChange={() => onChange({ ...draft, kind })}
                        />
                        <span className="entry-kind-card">
                          <span className="entry-kind-icon" aria-hidden="true">
                            <Icon size={20} strokeWidth={2.2} />
                          </span>
                          <span className="entry-kind-copy">
                            <strong>{t(`activity.kinds.${kind}`)}</strong>
                            <small>
                              {t(`activity.kindsDescription.${kind}`)}
                            </small>
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            ) : kindLocked ? (
              <Field id="activity-kind-readonly" label={t("activity.kind")}>
                <input
                  id="activity-kind-readonly"
                  readOnly
                  disabled
                  value={t(`activity.kinds.${draft.kind}`)}
                />
              </Field>
            ) : (
              <fieldset
                className="entry-kind-picker"
                style={{ paddingInline: 0, border: 0, marginBlock: 0 }}
              >
                <legend
                  style={{
                    paddingBlockStart: 0,
                    marginBlockEnd: "0.55rem",
                    fontSize: "var(--font-size-sm)",
                    fontWeight: "var(--font-weight-semibold)",
                  }}
                >
                  {t("activity.chooseKind")}
                </legend>
                <div className="entry-kind-options">
                  {(["income", "expense"] as const).map((kind) => {
                    const Icon =
                      kind === "income" ? ArrowDownLeft : ArrowUpRight;
                    return (
                      <label key={kind} className={`entry-kind-option ${kind}`}>
                        <input
                          type="radio"
                          name="activity-kind"
                          value={kind}
                          checked={draft.kind === kind}
                          aria-label={t(`activity.kinds.${kind}`)}
                          onChange={() => onChange({ ...draft, kind })}
                        />
                        <span className="entry-kind-card">
                          <span className="entry-kind-icon" aria-hidden="true">
                            <Icon size={20} strokeWidth={2.2} />
                          </span>
                          <span className="entry-kind-copy">
                            <strong>{t(`activity.kinds.${kind}`)}</strong>
                            <small>
                              {t(`activity.kindsDescription.${kind}`)}
                            </small>
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            )}
            {draft.kind === "transfer" ? (
              <fieldset>
                <legend>{t("activity.transferAccounts")}</legend>
                <Field id="activity-from" label={t("activity.fromAccount")}>
                  <AccountSelect
                    id="activity-from"
                    value={draft.fromAccountId}
                    accounts={accounts}
                    onChange={(value) =>
                      onChange({ ...draft, fromAccountId: value })
                    }
                  />
                </Field>
                <Field id="activity-to" label={t("activity.toAccount")}>
                  <AccountSelect
                    id="activity-to"
                    value={draft.toAccountId}
                    accounts={accounts}
                    exclude={draft.fromAccountId}
                    onChange={(value) =>
                      onChange({ ...draft, toAccountId: value })
                    }
                  />
                </Field>
              </fieldset>
            ) : (
              <Field id="activity-account-select" label={t("activity.account")}>
                <AccountSelect
                  id="activity-account-select"
                  value={draft.accountId}
                  accounts={accounts}
                  onChange={(value) => onChange({ ...draft, accountId: value })}
                />
              </Field>
            )}
            {draft.kind === "income" || draft.kind === "expense" ? (
              <Field id="activity-category" label={t("common.category")}>
                <input
                  id="activity-category"
                  required
                  value={draft.category}
                  onChange={(event) =>
                    onChange({ ...draft, category: event.target.value })
                  }
                />
              </Field>
            ) : null}
            <Field id="activity-date" label={t("common.date")}>
              <input
                id="activity-date"
                type="date"
                required
                value={draft.date}
                onChange={(event) =>
                  onChange({ ...draft, date: event.target.value })
                }
              />
            </Field>
            <Field id="activity-description" label={t("common.description")}>
              <input
                id="activity-description"
                maxLength={500}
                value={draft.description}
                onChange={(event) =>
                  onChange({ ...draft, description: event.target.value })
                }
              />
            </Field>
          </div>
          <aside className="activity-composer-guide">
            <div
              className="account-setup-guide-icon"
              style={{
                color: "var(--action)",
                background:
                  "color-mix(in srgb, var(--action) 10%, var(--surface))",
                display: "grid",
                placeItems: "center",
                inlineSize: "2.75rem",
                blockSize: "2.75rem",
                borderRadius: "0.8rem",
                marginBlockEnd: "0.5rem",
              }}
              aria-hidden="true"
            >
              <Sparkles size={22} />
            </div>
            <h3
              style={{
                fontSize: "var(--font-size-lg)",
                fontWeight: "var(--font-weight-semibold)",
                marginBlockEnd: "0.5rem",
                color: "var(--ink)",
              }}
            >
              {t("activity.projected")}
            </h3>
            {projection.length ? (
              <ol
                style={{
                  display: "grid",
                  gap: "0.75rem",
                  margin: 0,
                  padding: 0,
                  listStyle: "none",
                }}
              >
                {projection.map((item, index) => (
                  <li
                    key={index}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "auto minmax(0, 1fr)",
                      alignItems: "start",
                      gap: "0.55rem",
                      color: "var(--muted)",
                      fontSize: "var(--font-size-sm)",
                    }}
                  >
                    <Check
                      size={16}
                      style={{
                        color: "var(--cash)",
                        flexShrink: 0,
                        marginBlockStart: "0.15rem",
                      }}
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p
                style={{
                  color: "var(--muted)",
                  fontSize: "var(--font-size-sm)",
                  margin: 0,
                }}
              >
                {t("activity.completeFields")}
              </p>
            )}
          </aside>
        </div>
        <footer className="activity-composer-actions">
          <div className="entry-actions">
            <button
              className="button secondary"
              type="button"
              onClick={onClose}
            >
              {t("common.cancel")}
            </button>
            <SubmitButton
              busy={saving}
              icon={draft.kind === "transfer" ? ArrowRightLeft : Plus}
            >
              {mode === "edit" ? t("common.save") : t("activity.add")}
            </SubmitButton>
          </div>
        </footer>
      </form>
    </ModalDialog>
  );
}

function AccountSelect({
  id,
  value,
  accounts,
  exclude,
  onChange,
}: {
  id: string;
  value: string;
  accounts: AccountRecord[];
  exclude?: string;
  onChange: (value: string) => void;
}) {
  const { t } = useI18n();
  return (
    <select
      id={id}
      required
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">{t("activity.chooseAccount")}</option>
      {accounts
        .filter(
          (account) => String(account.id) !== exclude && !account.archived_on,
        )
        .map((account) => (
          <option key={account.id} value={account.id}>
            {account.name} · {money(account.balance)}
          </option>
        ))}
    </select>
  );
}

function payloadFromDraft(draft: Draft): ActivityInput {
  const common = {
    amount: draft.amount,
    description: draft.description,
    date: draft.date,
  };
  if (draft.kind === "transfer") {
    return {
      kind: "transfer",
      ...common,
      from_account_id: Number(draft.fromAccountId),
      to_account_id: Number(draft.toAccountId),
    };
  }
  if (draft.kind === "adjustment") {
    return {
      kind: "adjustment",
      ...common,
      account_id: Number(draft.accountId),
    };
  }
  return {
    kind: draft.kind,
    ...common,
    category: draft.category,
    account_id: Number(draft.accountId),
  };
}

function projectedEffects(draft: Draft, accounts: AccountRecord[]) {
  if (!/^-?\d+(?:\.\d{0,2})?$/.test(draft.amount)) return [];
  const amount = draft.amount;
  const byId = new Map(
    accounts.map((account) => [String(account.id), account]),
  );
  if (draft.kind === "transfer") {
    const source = byId.get(draft.fromAccountId);
    const destination = byId.get(draft.toAccountId);
    if (!source || !destination) return [];
    const sourceDelta = source.type === "asset" ? negateMoney(amount) : amount;
    const destinationDelta =
      destination.type === "asset" ? amount : negateMoney(amount);
    return [
      `${source.name}: ${money(source.balance)} → ${money(sumMoney([source.balance, sourceDelta]))}`,
      `${destination.name}: ${money(destination.balance)} → ${money(sumMoney([destination.balance, destinationDelta]))}`,
      "Net worth 0.00 · Cashflow 0.00",
    ];
  }
  const account = byId.get(draft.accountId);
  if (!account) return [];
  if (draft.kind === "adjustment") {
    const change = subtractMoney(amount, account.balance);
    const netWorth = account.type === "asset" ? change : negateMoney(change);
    return [
      `${account.name}: ${money(account.balance)} → ${money(amount)}`,
      `Net worth ${money(netWorth)} · Cashflow 0.00`,
    ];
  }
  const economic = draft.kind === "income" ? amount : negateMoney(amount);
  const delta = account.type === "asset" ? economic : negateMoney(economic);
  return [
    `${account.name}: ${money(account.balance)} → ${money(sumMoney([account.balance, delta]))}`,
    `Net worth ${money(economic)} · Cashflow ${money(economic)}`,
  ];
}

function useActiveAccounts() {
  const load = useCallback(
    (signal: AbortSignal) => api.accounts({}, signal),
    [],
  );
  return useResource(load, "activity-accounts", {
    cacheKey: "activity-accounts",
    retainData: true,
  });
}

function filtersFromUrl(period: {
  month: number;
  year: number;
}): ActivityFilters {
  const params = new URLSearchParams(window.location.search);
  const kind = params.get("kind") as ActivityKind | null;
  const account = Number(params.get("account_id"));
  return {
    month: Number(params.get("month")) || period.month,
    year: Number(params.get("year")) || period.year,
    kind: kind ?? "",
    account_id: account > 0 ? account : "",
    search: params.get("search") ?? "",
  };
}

function writeFilters(filters: ActivityFilters) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== "" && value !== undefined) params.set(key, String(value));
  });
  window.history.replaceState(
    {},
    "",
    `/activity${params.size ? `?${params}` : ""}`,
  );
}

function activityPeriodKey(period: { month: number; year: number }) {
  return `${period.year}-${period.month}`;
}

function restoreTransactionScrollAnchor(
  commandBar: HTMLElement | null,
  expectedTop: number,
) {
  if (!commandBar) return;
  const offset = commandBar.getBoundingClientRect().top - expectedTop;
  if (Math.abs(offset) < 0.5) return;
  window.scrollTo({
    top: window.scrollY + offset,
    behavior: "instant",
  });
}
