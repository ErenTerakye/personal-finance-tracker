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
  busy,
  mainRef,
  onNavigate,
  onPrepare,
  onPrimaryAction,
  children,
}: {
  view: RouteView;
  notice: string;
  busy: boolean;
  mainRef: React.RefObject<HTMLElement | null>;
  onNavigate: (view: View) => void;
  onPrepare: (view: View) => void;
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
            filledIcon={className === "bottom-navigation"}
            onNavigate={onNavigate}
            onPrepare={onPrepare}
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
          <Brand onNavigate={onNavigate} onPrepare={onPrepare} />
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
              onFocus={() => onPrepare("manageAutomations")}
              onPointerEnter={() => onPrepare("manageAutomations")}
              onPointerDown={() => onPrepare("manageAutomations")}
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
          <Brand onNavigate={onNavigate} onPrepare={onPrepare} compact />
          <div className="compact-utilities">
            <LanguageToggle />
            <ThemeToggle />
            <a
              className="button secondary compact-manage"
              href={viewMeta.manageAutomations.path}
              aria-label={t("nav.manage")}
              aria-current={isManageView(view) ? "page" : undefined}
              onFocus={() => onPrepare("manageAutomations")}
              onPointerEnter={() => onPrepare("manageAutomations")}
              onPointerDown={() => onPrepare("manageAutomations")}
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

      <main
        id="content"
        tabIndex={-1}
        ref={mainRef}
        aria-busy={busy || undefined}
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

function PrimaryNavigationItem({
  item,
  active,
  filledIcon,
  onNavigate,
  onPrepare,
}: {
  item: PrimaryView;
  active: boolean;
  filledIcon: boolean;
  onNavigate: (view: View) => void;
  onPrepare: (view: View) => void;
}) {
  const { t } = useI18n();
  const Icon = navIcons[item];
  return (
    <li>
      <a
        href={viewMeta[item].path}
        aria-current={active ? "page" : undefined}
        onFocus={() => onPrepare(item)}
        onPointerEnter={() => onPrepare(item)}
        onPointerDown={() => onPrepare(item)}
        onClick={(event) => {
          if (!shouldHandleNavigation(event)) return;
          event.preventDefault();
          onNavigate(item);
        }}
      >
        <span className="navigation-icon" aria-hidden="true">
          {active && filledIcon ? (
            <FilledPrimaryNavigationIcon item={item} />
          ) : filledIcon && item === "overview" ? (
            <OutlineOverviewIcon />
          ) : (
            <Icon size={22} strokeWidth={2} fill="none" />
          )}
        </span>
        <span>{t(`nav.${item}`)}</span>
      </a>
    </li>
  );
}

function OutlineOverviewIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
      data-variant="outline-open-door"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2v-9a2 2 0 0 1 .71-1.53l7-6a2 2 0 0 1 2.58 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2h-4" />
      <path d="M9 21v-8a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v8" />
    </svg>
  );
}

function FilledPrimaryNavigationIcon({ item }: { item: PrimaryView }) {
  const sharedProps = {
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    fill: "currentColor",
    fillOpacity: 1,
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    xmlns: "http://www.w3.org/2000/svg",
  };

  if (item === "overview") {
    return (
      <svg {...sharedProps}>
        <path
          fillRule="evenodd"
          d="M10.72 2.32a2 2 0 0 1 2.56 0l7 5.83A2 2 0 0 1 21 9.69V19a2 2 0 0 1-2 2h-3v-6a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v6H5a2 2 0 0 1-2-2V9.69a2 2 0 0 1 .72-1.54z"
        />
      </svg>
    );
  }

  if (item === "transactions") {
    return (
      <svg {...sharedProps}>
        <path d="M5 2a1.5 1.5 0 0 1 .82.24l.82.53a1.5 1.5 0 0 0 1.62 0l.93-.6a1.5 1.5 0 0 1 1.62 0l.38.24a1.5 1.5 0 0 0 1.62 0l.38-.24a1.5 1.5 0 0 1 1.62 0l.93.6a1.5 1.5 0 0 0 1.62 0l.82-.53A1.5 1.5 0 0 1 20 3.5v17a1.5 1.5 0 0 1-2.32 1.26l-.82-.53a1.5 1.5 0 0 0-1.62 0l-.93.6a1.5 1.5 0 0 1-1.62 0l-.38-.24a1.5 1.5 0 0 0-1.62 0l-.38.24a1.5 1.5 0 0 1-1.62 0l-.93-.6a1.5 1.5 0 0 0-1.62 0l-.82.53A1.5 1.5 0 0 1 4 20.5v-17A1.5 1.5 0 0 1 5 2" />
        <path d="M8 8h8M8 12h8M8 16h5" fill="none" stroke="var(--surface)" />
      </svg>
    );
  }

  if (item === "budgets") {
    return (
      <svg {...sharedProps}>
        <path
          fillRule="evenodd"
          d="M12 1a11 11 0 1 1 0 22 11 11 0 0 1 0-22m0 2a9 9 0 1 0 0 18 9 9 0 0 0 0-18m0 2a7 7 0 1 1 0 14 7 7 0 0 1 0-14m0 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10m0 2a3 3 0 1 1 0 6 3 3 0 0 1 0-6"
          stroke="none"
        />
      </svg>
    );
  }

  return (
    <svg {...sharedProps} data-variant="filled-wallet-cards">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path
        d="M3 7h18M3 11h3.75a2 2 0 0 1 1.6.8l.45.6a4 4 0 0 0 6.4 0l.45-.6a2 2 0 0 1 1.6-.8H21"
        fill="none"
        stroke="var(--surface)"
      />
    </svg>
  );
}

function Brand({
  onNavigate,
  onPrepare,
  compact = false,
}: {
  onNavigate: (view: View) => void;
  onPrepare: (view: View) => void;
  compact?: boolean;
}) {
  return (
    <a
      className={`brand ${compact ? "brand-compact" : ""}`}
      href="/"
      aria-label="Finance Tracker"
      onFocus={() => onPrepare("overview")}
      onPointerEnter={() => onPrepare("overview")}
      onPointerDown={() => onPrepare("overview")}
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
