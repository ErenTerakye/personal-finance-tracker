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
import { useI18n } from "../i18n";

const navIcons = {
  dashboard: LayoutDashboard,
  transactions: ReceiptText,
  budgets: PiggyBank,
  rules: SlidersHorizontal
};

function LanguageToggle() {
  const { locale, toggleLocale, t } = useI18n();
  const label = t("common.toggleLanguage");
  return (
    <button
      className="lang-toggle"
      type="button"
      aria-label={label}
      title={label}
      onClick={toggleLocale}
      style={{ marginInlineEnd: "0.5rem" }}
    >
      <span style={{ fontSize: "0.75rem", fontWeight: "700" }}>
        {locale === "en" ? "TR" : "EN"}
      </span>
    </button>
  );
}

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
  const { locale, t } = useI18n();

  return (
    <div className="app">
      <a className="skip-link" href="#content">
        {t("common.skipLink")}
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
            <em lang={locale}>{t("common.brandMarkSub")}</em>
          </span>
        </a>

        <nav aria-label="Primary">
          <ul>
            {viewOrder.map((item) => {
              const Icon = navIcons[item];
              const active = view === item;
              const translatedLabel = t(`nav.${item}`);
              const compactLabel = t(`navShort.${item}`);
              return (
                <li key={item}>
                  <a
                    href={viewMeta[item].path}
                    aria-current={active ? "page" : undefined}
                    aria-label={translatedLabel}
                    onClick={(event) => {
                      event.preventDefault();
                      onNavigate(item);
                    }}
                  >
                    <Icon aria-hidden="true" size={18} />
                    <span className="nav-label nav-label-full">{translatedLabel}</span>
                    <span className="nav-label nav-label-compact" aria-hidden="true">
                      {compactLabel}
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="header-tools">
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </header>

      <div className="workspace">
        <main id="content" tabIndex={-1} ref={mainRef}>
          <div className="local-status" aria-label="Database storage">
            <span>
              <Database aria-hidden="true" size={14} />
              {t("common.localSqlite")}
            </span>
          </div>
          <Notice message={notice} />
          {children}
        </main>
      </div>
    </div>
  );
}
