export type View = "dashboard" | "transactions" | "budgets" | "rules";

export const viewOrder: View[] = ["dashboard", "transactions", "budgets", "rules"];

export const viewMeta: Record<View, { title: string; path: string; label: string }> = {
  dashboard: { title: "Dashboard", path: "/", label: "Dashboard" },
  transactions: { title: "Transactions", path: "/transactions", label: "Transactions" },
  budgets: { title: "Budgets", path: "/budgets", label: "Budgets" },
  rules: { title: "Rules", path: "/rules", label: "Rules" }
};

export function viewFromPath(pathname: string): View {
  if (pathname.startsWith("/transactions")) {
    return "transactions";
  }
  if (pathname.startsWith("/budgets")) {
    return "budgets";
  }
  if (pathname.startsWith("/rules")) {
    return "rules";
  }
  return "dashboard";
}

export function pathForView(view: View): string {
  return viewMeta[view].path;
}
