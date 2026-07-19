import type { components } from "./generated/api";

type Schema = components["schemas"];

export type ActivityKind =
  "opening" | "income" | "expense" | "transfer" | "adjustment";
export type TransactionType = "income" | "expense";
export type AccountType = "asset" | "liability";
export type AccountSubtype =
  "cash" | "investment" | "property" | "credit_card" | "loan" | "other";

export type ActivityRecord = Schema["ActivityResponse"];
export type ActivityEffect = Schema["ActivityAccountEffectResponse"];
export type IncomeExpenseActivityInput = Schema["IncomeExpenseActivityRequest"];
export type TransferActivityInput = Schema["TransferActivityRequest"];
export type AdjustmentActivityInput = Schema["AdjustmentActivityRequest"];
export type ActivityInput =
  IncomeExpenseActivityInput | TransferActivityInput | AdjustmentActivityInput;
export type ActivityMutationResponse = Schema["ActivityMutationResponse"];
export type ActivityImportPreview = Schema["ActivityImportPreviewResponse"];
export type ActivityImportPreviewRow =
  Schema["ActivityImportPreviewRowResponse"];

export type AccountRecord = Schema["AccountResponse"] & {
  /** Legacy-only aliases retained so superseded components still type-check. */
  resolved_balance?: string | null;
  resolved_balance_date?: string | null;
};
export type AccountCreateInput = Schema["AccountCreateRequest"];
export type AccountInput = {
  name: string;
  type: AccountType;
  initial_balance: string;
  initial_balance_date: string;
};
export type AccountMutationResponse = Schema["AccountMutationResponse"];
export type NetWorthSummary = Schema["NetWorthSummaryResponse"] & {
  unresolved_account_count?: number;
};
export type NetWorthHistory = Schema["NetWorthHistoryResponse"];
export type NetWorthHistoryPoint = Schema["NetWorthHistoryPointResponse"];
export type NetWorthOverview = Schema["NetWorthOverviewResponse"] & {
  coverage?: {
    resolved_account_count: number;
    unresolved_account_count: number;
    oldest_balance_date: string | null;
  };
};
export type NetWorthAccountAnalytics =
  Schema["NetWorthAccountAnalyticsResponse"];
export type DashboardData = Schema["DashboardResponse"];

export type BudgetRecord = Schema["BudgetResponse"];
export type BudgetStatus = Schema["BudgetStatusResponse"];
export type MonthlyReport = Schema["MonthlyReportResponse"];
export type TrendMonth = Schema["TrendMonthResponse"];
export type TrendReport = Schema["TrendReportResponse"];
export type Settings = Schema["SettingsResponse"];
export type BudgetInput = Schema["BudgetRequest"];
export type CategoryRule = Schema["CategoryRuleResponse"];
export type CategoryRuleInput = Schema["CategoryRuleRequest"];
export type RecurringTemplate = Schema["RecurringTemplateResponse"];
export type RecurringTemplateInput =
  | Schema["RecurringCashflowTemplateRequest"]
  | Schema["RecurringTransferTemplateRequest"];
export type NoticeResponse = Schema["NoticeResponse"];
export type ImportSummary = Schema["ImportSummaryResponse"];
export type BudgetMutationResponse = Schema["BudgetMutationResponse"];
export type CategoryRuleMutationResponse =
  Schema["CategoryRuleMutationResponse"];
export type RecurringTemplateMutationResponse =
  Schema["RecurringTemplateMutationResponse"];
export type RecurringApplyResponse = Schema["RecurringApplyResponse"];
export type PageMetadata = Schema["PageResponse"];

/* Superseded v2 types remain local compile shims for retired components. */
export type TransactionRecord = {
  id: number;
  type: TransactionType;
  amount: string;
  category: string;
  description: string;
  date: string;
  created_at: string | null;
};
export type TransactionInput = Omit<TransactionRecord, "id" | "created_at">;
export type TransactionPatch = Partial<TransactionInput>;
export type TransactionMutationResponse = {
  notice: string;
  notice_code: string;
  transaction: TransactionRecord;
};
export type TransactionImportPreviewRow = {
  line_number: number;
  status: string;
  transaction: TransactionInput | null;
  original_category: string | null;
  error: string | null;
};
export type TransactionImportPreview = {
  valid_count: number;
  duplicate_count: number;
  invalid_count: number;
  rows: TransactionImportPreviewRow[];
};
export type BalanceSnapshot = {
  id: number;
  account_id: number;
  amount: string;
  effective_date: string;
  created_at: string;
  updated_at: string;
  currency: string;
};
export type BalanceSnapshotMutationResponse = {
  notice: string;
  notice_code: string;
  snapshot: BalanceSnapshot;
};
export type BalanceCheckInResponse = {
  notice: string;
  notice_code: string;
  balance_snapshots: BalanceSnapshot[];
  replaced_count: number;
};

export interface ApiErrorBody {
  error?: string | Schema["ApiErrorDetail"];
  detail?: { error?: string } | string;
}
