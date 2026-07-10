export type View = "dashboard" | "transactions" | "budgets" | "rules";
export type RouteView = View | "not-found";

export const viewOrder: readonly View[] = [
  "dashboard",
  "transactions",
  "budgets",
  "rules",
];

export const viewMeta: Record<View, { path: string }> = {
  dashboard: { path: "/" },
  transactions: { path: "/transactions" },
  budgets: { path: "/budgets" },
  rules: { path: "/rules" },
};

export function viewFromPath(pathname: string): RouteView {
  const match = viewOrder.find((view) => viewMeta[view].path === pathname);
  return match ?? "not-found";
}

export function pathForView(view: View): string {
  return viewMeta[view].path;
}
