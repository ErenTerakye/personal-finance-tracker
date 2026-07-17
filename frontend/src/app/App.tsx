import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { flushSync } from "react-dom";
import { House } from "lucide-react";
import { AppShell } from "./AppShell";
import { currentPeriod } from "../shared/format/periods";
import { setCurrency } from "../shared/format/money";
import {
  pathForView,
  resolveRoute,
  viewMeta,
  type ManageView,
  type RouteView,
  type View,
} from "./routes";
import { I18nProvider, useI18n } from "../shared/i18n/I18nProvider";
import { ActionButton } from "../shared/components/actions";
import { PageHeader } from "../shared/components/lists";
import { useAppSettings } from "./useAppSettings";
import type { BudgetReviewTarget } from "../shared/components/lists";
import { cancelActiveViewTransition } from "../shared/motion/viewTransitions";

const DashboardView = lazy(async () => {
  const module = await import("../features/dashboard/DashboardView");
  return { default: module.DashboardView };
});
const ManageView = lazy(async () => {
  const module = await import("../features/manage/ManageView");
  return { default: module.ManageView };
});
const NetWorthView = lazy(async () => {
  const module = await import("../features/net-worth/NetWorthView");
  return { default: module.NetWorthView };
});
const TransactionsView = lazy(async () => {
  const module = await import("../features/transactions/TransactionsView");
  return { default: module.TransactionsView };
});
const BudgetsView = lazy(async () => {
  const module = await import("../features/budgets/BudgetsView");
  return { default: module.BudgetsView };
});

function AppContent() {
  const { t, locale, tUpper } = useI18n();
  const [view, setView] = useState<RouteView>(
    () => resolveRoute(window.location.pathname, window.location.search).view,
  );
  const [selectedPeriod, setSelectedPeriod] = useState(periodFromUrl);
  const [notice, setNotice] = useState("");
  const [createTransactionRequest, setCreateTransactionRequest] = useState(0);
  const [createBudgetRequest, setCreateBudgetRequest] = useState(0);
  const [routeFocusRequest, setRouteFocusRequest] = useState(0);
  const [locationVersion, setLocationVersion] = useState(0);
  const mainRef = useRef<HTMLElement | null>(null);
  const viewRef = useRef<RouteView>(view);
  const settings = useAppSettings();

  useEffect(() => {
    normalizeCompatibilityRoute();
  }, []);

  useEffect(() => {
    if (settings.status === "success") {
      setCurrency(settings.data.currency);
    }
  }, [settings.status, settings.data]);

  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  useEffect(() => {
    const title =
      view === "not-found" ? t("notFound.eyebrow") : t(viewMeta[view].titleKey);
    document.title = `${title} | Personal Finance Tracker`;
  }, [view, locale, t]);

  function commitRoute(
    nextView: RouteView,
    {
      afterCommit,
      focus = true,
    }: { afterCommit?: () => void; focus?: boolean } = {},
  ) {
    const routeChanged = nextView !== viewRef.current;
    if (!routeChanged) {
      if (afterCommit) queueMicrotask(afterCommit);
      return;
    }
    cancelActiveViewTransition();
    flushSync(() => {
      if (nextView !== "transactions") setCreateTransactionRequest(0);
      if (nextView !== "budgets") setCreateBudgetRequest(0);
      setNotice("");
      viewRef.current = nextView;
      setView(nextView);
      if (focus) setRouteFocusRequest((request) => request + 1);
    });
    if (afterCommit) queueMicrotask(afterCommit);
  }

  function navigate(nextView: View, afterCommit?: () => void, search = "") {
    const nextPath = `${pathForView(nextView)}${search}`;
    if (
      window.location.pathname !== pathForView(nextView) ||
      window.location.search !== search
    ) {
      window.history.pushState({}, "", nextPath);
      setLocationVersion((version) => version + 1);
    }
    setSelectedPeriod(periodFromUrl());
    commitRoute(nextView, { afterCommit });
  }

  function navigateWithParams(
    nextView: View,
    params: URLSearchParams,
    afterCommit?: () => void,
  ) {
    const query = params.toString();
    navigate(nextView, afterCommit, query ? `?${query}` : "");
  }

  function changePeriod(period: { month: number; year: number }) {
    const url = new URL(window.location.href);
    url.searchParams.set("month", String(period.month));
    url.searchParams.set("year", String(period.year));
    window.history.replaceState({}, "", `${url.pathname}${url.search}`);
    setSelectedPeriod(period);
  }

  function reviewBudget(target: BudgetReviewTarget) {
    navigateWithParams(
      "budgets",
      new URLSearchParams({
        month: String(target.month),
        year: String(target.year),
        category: target.category,
      }),
    );
  }

  function reviewTransactions({
    month = selectedPeriod.month,
    year = selectedPeriod.year,
    category = "",
    transactionType = "",
    dataAction = "",
    search = "",
  }: {
    month?: number;
    year?: number;
    category?: string;
    transactionType?: string;
    dataAction?: string;
    search?: string;
  } = {}) {
    const params = new URLSearchParams({
      month: String(month),
      year: String(year),
    });
    if (category) params.set("category", category);
    if (transactionType) params.set("transaction_type", transactionType);
    if (dataAction) params.set("data", dataAction);
    if (search) params.set("search", search);
    navigateWithParams("transactions", params);
  }

  function reviewAccounts(asOf?: string) {
    const params = new URLSearchParams();
    if (asOf) params.set("as_of", asOf);
    navigateWithParams("accounts", params);
  }

  useEffect(() => {
    function handlePopState() {
      const resolved = resolveRoute(
        window.location.pathname,
        window.location.search,
      );
      if (resolved.canonicalUrl) {
        window.history.replaceState({}, "", resolved.canonicalUrl);
      }
      setSelectedPeriod(periodFromUrl());
      commitRoute(resolved.view, { focus: resolved.view !== viewRef.current });
      setLocationVersion((version) => version + 1);
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  if (settings.status === "idle" || settings.status === "loading") {
    return <div className="app-loading">{t("common.loading")}</div>;
  }

  const routeKey = `${view}:${locationVersion}`;

  return (
    <AppShell
      view={view}
      notice={notice}
      mainRef={mainRef}
      onNavigate={navigate}
      onPrimaryAction={() => {
        if (viewRef.current === "transactions") {
          setCreateTransactionRequest((request) => request + 1);
          return;
        }
        navigate("transactions", () =>
          setCreateTransactionRequest((request) => request + 1),
        );
      }}
    >
      {view === "overview" ? (
        <RouteContent
          key={routeKey}
          fallback={<p role="status">{t("common.loading")}</p>}
          focusRequest={routeFocusRequest}
          mainRef={mainRef}
        >
          <DashboardView
            selectedPeriod={selectedPeriod}
            setSelectedPeriod={changePeriod}
            onAddTransaction={() =>
              navigate("transactions", () =>
                setCreateTransactionRequest((request) => request + 1),
              )
            }
            onReviewAccounts={reviewAccounts}
            onReviewBudget={reviewBudget}
            onReviewCategory={(category) => reviewTransactions({ category })}
            onReviewTransaction={(transaction) =>
              reviewTransactions({
                month: Number(transaction.date.slice(5, 7)),
                year: Number(transaction.date.slice(0, 4)),
                search: transaction.description || transaction.category,
              })
            }
            onViewTransactions={() => reviewTransactions()}
            onCreateBudget={() => {
              navigate("budgets", () =>
                setCreateBudgetRequest((request) => request + 1),
              );
            }}
          />
        </RouteContent>
      ) : null}
      {view === "transactions" ? (
        <RouteContent
          key={routeKey}
          fallback={<p role="status">{t("common.loading")}</p>}
          focusRequest={routeFocusRequest}
          mainRef={mainRef}
        >
          <TransactionsView
            selectedPeriod={selectedPeriod}
            setNotice={setNotice}
            createRequestId={createTransactionRequest}
          />
        </RouteContent>
      ) : null}
      {view === "accounts" ? (
        <RouteContent
          key={routeKey}
          fallback={<p role="status">{t("netWorth.loading")}</p>}
          focusRequest={routeFocusRequest}
          mainRef={mainRef}
        >
          <NetWorthView setNotice={setNotice} />
        </RouteContent>
      ) : null}
      {view === "budgets" ? (
        <RouteContent
          key={routeKey}
          fallback={<p role="status">{t("common.loading")}</p>}
          focusRequest={routeFocusRequest}
          mainRef={mainRef}
        >
          <BudgetsView
            selectedPeriod={selectedPeriod}
            setSelectedPeriod={changePeriod}
            setNotice={setNotice}
            createRequestId={createBudgetRequest}
            onReviewTransactions={(category, month, year) =>
              reviewTransactions({ category, month, year })
            }
          />
        </RouteContent>
      ) : null}
      {view.startsWith("manage") ? (
        <RouteContent
          key={routeKey}
          fallback={<p role="status">{t("common.loading")}</p>}
          focusRequest={routeFocusRequest}
          mainRef={mainRef}
        >
          <ManageView
            section={view as ManageView}
            selectedPeriod={selectedPeriod}
            setSelectedPeriod={changePeriod}
            setNotice={setNotice}
            onNavigate={navigate}
            onViewTransactions={(month, year) =>
              reviewTransactions({ month, year })
            }
            onOpenTransactionImport={() =>
              reviewTransactions({ dataAction: "import" })
            }
            onOpenBudgetImport={() => {
              const params = new URLSearchParams({
                month: String(selectedPeriod.month),
                year: String(selectedPeriod.year),
                data: "import",
              });
              navigateWithParams("budgets", params);
            }}
            onCurrencyChange={setCurrency}
          />
        </RouteContent>
      ) : null}
      {view === "not-found" ? (
        <PageHeader
          eyebrow={tUpper("notFound.eyebrow")}
          title={t("notFound.title")}
          summary={t("notFound.summary")}
          actions={
            <ActionButton icon={House} onClick={() => navigate("overview")}>
              {t("notFound.action")}
            </ActionButton>
          }
        />
      ) : null}
    </AppShell>
  );
}

function RouteContent({
  fallback,
  focusRequest,
  mainRef,
  children,
}: {
  fallback: ReactNode;
  focusRequest: number;
  mainRef: React.RefObject<HTMLElement | null>;
  children: ReactNode;
}) {
  return (
    <Suspense fallback={fallback}>
      {children}
      <RouteFocus request={focusRequest} mainRef={mainRef} />
    </Suspense>
  );
}

function RouteFocus({
  request,
  mainRef,
}: {
  request: number;
  mainRef: React.RefObject<HTMLElement | null>;
}) {
  useEffect(() => {
    if (request <= 0) return;
    const heading = mainRef.current?.querySelector<HTMLElement>("h1");
    if (heading) {
      heading.tabIndex = -1;
      heading.focus();
      return;
    }
    mainRef.current?.focus();
  }, [mainRef, request]);

  return null;
}

export default function App() {
  return (
    <I18nProvider>
      <AppContent />
    </I18nProvider>
  );
}

function normalizeCompatibilityRoute() {
  const resolved = resolveRoute(
    window.location.pathname,
    window.location.search,
  );
  if (resolved.canonicalUrl) {
    window.history.replaceState({}, "", resolved.canonicalUrl);
  }
}

function periodFromUrl(): { month: number; year: number } {
  const fallback = currentPeriod();
  const params = new URLSearchParams(window.location.search);
  const month = Number(params.get("month"));
  const year = Number(params.get("year"));
  return {
    month: month >= 1 && month <= 12 ? month : fallback.month,
    year: year >= 1 ? year : fallback.year,
  };
}
