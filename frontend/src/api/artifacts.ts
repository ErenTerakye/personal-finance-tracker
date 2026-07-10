import { query, type BudgetFilters, type TransactionFilters } from "./client";

export const artifactUrls = {
  transactionsCsv: (filters: TransactionFilters = {}) =>
    `/api/transactions/export-csv?${query(filters)}`,
  budgetsCsv: (filters: BudgetFilters = {}) =>
    `/api/budgets/export-csv?${query(filters)}`,
  monthlyReport: (month: number, year: number) =>
    `/api/reports/monthly.txt?${query({ month, year })}`,
  trendReport: (month: number, year: number, months = 6) =>
    `/api/reports/trends.txt?${query({ months, end_month: month, end_year: year })}`,
  monthlyChart: (month: number, year: number) =>
    `/api/charts/monthly.png?${query({ month, year })}`,
  trendChart: (month: number, year: number, months = 6) =>
    `/api/charts/trends.png?${query({ months, end_month: month, end_year: year })}`,
};
