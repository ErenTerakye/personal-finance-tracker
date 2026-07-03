import {
  BarChart3,
  Database,
  LayoutDashboard,
  PiggyBank,
  ReceiptText,
  SlidersHorizontal
} from "lucide-react";
import { ReactNode } from "react";
import { View, viewMeta, viewOrder } from "../routes";
import { ThemeToggle } from "./ThemeToggle";
import { Notice } from "./ui";

const navIcons = {
  dashboard: LayoutDashboard,
  transactions: ReceiptText,
  budgets: PiggyBank,
  rules: SlidersHorizontal
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
        Skip to main content
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
            <strong>Finance Tracker</strong>
            <em>Local Finance</em>
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
                    aria-label={viewMeta[item].label}
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
          <div className="local-status" aria-label="Database storage">
            <span>
              <Database aria-hidden="true" size={14} />
              Local SQLite
            </span>
          </div>
          <Notice message={notice} />
          {children}
        </main>
      </div>
    </div>
  );
}
