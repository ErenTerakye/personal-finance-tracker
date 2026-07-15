import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { AppShell } from "./AppShell";
import { currentPeriod } from "../shared/format/periods";
import { setCurrency } from "../shared/format/money";
import { pathForView, viewFromPath, type RouteView, type View } from "./routes";
import { BudgetsView } from "../features/budgets/BudgetsView";
import { DashboardView } from "../features/dashboard/DashboardView";
import { RulesView } from "../features/rules/RulesView";
import { TransactionsView } from "../features/transactions/TransactionsView";
import { I18nProvider, useI18n } from "../shared/i18n/I18nProvider";
import { ActionButton } from "../shared/components/actions";
import { PageHeader } from "../shared/components/lists";
import { LayoutDashboard } from "lucide-react";
import { useAppSettings } from "./useAppSettings";
import type { BudgetReviewTarget } from "../shared/components/lists";
import { cancelActiveViewTransition } from "../shared/motion/viewTransitions";

const initialPeriod = periodFromUrl();

function AppContent() {
  const { t, locale, tUpper } = useI18n();
  const [view, setView] = useState<RouteView>(() =>
    viewFromPath(window.location.pathname),
  );
  const [selectedPeriod, setSelectedPeriod] = useState(initialPeriod);
  const [notice, setNotice] = useState("");
  const [createTransactionRequest, setCreateTransactionRequest] = useState(0);
  const [createBudgetRequest, setCreateBudgetRequest] = useState(0);
  const mainRef = useRef<HTMLElement | null>(null);
  const viewRef = useRef<RouteView>(view);
  const settings = useAppSettings();

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
      setNotice("");
      viewRef.current = nextView;
      setView(nextView);
    });
    mainRef.current?.focus();
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
      onCreateTransaction={() => {
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
      ) : null}
      {view === "transactions" ? (
        <TransactionsView
          selectedPeriod={selectedPeriod}
          setNotice={setNotice}
          createRequestId={createTransactionRequest}
        />
      ) : null}
      {view === "budgets" ? (
        <BudgetsView
          selectedPeriod={selectedPeriod}
          setSelectedPeriod={changePeriod}
          setNotice={setNotice}
          createRequestId={createBudgetRequest}
        />
      ) : null}
      {view === "rules" ? (
        <RulesView
          selectedPeriod={selectedPeriod}
          setNotice={setNotice}
          onCurrencyChange={(code) => {
            setCurrency(code);
          }}
        />
      ) : null}
      {view === "not-found" ? (
        <PageHeader
          eyebrow={tUpper("notFound.eyebrow")}
          title={t("notFound.title")}
          summary={t("notFound.summary")}
          actions={
            <ActionButton
              icon={LayoutDashboard}
              onClick={() => navigate("dashboard")}
            >
              {t("notFound.action")}
            </ActionButton>
          }
        />
      ) : null}
    </AppShell>
  );
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
