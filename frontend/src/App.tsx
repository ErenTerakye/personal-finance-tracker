import { useEffect, useRef, useState } from "react";
import { AppShell } from "./components/AppShell";
import { currentPeriod } from "./format";
import { pathForView, viewFromPath, viewMeta, type View } from "./routes";
import { BudgetsView } from "./views/Budgets";
import { DashboardView } from "./views/Dashboard";
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
    document.title = `${viewMeta[view].title} | Ledger Workbench`;
    if (didMount.current) {
      window.requestAnimationFrame(() => mainRef.current?.focus());
    }
    didMount.current = true;
  }, [view]);

  function navigate(nextView: View) {
    const nextPath = pathForView(nextView);
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, "", nextPath);
    }
    setNotice("");
    setView(nextView);
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
    </AppShell>
  );
}
