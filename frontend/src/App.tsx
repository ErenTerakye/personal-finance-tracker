import { useEffect, useRef, useState } from "react";
import { AppShell } from "./components/AppShell";
import { currentPeriod, setCurrency } from "./format";
import {
  pathForView,
  viewFromPath,
  viewOrder,
  type RouteView,
  type View,
} from "./routes";
import { api } from "./api";
import { BudgetsView } from "./views/Budgets";
import { DashboardView } from "./views/Dashboard";
import { RulesView } from "./views/Rules";
import { TransactionsView } from "./views/Transactions";
import { I18nProvider, useI18n } from "./i18n";
import { ActionButton, PageHeader } from "./components/ui";
import { LayoutDashboard } from "lucide-react";

const initialPeriod = periodFromUrl();

function AppContent() {
  const { t, locale } = useI18n();
  const [view, setView] = useState<RouteView>(() =>
    viewFromPath(window.location.pathname),
  );
  const [selectedPeriod, setSelectedPeriod] = useState(initialPeriod);
  const [notice, setNotice] = useState("");
  const [ready, setReady] = useState(false);
  const mainRef = useRef<HTMLElement | null>(null);
  const didMount = useRef(false);

  useEffect(() => {
    api
      .getSettings()
      .then((settings) => {
        setCurrency(settings.currency);
        setReady(true);
      })
      .catch(() => {
        setReady(true);
      });
  }, []);

  useEffect(() => {
    function handlePopState() {
      setView(viewFromPath(window.location.pathname));
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    const title =
      view === "not-found" ? t("notFound.eyebrow") : t(`nav.${view}`);
    document.title = `${title} | Personal Finance Tracker`;
    if (didMount.current) {
      window.requestAnimationFrame(() => mainRef.current?.focus());
    }
    didMount.current = true;
  }, [view, locale, t]);

  function navigate(nextView: View) {
    if (nextView === view) {
      return;
    }
    const nextPath = pathForView(nextView);
    const currentIndex = view === "not-found" ? 0 : viewOrder.indexOf(view);
    const direction =
      viewOrder.indexOf(nextView) < currentIndex ? "backward" : "forward";
    const update = () => {
      if (window.location.pathname !== nextPath) {
        window.history.pushState({}, "", nextPath);
      }
      setNotice("");
      setView(nextView);
    };

    const transition = (document as ViewTransitionDocument).startViewTransition;
    const reduceMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (!transition || reduceMotion) {
      update();
      return;
    }

    transition.call(document, {
      update,
      types: [direction],
    });
  }

  function changePeriod(period: { month: number; year: number }) {
    const url = new URL(window.location.href);
    url.searchParams.set("month", String(period.month));
    url.searchParams.set("year", String(period.year));
    window.history.replaceState({}, "", `${url.pathname}${url.search}`);
    setSelectedPeriod(period);
  }

  if (!ready) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "100vh",
          fontFamily: "sans-serif",
          color: "#666",
        }}
      >
        {t("common.loading")}
      </div>
    );
  }

  return (
    <AppShell
      view={view}
      notice={notice}
      mainRef={mainRef}
      onNavigate={navigate}
    >
      {view === "dashboard" ? (
        <DashboardView
          selectedPeriod={selectedPeriod}
          setSelectedPeriod={changePeriod}
          onNavigate={navigate}
        />
      ) : null}
      {view === "transactions" ? (
        <TransactionsView
          selectedPeriod={selectedPeriod}
          setNotice={setNotice}
        />
      ) : null}
      {view === "budgets" ? (
        <BudgetsView
          selectedPeriod={selectedPeriod}
          setSelectedPeriod={changePeriod}
          setNotice={setNotice}
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
          eyebrow={t("notFound.eyebrow")}
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

type ViewTransitionDocument = Document & {
  startViewTransition?: (options: { update: () => void; types?: string[] }) => {
    finished: Promise<void>;
  };
};

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
