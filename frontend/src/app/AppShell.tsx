import {
  BarChart3,
  Database,
  LayoutDashboard,
  PiggyBank,
  ReceiptText,
  SlidersHorizontal,
} from "lucide-react";
import { ReactNode } from "react";
import { Notice } from "../shared/components/feedback";
import { useI18n } from "../shared/i18n/I18nProvider";
import { ThemeToggle } from "../shared/theme/ThemeToggle";
import { RouteView, View, viewMeta, viewOrder } from "./routes";

const navIcons = {
  dashboard: LayoutDashboard,
  transactions: ReceiptText,
  budgets: PiggyBank,
  rules: SlidersHorizontal,
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
    >
      <span>{locale === "en" ? "TR" : "EN"}</span>
    </button>
  );
}

export function AppShell({
  view,
  notice,
  mainRef,
  onNavigate,
  children,
}: {
  view: RouteView;
  notice: string;
  mainRef: React.RefObject<HTMLElement | null>;
  onNavigate: (view: View) => void;
  children: ReactNode;
}) {
  const { t, tUpper } = useI18n();

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
            if (!shouldHandleNavigation(event)) return;
            event.preventDefault();
            onNavigate("dashboard");
          }}
        >
          <span className="brand-mark" aria-hidden="true">
            <BarChart3 size={20} />
          </span>
          <span>
            <strong>Finance Tracker</strong>
            <em>{tUpper("common.brandMarkSub")}</em>
          </span>
        </a>

        <nav aria-label={t("common.primaryNavigation")}>
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
                    style={
                      active
                        ? { viewTransitionName: "active-nav-indicator" }
                        : undefined
                    }
                    onClick={(event) => {
                      if (!shouldHandleNavigation(event)) return;
                      event.preventDefault();
                      onNavigate(item);
                    }}
                  >
                    <Icon aria-hidden="true" size={18} />
                    <span className="nav-label nav-label-full">
                      {translatedLabel}
                    </span>
                    <span
                      className="nav-label nav-label-compact"
                      aria-hidden="true"
                    >
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
          <div
            className="local-status"
            aria-label={t("common.databaseStorage")}
          >
            <span>
              <Database aria-hidden="true" size={14} />
              {t("common.localSqlite")}
            </span>
          </div>
          <Notice message={notice} />
          <div
            className="sr-only"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            {notice}
          </div>
          <div
            className="sr-only"
            aria-live="assertive"
            aria-atomic="true"
            id="app-alerts"
          />
          {children}
        </main>
      </div>
    </div>
  );
}

function shouldHandleNavigation(
  event: React.MouseEvent<HTMLAnchorElement>,
): boolean {
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}
