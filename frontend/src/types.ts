export type TransactionType = "income" | "expense";

export interface TransactionRecord {
  id: number;
  type: TransactionType;
  amount: string;
  category: string;
  description: string;
  date: string;
  created_at: string | null;
}

export interface BudgetRecord {
  id: number;
  category: string;
  amount: string;
  month: number;
  year: number;
  created_at: string | null;
}

export interface BudgetStatus {
  budget: BudgetRecord;
  actual_expenses: string;
  remaining: string;
  percent_used: string;
  status: string;
}

export interface MonthlyReport {
  month: number;
  year: number;
  total_income: string;
  total_expenses: string;
  net_savings: string;
  transaction_count: number;
  income_by_category: Record<string, string>;
  expenses_by_category: Record<string, string>;
  ytd_income: string;
  ytd_expenses: string;
  ytd_net_savings: string;
  income_delta: string;
  expenses_delta: string;
  net_savings_delta: string;
}

export interface TrendMonth {
  month: number;
  year: number;
  label: string;
  total_income: string;
  total_expenses: string;
  net_savings: string;
  transaction_count: number;
  savings_rate: string;
  income_delta: string;
  expenses_delta: string;
  net_savings_delta: string;
}

export interface TrendReport {
  months: TrendMonth[];
  total_income: string;
  total_expenses: string;
  net_savings: string;
  transaction_count: number;
  top_expense_categories: Record<string, string>;
}

export interface DashboardData {
  month: number;
  year: number;
  period_label: string;
  report: MonthlyReport;
  trend: TrendReport;
  savings_rate: string;
  recent_transactions: TransactionRecord[];
  budget_statuses: BudgetStatus[];
}

export interface TransactionInput {
  type: TransactionType;
  amount: string;
  category: string;
  description: string;
  date: string;
}

export interface TransactionPatch {
  type?: TransactionType;
  amount?: string;
  category?: string;
  description?: string;
  date?: string;
}

export interface BudgetInput {
  category: string;
  amount: string;
  month: number;
  year: number;
}

export interface CategoryRule {
  id: number;
  alias: string;
  category: string;
  created_at: string | null;
}

export interface CategoryRuleInput {
  alias: string;
  category: string;
}

export interface RecurringTemplate {
  id: number;
  type: TransactionType;
  amount: string;
  category: string;
  description: string;
  day_of_month: number;
  active: boolean;
  created_at: string | null;
}

export interface RecurringTemplateInput {
  type: TransactionType;
  amount: string;
  category: string;
  description: string;
  day_of_month: number;
}

export interface NoticeResponse {
  notice: string;
}

export interface ImportSummary extends NoticeResponse {
  imported_count: number;
  skipped_count: number;
  errors: string[];
}

export interface TransactionMutationResponse extends NoticeResponse {
  transaction: TransactionRecord;
}

export interface BudgetMutationResponse extends NoticeResponse {
  budget: BudgetRecord;
}

export interface CategoryRuleMutationResponse extends NoticeResponse {
  rule: CategoryRule;
}

export interface RecurringTemplateMutationResponse extends NoticeResponse {
  template: RecurringTemplate;
}

export interface RecurringApplyResponse extends NoticeResponse {
  created_count: number;
  skipped_duplicates: number;
  transactions: TransactionRecord[];
}

export interface TransactionImportPreviewRow {
  line_number: number;
  status: "valid" | "duplicate" | "invalid";
  transaction: Omit<TransactionRecord, "id" | "created_at"> | null;
  original_category: string | null;
  error: string | null;
}

export interface TransactionImportPreview {
  valid_count: number;
  duplicate_count: number;
  invalid_count: number;
  rows: TransactionImportPreviewRow[];
}

export interface ApiErrorBody {
  error?: string;
  detail?: { error?: string } | string;
}
