import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { flushSync } from "react-dom";
import { AppShell } from "./AppShell";
import { currentPeriod } from "../shared/format/periods";
import { setCurrency } from "../shared/format/money";
import { pathForView, viewFromPath, type RouteView, type View } from "./routes";
import { I18nProvider, useI18n } from "../shared/i18n/I18nProvider";
import { ActionButton } from "../shared/components/actions";
import { PageHeader } from "../shared/components/lists";
import { LayoutDashboard } from "lucide-react";
import { useAppSettings } from "./useAppSettings";
import type { BudgetReviewTarget } from "../shared/components/lists";
import { cancelActiveViewTransition } from "../shared/motion/viewTransitions";

const initialPeriod = periodFromUrl();
const DashboardView = lazy(async () => {
  const module = await import("../features/dashboard/DashboardView");
  return { default: module.DashboardView };
});
const RulesView = lazy(async () => {
  const module = await import("../features/rules/RulesView");
  return { default: module.RulesView };
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
  const [view, setView] = useState<RouteView>(() =>
    viewFromPath(window.location.pathname),
  );
  const [selectedPeriod, setSelectedPeriod] = useState(initialPeriod);
  const [notice, setNotice] = useState("");
  const [createTransactionRequest, setCreateTransactionRequest] = useState(0);
  const [createBudgetRequest, setCreateBudgetRequest] = useState(0);
  const [createAccountRequest, setCreateAccountRequest] = useState(0);
  const [wealthHasAccounts, setWealthHasAccounts] = useState(false);
  const [routeFocusRequest, setRouteFocusRequest] = useState(0);
  const mainRef = useRef<HTMLElement | null>(null);
  const viewRef = useRef<RouteView>(view);
  const settings = useAppSettings();

  useEffect(() => {
    if (window.location.pathname === "/net-worth") {
      window.history.replaceState(
        {},
        "",
        `/${window.location.search}${window.location.hash}`,
      );
    }
  }, []);

  useEffect(() => {
    if (settings.status === "success") {
      setCurrency(settings.data.currency);
    }
  }, [settings.status, settings.data]);

  useEffect(() => {
    function handlePopState() {
      const nextView = viewFromPath(window.location.pathname);
      commitRoute(nextView);
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  useEffect(() => {
    const title =
      view === "not-found" ? t("notFound.eyebrow") : t(`nav.${view}`);
    document.title = `${title} | Personal Finance Tracker`;
  }, [view, locale, t]);

  function commitRoute(nextView: RouteView, afterCommit?: () => void) {
    if (nextView === viewRef.current) return;
    // Top-level routes behave like application tabs. Commit the content and
    // selected navigation state together so persistent glass chrome always
    // remains live instead of being covered by an old View Transition snapshot.
    cancelActiveViewTransition();
    flushSync(() => {
      if (nextView !== "transactions") setCreateTransactionRequest(0);
      if (nextView !== "budgets") setCreateBudgetRequest(0);
      if (nextView !== "netWorth") setCreateAccountRequest(0);
      setNotice("");
      viewRef.current = nextView;
      setView(nextView);
      setRouteFocusRequest((request) => request + 1);
    });
    if (afterCommit) queueMicrotask(afterCommit);
  }

  function navigate(nextView: View, afterCommit?: () => void) {
    if (nextView === viewRef.current) return;
    const nextPath = pathForView(nextView);
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, "", nextPath);
    }
    commitRoute(nextView, afterCommit);
  }

  function changePeriod(period: { month: number; year: number }) {
    const url = new URL(window.location.href);
    url.searchParams.set("month", String(period.month));
    url.searchParams.set("year", String(period.year));
    window.history.replaceState({}, "", `${url.pathname}${url.search}`);
    setSelectedPeriod(period);
  }

  function reviewBudget(target: BudgetReviewTarget) {
    const params = new URLSearchParams({
      month: String(target.month),
      year: String(target.year),
      category: target.category,
    });
    window.history.pushState(
      {},
      "",
      `${pathForView("budgets")}?${params.toString()}`,
    );
    setSelectedPeriod({ month: target.month, year: target.year });
    commitRoute("budgets");
  }

  function reviewCategory(category: string) {
    const params = new URLSearchParams({
      month: String(selectedPeriod.month),
      year: String(selectedPeriod.year),
    });
    if (category) {
      params.set("category", category);
    }
    window.history.pushState(
      {},
      "",
      `${pathForView("transactions")}?${params.toString()}`,
    );
    commitRoute("transactions");
  }

  if (settings.status === "idle" || settings.status === "loading") {
    return <div className="app-loading">{t("common.loading")}</div>;
  }

  return (
    <AppShell
      view={view}
      notice={notice}
      mainRef={mainRef}
      onNavigate={navigate}
      primaryActionLabel={
        view === "netWorth"
          ? t(
              wealthHasAccounts
                ? "netWorth.actions.updateBalances"
                : "netWorth.actions.addAccount",
            )
          : t("common.addEntry")
      }
      onPrimaryAction={() => {
        if (viewRef.current === "netWorth") {
          setCreateAccountRequest((request) => request + 1);
          return;
        }
        if (viewRef.current === "transactions") {
          setCreateTransactionRequest((request) => request + 1);
          return;
        }
        navigate("transactions", () =>
          setCreateTransactionRequest((request) => request + 1),
        );
      }}
    >
      {view === "dashboard" ? (
        <RouteContent
          fallback={<p role="status">{t("common.loading")}</p>}
          focusRequest={routeFocusRequest}
          mainRef={mainRef}
        >
          <DashboardView
            selectedPeriod={selectedPeriod}
            setSelectedPeriod={changePeriod}
            onNavigate={navigate}
            onReviewBudget={reviewBudget}
            onReviewCategory={reviewCategory}
            onCreateBudget={() => {
              if (viewRef.current === "budgets") {
                setCreateBudgetRequest((request) => request + 1);
                return;
              }
              navigate("budgets", () =>
                setCreateBudgetRequest((request) => request + 1),
              );
            }}
          />
        </RouteContent>
      ) : null}
      {view === "transactions" ? (
        <RouteContent
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
      {view === "netWorth" ? (
        <RouteContent
          fallback={<p role="status">{t("netWorth.loading")}</p>}
          focusRequest={routeFocusRequest}
          mainRef={mainRef}
        >
          <NetWorthView
            setNotice={setNotice}
            createRequestId={createAccountRequest}
            onAccountAvailabilityChange={setWealthHasAccounts}
          />
        </RouteContent>
      ) : null}
      {view === "budgets" ? (
        <RouteContent
          fallback={<p role="status">{t("common.loading")}</p>}
          focusRequest={routeFocusRequest}
          mainRef={mainRef}
        >
          <BudgetsView
            selectedPeriod={selectedPeriod}
            setSelectedPeriod={changePeriod}
            setNotice={setNotice}
            createRequestId={createBudgetRequest}
          />
        </RouteContent>
      ) : null}
      {view === "rules" ? (
        <RouteContent
          fallback={<p role="status">{t("rules.statusLoading")}</p>}
          focusRequest={routeFocusRequest}
          mainRef={mainRef}
        >
          <RulesView
            selectedPeriod={selectedPeriod}
            setNotice={setNotice}
            onCurrencyChange={(code) => {
              setCurrency(code);
            }}
          />
        </RouteContent>
      ) : null}
      {view === "not-found" ? (
        <PageHeader
          eyebrow={tUpper("notFound.eyebrow")}
          title={t("notFound.title")}
          summary={t("notFound.summary")}
          actions={
            <ActionButton
              icon={LayoutDashboard}
              onClick={() => navigate("netWorth")}
            >
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
    if (request > 0) {
      mainRef.current?.focus();
    }
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
