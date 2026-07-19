import {
  Activity,
  Component,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { flushSync } from "react-dom";
import { House } from "lucide-react";
import { AppShell } from "./AppShell";
import { setCurrency } from "../shared/format/money";
import {
  pathForView,
  primaryViewOrder,
  manageViewOrder,
  resolveRoute,
  viewMeta,
  type ManageView,
  type RouteView,
  type View,
} from "./routes";
import { I18nProvider, useI18n } from "../shared/i18n/I18nProvider";
import { ThemeProvider } from "../shared/theme/ThemeProvider";
import { ActionButton } from "../shared/components/actions";
import { ErrorBanner } from "../shared/components/feedback";
import { PageHeader } from "../shared/components/lists";
import { useAppSettings } from "./useAppSettings";
import type { BudgetReviewTarget } from "../shared/components/lists";
import { cancelActiveViewTransition } from "../shared/motion/viewTransitions";
import {
  delay,
  focusActiveRouteWhenReady,
  loadBudgetsModule,
  loadDashboardModule,
  loadManageModule,
  loadNetWorthModule,
  loadTransactionsModule,
  nextAnimationFrame,
  normalizeCompatibilityRoute,
  periodFromUrl,
  prepareRoute,
  scheduleIdle,
} from "./routeLifecycle";

const DashboardView = lazy(async () => {
  const module = await loadDashboardModule();
  return { default: module.DashboardView };
});
const ManageView = lazy(async () => {
  const module = await loadManageModule();
  return { default: module.ManageView };
});
const NetWorthView = lazy(async () => {
  const module = await loadNetWorthModule();
  return { default: module.NetWorthView };
});
const TransactionsView = lazy(async () => {
  const module = await loadTransactionsModule();
  return { default: module.TransactionsView };
});
const BudgetsView = lazy(async () => {
  const module = await loadBudgetsModule();
  return { default: module.BudgetsView };
});

const ROUTE_LOADING_DELAY_MS = 150;
const ROUTE_LOADING_MINIMUM_MS = 250;

function AppContent() {
  const { t, locale, tUpper } = useI18n();
  const [view, setView] = useState<RouteView>(
    () => resolveRoute(window.location.pathname, window.location.search).view,
  );
  const [presentedView, setPresentedView] = useState<RouteView>(
    () => resolveRoute(window.location.pathname, window.location.search).view,
  );
  const [visitedViews, setVisitedViews] = useState<Set<RouteView>>(
    () =>
      new Set([
        resolveRoute(window.location.pathname, window.location.search).view,
      ]),
  );
  const [routeLoading, setRouteLoading] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState(periodFromUrl);
  const [notice, setNotice] = useState("");
  const [createTransactionRequest, setCreateTransactionRequest] = useState(0);
  const [createBudgetRequest, setCreateBudgetRequest] = useState(0);
  const [routeFocusRequest, setRouteFocusRequest] = useState(0);
  const [locationVersions, setLocationVersions] = useState<
    Partial<Record<RouteView, number>>
  >({});
  const mainRef = useRef<HTMLElement | null>(null);
  const viewRef = useRef<RouteView>(view);
  const presentedViewRef = useRef<RouteView>(presentedView);
  const visitedViewsRef = useRef(visitedViews);
  const scrollPositionsRef = useRef(new Map<RouteView, number>());
  const routeSearchRef = useRef(
    new Map<RouteView, string>([[view, window.location.search]]),
  );
  const routeRequestRef = useRef(0);
  const [initialRoute] = useState(() => ({ view, period: selectedPeriod }));
  const [initialRoutePrepared, setInitialRoutePrepared] = useState(false);
  const [startupLoadingVisible, setStartupLoadingVisible] = useState(false);
  const settings = useAppSettings();

  useEffect(() => {
    normalizeCompatibilityRoute();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadingTimer = window.setTimeout(
      () => setStartupLoadingVisible(true),
      ROUTE_LOADING_DELAY_MS,
    );
    void prepareRoute(initialRoute.view, initialRoute.period)
      .catch(() => undefined)
      .finally(() => {
        if (cancelled) return;
        window.clearTimeout(loadingTimer);
        setInitialRoutePrepared(true);
      });
    return () => {
      cancelled = true;
      window.clearTimeout(loadingTimer);
    };
  }, [initialRoute]);

  useEffect(() => {
    if (settings.status === "success") {
      setCurrency(settings.data.currency);
    }
  }, [settings.status, settings.data]);

  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  useEffect(() => {
    const title =
      view === "not-found" ? t("notFound.eyebrow") : t(viewMeta[view].titleKey);
    document.title = `${title} | Personal Finance Tracker`;
  }, [view, locale, t]);

  function bumpLocationVersion(routeView: RouteView) {
    setLocationVersions((current) => ({
      ...current,
      [routeView]: (current[routeView] ?? 0) + 1,
    }));
  }

  function commitRoute(
    nextView: RouteView,
    {
      afterCommit,
      focus = true,
      period = periodFromUrl(),
    }: {
      afterCommit?: () => void;
      focus?: boolean;
      period?: { month: number; year: number };
    } = {},
  ) {
    const routeChanged = nextView !== viewRef.current;
    if (!routeChanged && nextView === presentedViewRef.current) {
      if (afterCommit) queueMicrotask(afterCommit);
      return;
    }
    scrollPositionsRef.current.set(presentedViewRef.current, window.scrollY);
    const revisiting = visitedViewsRef.current.has(nextView);
    const destinationScroll = revisiting
      ? (scrollPositionsRef.current.get(nextView) ?? 0)
      : 0;
    window.dispatchEvent(new Event("finance-tracker:route-leave"));
    cancelActiveViewTransition();
    flushSync(() => {
      if (nextView !== "transactions") setCreateTransactionRequest(0);
      if (nextView !== "budgets") setCreateBudgetRequest(0);
      setNotice("");
      viewRef.current = nextView;
      setView(nextView);
    });

    const request = ++routeRequestRef.current;
    let loadingStartedAt = 0;
    const loadingTimer = window.setTimeout(() => {
      if (routeRequestRef.current !== request) return;
      loadingStartedAt = Date.now();
      flushSync(() => setRouteLoading(true));
    }, ROUTE_LOADING_DELAY_MS);

    void prepareRoute(nextView, period)
      .catch(() => undefined)
      .then(async () => {
        window.clearTimeout(loadingTimer);
        if (routeRequestRef.current !== request) return;
        if (loadingStartedAt) {
          const elapsed = Date.now() - loadingStartedAt;
          if (elapsed < ROUTE_LOADING_MINIMUM_MS) {
            await delay(ROUTE_LOADING_MINIMUM_MS - elapsed);
          }
        }
        if (routeRequestRef.current !== request) return;

        // A retained route has its own conceptual scroll state. Commit it as a
        // discrete tab switch: a document View Transition would interpolate
        // the route-stage geometry between two window scroll offsets and make
        // the tabs look like sections of one long page.
        flushSync(() => {
          setRouteLoading(false);
          presentedViewRef.current = nextView;
          setPresentedView(nextView);
          if (focus) setRouteFocusRequest((value) => value + 1);
          setVisitedViews((current) => {
            if (current.has(nextView)) return current;
            const next = new Set(current);
            next.add(nextView);
            visitedViewsRef.current = next;
            return next;
          });
        });
        window.scrollTo({ top: destinationScroll, behavior: "instant" });
        if (focus) {
          const heading = mainRef.current?.querySelector<HTMLElement>(
            `.route-stage[data-route="${nextView}"] h1`,
          );
          if (heading) {
            heading.tabIndex = -1;
            heading.focus({ preventScroll: true });
          }
        }
        await nextAnimationFrame();
        await nextAnimationFrame();
        if (routeRequestRef.current === request && focus) {
          focusActiveRouteWhenReady(
            mainRef,
            nextView,
            revisiting,
            () => routeRequestRef.current === request,
          );
        }
        if (routeRequestRef.current === request && afterCommit) afterCommit();
      });
  }

  function navigate(nextView: View, afterCommit?: () => void, search?: string) {
    routeSearchRef.current.set(viewRef.current, window.location.search);
    const nextSearch = search ?? routeSearchRef.current.get(nextView) ?? "";
    const nextPath = `${pathForView(nextView)}${nextSearch}`;
    if (
      window.location.pathname !== pathForView(nextView) ||
      window.location.search !== nextSearch
    ) {
      window.history.pushState({}, "", nextPath);
      bumpLocationVersion(nextView);
    }
    const period = periodFromUrl();
    setSelectedPeriod(period);
    commitRoute(nextView, { afterCommit, period });
  }

  function navigateWithParams(
    nextView: View,
    params: URLSearchParams,
    afterCommit?: () => void,
  ) {
    const query = params.toString();
    navigate(nextView, afterCommit, query ? `?${query}` : "");
  }

  function changePeriod(period: { month: number; year: number }) {
    const url = new URL(window.location.href);
    url.searchParams.set("month", String(period.month));
    url.searchParams.set("year", String(period.year));
    window.history.replaceState({}, "", `${url.pathname}${url.search}`);
    routeSearchRef.current.set(viewRef.current, url.search);
    setSelectedPeriod(period);
  }

  function reviewBudget(target: BudgetReviewTarget) {
    navigateWithParams(
      "budgets",
      new URLSearchParams({
        month: String(target.month),
        year: String(target.year),
        category: target.category,
      }),
    );
  }

  function reviewTransactions({
    month = selectedPeriod.month,
    year = selectedPeriod.year,
    category = "",
    transactionType = "",
    dataAction = "",
    search = "",
  }: {
    month?: number;
    year?: number;
    category?: string;
    transactionType?: string;
    dataAction?: string;
    search?: string;
  } = {}) {
    const params = new URLSearchParams({
      month: String(month),
      year: String(year),
    });
    if (category) params.set("category", category);
    if (transactionType) params.set("transaction_type", transactionType);
    if (dataAction) params.set("data", dataAction);
    if (search) params.set("search", search);
    navigateWithParams("transactions", params);
  }

  function reviewAccounts(asOf?: string) {
    const params = new URLSearchParams();
    if (asOf) params.set("as_of", asOf);
    navigateWithParams("accounts", params);
  }

  useEffect(() => {
    function handlePopState() {
      const resolved = resolveRoute(
        window.location.pathname,
        window.location.search,
      );
      if (resolved.canonicalUrl) {
        window.history.replaceState({}, "", resolved.canonicalUrl);
      }
      routeSearchRef.current.set(resolved.view, window.location.search);
      const period = periodFromUrl();
      setSelectedPeriod(period);
      commitRoute(resolved.view, {
        focus: resolved.view !== viewRef.current,
        period,
      });
      bumpLocationVersion(resolved.view);
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const prepareView = useCallback(
    (nextView: View) => {
      void prepareRoute(nextView, selectedPeriod).catch(() => undefined);
    },
    [selectedPeriod],
  );

  useEffect(() => {
    if (settings.status !== "success") return;
    let cancelled = false;
    const queue = primaryViewOrder.filter((item) => item !== viewRef.current);

    const warmNext = () => {
      if (cancelled || !queue.length) return;
      scheduleIdle(() => {
        if (cancelled) return;
        const nextView = queue.shift();
        if (!nextView) return;
        void prepareRoute(nextView, selectedPeriod)
          .catch(() => undefined)
          .finally(warmNext);
      });
    };
    warmNext();
    return () => {
      cancelled = true;
    };
  }, [selectedPeriod, settings.status]);

  if (
    settings.status === "idle" ||
    settings.status === "loading" ||
    !initialRoutePrepared
  ) {
    return startupLoadingVisible ? (
      <div className="app-loading" role="status">
        {t("common.loading")}
      </div>
    ) : null;
  }

  return (
    <AppShell
      view={view}
      notice={notice}
      busy={routeLoading}
      mainRef={mainRef}
      onNavigate={navigate}
      onPrepare={prepareView}
      onPrimaryAction={() => {
        if (viewRef.current === "transactions") {
          setCreateTransactionRequest((request) => request + 1);
          return;
        }
        navigate("transactions", () =>
          setCreateTransactionRequest((request) => request + 1),
        );
      }}
    >
      {routeLoading ? <RouteLoadingShell view={view} /> : null}
      <RouteActivity
        routeView="overview"
        active={presentedView === "overview" && !routeLoading}
        visited={visitedViews.has("overview")}
        focusRequest={routeFocusRequest}
      >
        <RouteContent
          fallback={<RouteLoadingShell view="overview" />}
          focusRequest={routeFocusRequest}
          mainRef={mainRef}
        >
          <DashboardView
            selectedPeriod={selectedPeriod}
            setSelectedPeriod={changePeriod}
            onAddTransaction={() =>
              navigate("transactions", () =>
                setCreateTransactionRequest((request) => request + 1),
              )
            }
            onReviewAccounts={reviewAccounts}
            onReviewBudget={reviewBudget}
            onReviewCategory={(category) => reviewTransactions({ category })}
            onReviewTransaction={(transaction) =>
              reviewTransactions({
                month: Number(transaction.date.slice(5, 7)),
                year: Number(transaction.date.slice(0, 4)),
                search:
                  transaction.description || transaction.category || undefined,
              })
            }
            onViewTransactions={() => reviewTransactions()}
            onCreateBudget={() => {
              navigate("budgets", () =>
                setCreateBudgetRequest((request) => request + 1),
              );
            }}
          />
        </RouteContent>
      </RouteActivity>
      <RouteActivity
        routeView="transactions"
        active={presentedView === "transactions" && !routeLoading}
        visited={visitedViews.has("transactions")}
        focusRequest={routeFocusRequest}
      >
        <RouteContent
          fallback={<RouteLoadingShell view="transactions" />}
          focusRequest={routeFocusRequest}
          mainRef={mainRef}
        >
          <TransactionsView
            selectedPeriod={selectedPeriod}
            setNotice={setNotice}
            createRequestId={createTransactionRequest}
            locationVersion={locationVersions.transactions ?? 0}
          />
        </RouteContent>
      </RouteActivity>
      <RouteActivity
        routeView="accounts"
        active={presentedView === "accounts" && !routeLoading}
        visited={visitedViews.has("accounts")}
        focusRequest={routeFocusRequest}
      >
        <RouteContent
          fallback={<RouteLoadingShell view="accounts" />}
          focusRequest={routeFocusRequest}
          mainRef={mainRef}
        >
          <NetWorthView
            setNotice={setNotice}
            locationVersion={locationVersions.accounts ?? 0}
          />
        </RouteContent>
      </RouteActivity>
      <RouteActivity
        routeView="budgets"
        active={presentedView === "budgets" && !routeLoading}
        visited={visitedViews.has("budgets")}
        focusRequest={routeFocusRequest}
      >
        <RouteContent
          fallback={<RouteLoadingShell view="budgets" />}
          focusRequest={routeFocusRequest}
          mainRef={mainRef}
        >
          <BudgetsView
            selectedPeriod={selectedPeriod}
            setSelectedPeriod={changePeriod}
            setNotice={setNotice}
            createRequestId={createBudgetRequest}
            locationVersion={locationVersions.budgets ?? 0}
            onReviewTransactions={(category, month, year) =>
              reviewTransactions({ category, month, year })
            }
          />
        </RouteContent>
      </RouteActivity>
      {manageViewOrder.map((manageView) => (
        <RouteActivity
          key={manageView}
          routeView={manageView}
          active={presentedView === manageView && !routeLoading}
          visited={visitedViews.has(manageView)}
          focusRequest={routeFocusRequest}
        >
          <RouteContent
            fallback={<RouteLoadingShell view={manageView} />}
            focusRequest={routeFocusRequest}
            mainRef={mainRef}
          >
            <ManageView
              section={manageView as ManageView}
              selectedPeriod={selectedPeriod}
              setSelectedPeriod={changePeriod}
              setNotice={setNotice}
              onNavigate={navigate}
              onPrepare={prepareView}
              onViewTransactions={(month, year) =>
                reviewTransactions({ month, year })
              }
              onOpenTransactionImport={() =>
                reviewTransactions({ dataAction: "import" })
              }
              onOpenBudgetImport={() => {
                const params = new URLSearchParams({
                  month: String(selectedPeriod.month),
                  year: String(selectedPeriod.year),
                  data: "import",
                });
                navigateWithParams("budgets", params);
              }}
              onCurrencyChange={setCurrency}
            />
          </RouteContent>
        </RouteActivity>
      ))}
      <RouteActivity
        routeView="not-found"
        active={presentedView === "not-found" && !routeLoading}
        visited={visitedViews.has("not-found")}
        focusRequest={routeFocusRequest}
      >
        <PageHeader
          eyebrow={tUpper("notFound.eyebrow")}
          title={t("notFound.title")}
          summary={t("notFound.summary")}
          actions={
            <ActionButton icon={House} onClick={() => navigate("overview")}>
              {t("notFound.action")}
            </ActionButton>
          }
        />
      </RouteActivity>
      <RouteFocus
        request={routeFocusRequest}
        mainRef={mainRef}
        view={presentedView}
      />
    </AppShell>
  );
}

function RouteActivity({
  routeView,
  active,
  visited,
  focusRequest,
  children,
}: {
  routeView: RouteView;
  active: boolean;
  visited: boolean;
  focusRequest: number;
  children: ReactNode;
}) {
  if (!visited) return null;
  return (
    <Activity mode={active ? "visible" : "hidden"}>
      <div
        className={`route-stage${active ? " is-active" : ""}`}
        data-route={routeView}
        aria-hidden={active ? undefined : true}
        inert={active ? undefined : true}
      >
        <RouteActivationFocus
          active={active}
          request={focusRequest}
          view={routeView}
        />
        {children}
      </div>
    </Activity>
  );
}

function RouteActivationFocus({
  active,
  request,
  view,
}: {
  active: boolean;
  request: number;
  view: RouteView;
}) {
  useLayoutEffect(() => {
    if (!active || request <= 0) return;
    const heading = document.querySelector<HTMLElement>(
      `.route-stage[data-route="${view}"] h1`,
    );
    if (!heading) return;
    heading.tabIndex = -1;
    heading.focus();
  }, [active, request, view]);
  return null;
}

function RouteLoadingShell({ view }: { view: RouteView }) {
  const { t } = useI18n();
  const title =
    view === "not-found" ? t("notFound.eyebrow") : t(viewMeta[view].titleKey);
  return (
    <section className="route-loading-shell" role="status" aria-label={title}>
      <div className="route-loading-heading">
        <span className="route-skeleton route-skeleton-eyebrow" />
        <span className="route-skeleton route-skeleton-title" />
        <span className="route-skeleton route-skeleton-summary" />
      </div>
      <div className="route-loading-grid" aria-hidden="true">
        <span className="route-skeleton route-skeleton-panel" />
        <span className="route-skeleton route-skeleton-panel" />
        <span className="route-skeleton route-skeleton-panel" />
      </div>
      <span className="sr-only">
        {t("common.loadingRoute", { name: title })}
      </span>
    </section>
  );
}

function RouteContent({
  fallback,
  focusRequest,
  mainRef,
  children,
}: {
  fallback: ReactNode;
  focusRequest: number;
  mainRef: React.RefObject<HTMLElement | null>;
  children: ReactNode;
}) {
  return (
    <RouteErrorBoundary resetKey={focusRequest} fallback={<RouteLoadError />}>
      <Suspense fallback={fallback}>
        {children}
        <RouteFocus request={focusRequest} mainRef={mainRef} />
      </Suspense>
    </RouteErrorBoundary>
  );
}

class RouteErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode; resetKey: number },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidUpdate(previous: Readonly<{ resetKey: number }>) {
    if (this.state.failed && previous.resetKey !== this.props.resetKey) {
      this.setState({ failed: false });
    }
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function RouteLoadError() {
  const { t } = useI18n();
  return (
    <ErrorBanner
      message={t("common.errorFallback")}
      onRetry={() => window.location.reload()}
    />
  );
}

function RouteFocus({
  request,
  mainRef,
  view,
}: {
  request: number;
  mainRef: React.RefObject<HTMLElement | null>;
  view?: RouteView;
}) {
  useLayoutEffect(() => {
    if (request <= 0) return;
    const stage = mainRef.current?.querySelector<HTMLElement>(
      view ? `.route-stage[data-route="${view}"]` : ".route-stage.is-active",
    );
    if (stage?.contains(document.activeElement)) return;
    const heading = mainRef.current?.querySelector<HTMLElement>(
      view
        ? `.route-stage[data-route="${view}"] h1`
        : ".route-stage.is-active h1",
    );
    if (heading) {
      heading.tabIndex = -1;
      heading.focus();
    }
  }, [mainRef, request, view]);

  return null;
}

export default function App() {
  return (
    <I18nProvider>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </I18nProvider>
  );
}
