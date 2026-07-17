export type PrimaryView = "overview" | "transactions" | "budgets" | "accounts";
export type ManageView =
  "manageAutomations" | "manageCategories" | "manageData" | "managePreferences";
export type View = PrimaryView | ManageView;
export type RouteView = View | "not-found";

export const primaryViewOrder: readonly PrimaryView[] = [
  "overview",
  "transactions",
  "budgets",
  "accounts",
];

export const manageViewOrder: readonly ManageView[] = [
  "manageAutomations",
  "manageCategories",
  "manageData",
  "managePreferences",
];

export const viewMeta: Record<
  View,
  { path: string; titleKey: string; primary: boolean }
> = {
  overview: { path: "/", titleKey: "nav.overview", primary: true },
  transactions: {
    path: "/transactions",
    titleKey: "nav.transactions",
    primary: true,
  },
  budgets: { path: "/budgets", titleKey: "nav.budgets", primary: true },
  accounts: { path: "/accounts", titleKey: "nav.accounts", primary: true },
  manageAutomations: {
    path: "/manage/automations",
    titleKey: "manage.automations.title",
    primary: false,
  },
  manageCategories: {
    path: "/manage/categories",
    titleKey: "manage.categories.title",
    primary: false,
  },
  manageData: {
    path: "/manage/data",
    titleKey: "manage.data.title",
    primary: false,
  },
  managePreferences: {
    path: "/manage/preferences",
    titleKey: "manage.preferences.title",
    primary: false,
  },
};

export type ResolvedRoute = {
  view: RouteView;
  canonicalUrl?: string;
};

export function resolveRoute(pathname: string, search = ""): ResolvedRoute {
  if (pathname === "/cash-flow") {
    return {
      view: "overview",
      canonicalUrl: canonicalUrl("/", search, ["month", "year", "as_of"]),
    };
  }
  if (pathname === "/net-worth") {
    return {
      view: "accounts",
      canonicalUrl: canonicalUrl("/accounts", search, [
        "as_of",
        "months",
        "archived",
      ]),
    };
  }
  if (pathname === "/rules" || pathname === "/manage") {
    return {
      view: "manageAutomations",
      canonicalUrl: canonicalUrl("/manage/automations", search, [
        "month",
        "year",
      ]),
    };
  }

  const match = (Object.keys(viewMeta) as View[]).find(
    (view) => viewMeta[view].path === pathname,
  );
  return { view: match ?? "not-found" };
}

export function viewFromPath(pathname: string): RouteView {
  return resolveRoute(pathname).view;
}

export function pathForView(view: View): string {
  return viewMeta[view].path;
}

export function isManageView(view: RouteView): view is ManageView {
  return view !== "not-found" && !viewMeta[view].primary;
}

function canonicalUrl(
  pathname: string,
  search: string,
  allowedKeys: string[],
): string {
  const source = new URLSearchParams(search);
  const target = new URLSearchParams();
  for (const key of allowedKeys) {
    const value = source.get(key);
    if (value !== null) target.set(key, value);
  }
  const query = target.toString();
  return `${pathname}${query ? `?${query}` : ""}`;
}
