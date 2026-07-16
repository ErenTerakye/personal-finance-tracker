import {
  BarChart3,
  LayoutDashboard,
  PiggyBank,
  Plus,
  ReceiptText,
  SlidersHorizontal,
} from "lucide-react";
import { ReactNode } from "react";
import "./AppShell.css";
import { Notice } from "../shared/components/feedback";
import { useMediaQuery } from "../shared/hooks/useMediaQuery";
import { useI18n } from "../shared/i18n/I18nProvider";
import { ThemeToggle } from "../shared/theme/ThemeToggle";
import { RouteView, View, viewMeta, viewOrder } from "./routes";

const navIcons = {
  dashboard: LayoutDashboard,
  netWorth: BarChart3,
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
  primaryActionLabel,
  onPrimaryAction,
  children,
}: {
  view: RouteView;
  notice: string;
  mainRef: React.RefObject<HTMLElement | null>;
  onNavigate: (view: View) => void;
  primaryActionLabel: string;
  onPrimaryAction: () => void;
  children: ReactNode;
}) {
  const { t } = useI18n();
  const compactLayout = useMediaQuery("(max-width: 63.999rem)");

  const navigation = (className: string) => (
    <nav aria-label={t("common.primaryNavigation")} className={className}>
      <ul>
        {viewOrder.map((item) => {
          const Icon = navIcons[item];
          const active = view === item;
          const bottomNavigationActive =
            active && className === "bottom-navigation";
          return (
            <li key={item}>
              <a
                href={viewMeta[item].path}
                aria-label={
                  className === "bottom-navigation"
                    ? t(`nav.${item}`)
                    : undefined
                }
                aria-current={active ? "page" : undefined}
                onClick={(event) => {
                  if (!shouldHandleNavigation(event)) return;
                  event.preventDefault();
                  onNavigate(item);
                }}
              >
                <span className="navigation-icon" aria-hidden="true">
                  <Icon
                    className={
                      bottomNavigationActive && item !== "rules"
                        ? "navigation-filled-icon"
                        : undefined
                    }
                    size={20}
                    fill={
                      bottomNavigationActive && item !== "rules"
                        ? "currentColor"
                        : "none"
                    }
                    strokeWidth={
                      bottomNavigationActive && item === "rules" ? 2.75 : 2
                    }
                  />
                  {bottomNavigationActive &&
                  (item === "transactions" || item === "budgets") ? (
                    <Icon
                      className={`navigation-icon-detail navigation-icon-detail--${item}`}
                      size={20}
                      fill="none"
                      strokeWidth={item === "budgets" ? 3 : 2}
                    />
                  ) : null}
                </span>
                <span>
                  {t(
                    className === "bottom-navigation"
                      ? `navShort.${item}`
                      : `nav.${item}`,
                  )}
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );

  return (
    <div className="app-shell">
      <a className="skip-link" href="#content">
        {t("common.skipLink")}
      </a>
      {!compactLayout && (
        <aside
          className="app-rail"
          aria-label={t("common.workspaceNavigation")}
        >
          <Brand onNavigate={onNavigate} />
          {navigation("rail-navigation")}
          <button
            className="rail-create button"
            type="button"
            data-dialog-return-focus
            onClick={onPrimaryAction}
          >
            <Plus aria-hidden="true" size={19} />
            <span>{primaryActionLabel}</span>
          </button>
          <div className="rail-utilities">
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </aside>
      )}

      {compactLayout && (
        <header className="compact-app-bar">
          <Brand onNavigate={onNavigate} compact />
          <div className="compact-utilities">
            <LanguageToggle />
            <ThemeToggle />
            <button
              className="button primary compact-create"
              type="button"
              aria-label={primaryActionLabel}
              data-dialog-return-focus
              onClick={onPrimaryAction}
            >
              <Plus aria-hidden="true" />
              <span className="compact-create-label">{primaryActionLabel}</span>
            </button>
          </div>
        </header>
      )}

      {compactLayout && (
        <div className="compact-primary-navigation">
          {navigation("bottom-navigation")}
        </div>
      )}

      <main id="content" tabIndex={-1} ref={mainRef}>
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
  );
}

function Brand({
  onNavigate,
  compact = false,
}: {
  onNavigate: (view: View) => void;
  compact?: boolean;
}) {
  return (
    <a
      className={`brand ${compact ? "brand-compact" : ""}`}
      href="/"
      aria-label="Finance Tracker"
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
      </span>
    </a>
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
