export type View = "dashboard" | "transactions" | "budgets";

export const viewOrder: View[] = ["dashboard", "transactions", "budgets"];

export const viewMeta: Record<View, { title: string; path: string; label: string }> = {
  dashboard: { title: "Dashboard", path: "/", label: "Dashboard" },
  transactions: { title: "Transactions", path: "/transactions", label: "Transactions" },
  budgets: { title: "Budgets", path: "/budgets", label: "Budgets" }
};

export function viewFromPath(pathname: string): View {
  if (pathname.startsWith("/transactions")) {
    return "transactions";
  }
  if (pathname.startsWith("/budgets")) {
    return "budgets";
  }
  return "dashboard";
}

export function pathForView(view: View): string {
  return viewMeta[view].path;
}
