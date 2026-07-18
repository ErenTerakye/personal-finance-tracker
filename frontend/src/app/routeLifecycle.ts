import { currentPeriod } from "../shared/format/periods";
import { resolveRoute, type RouteView } from "./routes";

export const loadDashboardModule = () =>
  import("../features/dashboard/DashboardView");
export const loadManageModule = () => import("../features/manage/ManageView");
export const loadNetWorthModule = () =>
  import("../features/net-worth/NetWorthView");
export const loadTransactionsModule = () =>
  import("../features/transactions/TransactionsView");
export const loadBudgetsModule = () =>
  import("../features/budgets/BudgetsView");

export function normalizeCompatibilityRoute() {
  const resolved = resolveRoute(
    window.location.pathname,
    window.location.search,
  );
  if (resolved.canonicalUrl) {
    window.history.replaceState({}, "", resolved.canonicalUrl);
  }
}

export function periodFromUrl(): { month: number; year: number } {
  const fallback = currentPeriod();
  const params = new URLSearchParams(window.location.search);
  const month = Number(params.get("month"));
  const year = Number(params.get("year"));
  return {
    month: month >= 1 && month <= 12 ? month : fallback.month,
    year: year >= 1 ? year : fallback.year,
  };
}

export async function prepareRoute(
  view: RouteView,
  period: { month: number; year: number },
) {
  if (view === "not-found") return;
  if (view === "overview") {
    const module = await loadDashboardModule();
    await module.preloadDashboardView(period);
    return;
  }
  if (view === "transactions") {
    const module = await loadTransactionsModule();
    await module.preloadTransactionsView(period);
    return;
  }
  if (view === "budgets") {
    const module = await loadBudgetsModule();
    await module.preloadBudgetsView(period);
    return;
  }
  if (view === "accounts") {
    const module = await loadNetWorthModule();
    await module.preloadNetWorthView();
    return;
  }
  const module = await loadManageModule();
  await module.preloadManageView(view);
}

export function scheduleIdle(callback: () => void) {
  const idleWindow = window as Window & {
    requestIdleCallback?: (
      callback: IdleRequestCallback,
      options?: IdleRequestOptions,
    ) => number;
  };
  if (idleWindow.requestIdleCallback) {
    idleWindow.requestIdleCallback(callback, { timeout: 2_000 });
    return;
  }
  window.setTimeout(callback, 600);
}

export function delay(milliseconds: number) {
  return new Promise<void>((resolve) =>
    window.setTimeout(resolve, milliseconds),
  );
}

export function nextAnimationFrame() {
  return new Promise<void>((resolve) =>
    window.requestAnimationFrame(() => resolve()),
  );
}

export function focusActiveRouteWhenReady(
  mainRef: React.RefObject<HTMLElement | null>,
  view: RouteView,
  preventScroll = false,
  isCurrent: () => boolean,
) {
  const focusHeading = () => {
    if (!isCurrent()) return false;
    const stage = mainRef.current?.querySelector<HTMLElement>(
      `.route-stage[data-route="${view}"]`,
    );
    if (stage?.contains(document.activeElement)) return true;
    const heading = stage?.querySelector<HTMLElement>("h1");
    if (!heading) return false;
    heading.tabIndex = -1;
    heading.focus({ preventScroll });
    return true;
  };

  if (focusHeading()) return;
  const main = mainRef.current;
  if (!main) return;

  let timeout = 0;
  const observer = new MutationObserver(() => {
    if (!isCurrent()) {
      observer.disconnect();
      window.clearTimeout(timeout);
      return;
    }
    if (focusHeading()) {
      observer.disconnect();
      window.clearTimeout(timeout);
    }
  });
  observer.observe(main, { childList: true, subtree: true });
  timeout = window.setTimeout(() => {
    observer.disconnect();
    if (isCurrent() && !focusHeading()) main.focus({ preventScroll });
  }, 1_000);
}
