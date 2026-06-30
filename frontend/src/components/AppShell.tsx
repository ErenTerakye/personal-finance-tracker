import {
  BarChart3,
  Database,
  LayoutDashboard,
  PiggyBank,
  ReceiptText,
  WalletCards
} from "lucide-react";
import { ReactNode } from "react";
import { periodLabel } from "../format";
import { View, viewMeta, viewOrder } from "../routes";
import { Notice } from "./ui";

const navIcons = {
  dashboard: LayoutDashboard,
  transactions: ReceiptText,
  budgets: PiggyBank
};

export function AppShell({
  view,
  selectedPeriod,
  notice,
  mainRef,
  onNavigate,
  children
}: {
  view: View;
  selectedPeriod: { month: number; year: number };
  notice: string;
  mainRef: React.RefObject<HTMLElement | null>;
  onNavigate: (view: View) => void;
  children: ReactNode;
}) {
  return (
    <div className="app">
      <a className="skip-link" href="#content">
        Skip to workspace
      </a>
      <header className="app-header">
        <a
          className="brand"
          href="/"
          onClick={(event) => {
            event.preventDefault();
            onNavigate("dashboard");
          }}
        >
          <span className="brand-mark" aria-hidden="true">
            <BarChart3 size={20} />
          </span>
          <span>
            <strong>Ledger Workbench</strong>
            <em>Local finance desk</em>
          </span>
        </a>

        <nav aria-label="Primary">
          <ul>
            {viewOrder.map((item) => {
              const Icon = navIcons[item];
              const active = view === item;
              return (
                <li key={item}>
                  <a
                    href={viewMeta[item].path}
                    aria-current={active ? "page" : undefined}
                    onClick={(event) => {
                      event.preventDefault();
                      onNavigate(item);
                    }}
                  >
                    <Icon aria-hidden="true" size={18} />
                    <span>{viewMeta[item].label}</span>
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="period-pill">
          <WalletCards aria-hidden="true" size={17} />
          <span>{periodLabel(selectedPeriod.month, selectedPeriod.year)}</span>
        </div>
      </header>

      <div className="workspace">
        <aside className="context-rail" aria-label="Workspace context">
          <div>
            <span>Period</span>
            <strong>{periodLabel(selectedPeriod.month, selectedPeriod.year)}</strong>
          </div>
          <div>
            <span>Storage</span>
            <strong>
              <Database aria-hidden="true" size={14} />
              SQLite
            </strong>
          </div>
          <div>
            <span>View</span>
            <strong>{viewMeta[view].label}</strong>
          </div>
        </aside>

        <main id="content" tabIndex={-1} ref={mainRef}>
          <Notice message={notice} />
          {children}
        </main>
      </div>
    </div>
  );
}
