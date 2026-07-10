import type { components } from "./generated/api";

type Schema = components["schemas"];

export type TransactionType = "income" | "expense";
export type TransactionRecord = Schema["TransactionResponse"];
export type BudgetRecord = Schema["BudgetResponse"];
export type BudgetStatus = Schema["BudgetStatusResponse"];
export type MonthlyReport = Schema["MonthlyReportResponse"];
export type TrendMonth = Schema["TrendMonthResponse"];
export type TrendReport = Schema["TrendReportResponse"];
export type DashboardData = Schema["DashboardResponse"];
export type Settings = Schema["SettingsResponse"];
export type TransactionInput = Schema["TransactionRequest"];
export type TransactionPatch = Schema["TransactionPatchRequest"];
export type BudgetInput = Schema["BudgetRequest"];
export type CategoryRule = Schema["CategoryRuleResponse"];
export type CategoryRuleInput = Schema["CategoryRuleRequest"];
export type RecurringTemplate = Schema["RecurringTemplateResponse"];
export type RecurringTemplateInput = Schema["RecurringTemplateRequest"];
export type NoticeResponse = Schema["NoticeResponse"];
export type ImportSummary = Schema["ImportSummaryResponse"];
export type TransactionMutationResponse = Schema["TransactionMutationResponse"];
export type BudgetMutationResponse = Schema["BudgetMutationResponse"];
export type CategoryRuleMutationResponse =
  Schema["CategoryRuleMutationResponse"];
export type RecurringTemplateMutationResponse =
  Schema["RecurringTemplateMutationResponse"];
export type RecurringApplyResponse = Schema["RecurringApplyResponse"];
export type TransactionImportPreviewRow =
  Schema["TransactionImportPreviewRowResponse"];
export type TransactionImportPreview =
  Schema["TransactionImportPreviewResponse"];
export type PageMetadata = Schema["PageResponse"];

export interface ApiErrorBody {
  error?: string | Schema["ApiErrorDetail"];
  detail?: { error?: string } | string;
}
