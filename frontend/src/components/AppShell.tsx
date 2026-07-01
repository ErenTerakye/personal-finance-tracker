import {
  BarChart3,
  Database,
  LayoutDashboard,
  PiggyBank,
  ReceiptText
} from "lucide-react";
import { ReactNode } from "react";
import { View, viewMeta, viewOrder } from "../routes";
import { ThemeToggle } from "./ThemeToggle";
import { Notice } from "./ui";

const navIcons = {
  dashboard: LayoutDashboard,
  transactions: ReceiptText,
  budgets: PiggyBank
};

export function AppShell({
  view,
  notice,
  mainRef,
  onNavigate,
  children
}: {
  view: View;
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

        <div className="header-tools">
          <ThemeToggle />
        </div>
      </header>

      <div className="workspace">
        <main id="content" tabIndex={-1} ref={mainRef}>
          <div className="workspace-meta" aria-label="Workspace context">
            <span>
              <Database aria-hidden="true" size={14} />
              SQLite
            </span>
            <span>{viewMeta[view].label}</span>
          </div>
          <Notice message={notice} />
          {children}
        </main>
      </div>
    </div>
  );
}
