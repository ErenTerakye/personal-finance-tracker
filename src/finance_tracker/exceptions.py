"""Application-specific exceptions."""


class FinanceTrackerError(Exception):
    """Base class for expected application errors."""


class ValidationError(FinanceTrackerError):
    """Raised when user-provided transaction data is invalid."""


class TransactionNotFoundError(FinanceTrackerError):
    """Raised when a transaction cannot be found."""


class BudgetNotFoundError(FinanceTrackerError):
    """Raised when a budget cannot be found."""


class CategoryRuleNotFoundError(FinanceTrackerError):
    """Raised when a category rule cannot be found."""


class RecurringTemplateNotFoundError(FinanceTrackerError):
    """Raised when a recurring template cannot be found."""


class CsvFormatError(FinanceTrackerError):
    """Raised when a CSV file does not match the expected format."""
