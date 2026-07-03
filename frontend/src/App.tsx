import { useEffect, useRef, useState } from "react";
import { AppShell } from "./components/AppShell";
import { currentPeriod } from "./format";
import { pathForView, viewFromPath, viewMeta, viewOrder, type View } from "./routes";
import { BudgetsView } from "./views/Budgets";
import { DashboardView } from "./views/Dashboard";
import { RulesView } from "./views/Rules";
import { TransactionsView } from "./views/Transactions";

const initialPeriod = currentPeriod();

export default function App() {
  const [view, setView] = useState<View>(() => viewFromPath(window.location.pathname));
  const [selectedPeriod, setSelectedPeriod] = useState(initialPeriod);
  const [notice, setNotice] = useState("");
  const mainRef = useRef<HTMLElement | null>(null);
  const didMount = useRef(false);

  useEffect(() => {
    function handlePopState() {
      setView(viewFromPath(window.location.pathname));
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    document.title = `${viewMeta[view].title} | Personal Finance Tracker`;
    if (didMount.current) {
      window.requestAnimationFrame(() => mainRef.current?.focus());
    }
    didMount.current = true;
  }, [view]);

  function navigate(nextView: View) {
    if (nextView === view) {
      return;
    }
    const nextPath = pathForView(nextView);
    const direction = viewOrder.indexOf(nextView) > viewOrder.indexOf(view) ? "forward" : "backward";
    const update = () => {
      if (window.location.pathname !== nextPath) {
        window.history.pushState({}, "", nextPath);
      }
      setNotice("");
      setView(nextView);
    };

    const transition = (document as ViewTransitionDocument).startViewTransition;
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    if (!transition || reduceMotion) {
      update();
      return;
    }

    transition.call(document, {
      update,
      types: [direction]
    });
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
          setSelectedPeriod={setSelectedPeriod}
          onNavigate={navigate}
        />
      ) : null}
      {view === "transactions" ? (
        <TransactionsView selectedPeriod={selectedPeriod} setNotice={setNotice} />
      ) : null}
      {view === "budgets" ? (
        <BudgetsView
          selectedPeriod={selectedPeriod}
          setSelectedPeriod={setSelectedPeriod}
          setNotice={setNotice}
        />
      ) : null}
      {view === "rules" ? (
        <RulesView selectedPeriod={selectedPeriod} setNotice={setNotice} />
      ) : null}
    </AppShell>
  );
}

type ViewTransitionDocument = Document & {
  startViewTransition?: (options: {
    update: () => void;
    types?: string[];
  }) => { finished: Promise<void> };
};
