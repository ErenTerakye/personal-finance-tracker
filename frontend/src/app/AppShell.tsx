import {
  BarChart3,
  LayoutDashboard,
  Menu,
  PiggyBank,
  Plus,
  ReceiptText,
  Settings2,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { ReactNode, useEffect, useRef, useState } from "react";
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
  onCreateTransaction,
  children,
}: {
  view: RouteView;
  notice: string;
  mainRef: React.RefObject<HTMLElement | null>;
  onNavigate: (view: View) => void;
  onCreateTransaction: () => void;
  children: ReactNode;
}) {
  const { t } = useI18n();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const drawerTriggerRef = useRef<HTMLButtonElement | null>(null);
  const compactLayout = useMediaQuery("(max-width: 63.999rem)");

  useEffect(() => {
    const drawer = drawerRef.current;
    if (!drawer) return;
    if (drawerOpen) {
      drawer.showPopover?.();
      window.requestAnimationFrame(() =>
        drawer
          .querySelector<HTMLElement>(".drawer-sheet > header button")
          ?.focus(),
      );
    } else if (drawer.matches(":popover-open")) {
      drawer.hidePopover?.();
      drawerTriggerRef.current?.focus();
    }
  }, [drawerOpen]);

  const navigation = (className: string) => (
    <nav aria-label={t("common.primaryNavigation")} className={className}>
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
                  if (!shouldHandleNavigation(event)) return;
                  event.preventDefault();
                  onNavigate(item);
                }}
              >
                <span className="navigation-icon" aria-hidden="true">
                  <Icon
                    size={20}
                    strokeWidth={
                      active && className === "bottom-navigation" ? 2.75 : 2
                    }
                  />
                </span>
                <span>{t(`nav.${item}`)}</span>
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
      <aside className="app-rail" aria-label={t("common.workspaceNavigation")}>
        <Brand onNavigate={onNavigate} />
        {!compactLayout && navigation("rail-navigation")}
        <button
          className="rail-create button"
          type="button"
          onClick={onCreateTransaction}
        >
          <Plus aria-hidden="true" size={19} />
          <span>{t("common.addEntry")}</span>
        </button>
        <div className="rail-utilities">
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </aside>

      <header className="compact-app-bar">
        <div className="compact-command-start">
          <button
            ref={drawerTriggerRef}
            className="icon-button"
            type="button"
            aria-expanded={drawerOpen}
            aria-controls="app-drawer"
            aria-label={t("common.openMenu")}
            onClick={() => setDrawerOpen(true)}
          >
            <Menu aria-hidden="true" />
          </button>
          <Brand onNavigate={onNavigate} compact />
        </div>
        <button
          className="button primary compact-create"
          type="button"
          aria-label={t("common.addEntry")}
          onClick={onCreateTransaction}
        >
          <Plus aria-hidden="true" />
          <span className="compact-create-label">{t("common.addEntry")}</span>
        </button>
      </header>

      <div
        id="app-drawer"
        ref={drawerRef}
        className="app-drawer"
        popover="manual"
        onClick={(event) => {
          if (event.target === event.currentTarget) setDrawerOpen(false);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") setDrawerOpen(false);
        }}
      >
        <div className="drawer-sheet">
          <header>
            <Brand onNavigate={onNavigate} compact />
            <button
              className="icon-button"
              type="button"
              aria-label={t("common.closeMenu")}
              onClick={() => setDrawerOpen(false)}
            >
              <X aria-hidden="true" />
            </button>
          </header>
          <button
            className="button drawer-create"
            type="button"
            onClick={() => {
              setDrawerOpen(false);
              onCreateTransaction();
            }}
          >
            <Plus aria-hidden="true" size={19} />
            {t("common.addEntry")}
          </button>
          <footer>
            <span>
              <Settings2 aria-hidden="true" size={17} />
              {t("common.preferences")}
            </span>
            <LanguageToggle />
            <ThemeToggle />
          </footer>
        </div>
      </div>

      {compactLayout && (
        <div
          className="compact-primary-navigation"
          inert={drawerOpen || undefined}
        >
          {navigation("bottom-navigation")}
        </div>
      )}

      <main
        id="content"
        tabIndex={-1}
        ref={mainRef}
        inert={drawerOpen ? true : undefined}
      >
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

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window === "undefined" || typeof window.matchMedia !== "function"
      ? false
      : window.matchMedia(query).matches,
  );

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mediaQuery = window.matchMedia(query);
    const updateMatches = (event: MediaQueryListEvent) =>
      setMatches(event.matches);
    setMatches(mediaQuery.matches);
    mediaQuery.addEventListener("change", updateMatches);
    return () => mediaQuery.removeEventListener("change", updateMatches);
  }, [query]);

  return matches;
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
