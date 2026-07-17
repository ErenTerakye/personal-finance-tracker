import {
  BarChart3,
  Database,
  House,
  Plus,
  ReceiptText,
  Settings2,
  Target,
  WalletCards,
} from "lucide-react";
import { ReactNode } from "react";
import "./AppShell.css";
import { Notice } from "../shared/components/feedback";
import { useMediaQuery } from "../shared/hooks/useMediaQuery";
import { useI18n } from "../shared/i18n/I18nProvider";
import { ThemeToggle } from "../shared/theme/ThemeToggle";
import {
  isManageView,
  primaryViewOrder,
  type PrimaryView,
  type RouteView,
  type View,
  viewMeta,
} from "./routes";

const navIcons = {
  overview: House,
  transactions: ReceiptText,
  budgets: Target,
  accounts: WalletCards,
};

export function LanguageToggle({ labeled = false }: { labeled?: boolean }) {
  const { locale, toggleLocale, t } = useI18n();
  const label = t("common.toggleLanguage");
  return (
    <button
      className={`lang-toggle${labeled ? " is-labeled" : ""}`}
      type="button"
      aria-label={label}
      title={label}
      onClick={toggleLocale}
    >
      <span>{locale === "en" ? "TR" : "EN"}</span>
      {labeled ? <span>{t("manage.preferences.language")}</span> : null}
    </button>
  );
}

export function AppShell({
  view,
  notice,
  mainRef,
  onNavigate,
  onPrimaryAction,
  children,
}: {
  view: RouteView;
  notice: string;
  mainRef: React.RefObject<HTMLElement | null>;
  onNavigate: (view: View) => void;
  onPrimaryAction: () => void;
  children: ReactNode;
}) {
  const { t } = useI18n();
  const compactLayout = useMediaQuery("(max-width: 63.999rem)");

  const navigation = (className: string) => (
    <nav aria-label={t("common.primaryNavigation")} className={className}>
      <ul>
        {primaryViewOrder.map((item) => (
          <PrimaryNavigationItem
            key={item}
            item={item}
            active={view === item}
            onNavigate={onNavigate}
          />
        ))}
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
            className="rail-create button primary"
            type="button"
            data-dialog-return-focus
            onClick={onPrimaryAction}
          >
            <Plus aria-hidden="true" size={19} />
            <span>{t("common.addTransaction")}</span>
          </button>
          <nav
            className="rail-manage-navigation"
            aria-label={t("manage.navigationLabel")}
          >
            <a
              href={viewMeta.manageAutomations.path}
              aria-current={isManageView(view) ? "page" : undefined}
              onClick={(event) => {
                if (!shouldHandleNavigation(event)) return;
                event.preventDefault();
                onNavigate("manageAutomations");
              }}
            >
              <Settings2 aria-hidden="true" size={19} />
              <span>{t("nav.manage")}</span>
            </a>
          </nav>
          <div className="rail-utilities">
            <span className="local-data-status">
              <Database aria-hidden="true" size={15} />
              {t("common.localSqlite")}
            </span>
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
            <a
              className="button secondary compact-manage"
              href={viewMeta.manageAutomations.path}
              aria-label={t("nav.manage")}
              aria-current={isManageView(view) ? "page" : undefined}
              onClick={(event) => {
                if (!shouldHandleNavigation(event)) return;
                event.preventDefault();
                onNavigate("manageAutomations");
              }}
            >
              <Settings2 aria-hidden="true" size={18} />
              <span>{t("nav.manage")}</span>
            </a>
            <button
              className="button primary compact-create"
              type="button"
              aria-label={t("common.addTransaction")}
              data-dialog-return-focus
              onClick={onPrimaryAction}
            >
              <Plus aria-hidden="true" />
              <span className="compact-create-label">
                {t("common.addTransaction")}
              </span>
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

function PrimaryNavigationItem({
  item,
  active,
  onNavigate,
}: {
  item: PrimaryView;
  active: boolean;
  onNavigate: (view: View) => void;
}) {
  const { t } = useI18n();
  const Icon = navIcons[item];
  return (
    <li>
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
          <Icon size={20} strokeWidth={2} />
        </span>
        <span>{t(`nav.${item}`)}</span>
      </a>
    </li>
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
        onNavigate("overview");
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
