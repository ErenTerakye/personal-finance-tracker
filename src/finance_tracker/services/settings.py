"""Ledger settings use cases and transaction boundaries."""

from pathlib import Path

from finance_tracker.database import initialize_database
from finance_tracker.database import transaction as database_transaction
from finance_tracker.exceptions import ValidationError
from finance_tracker.repositories.settings import SettingsRepository


class SettingsService:
    def __init__(self, db_path: Path | str, *, initialize: bool = True) -> None:
        self.db_path = Path(db_path)
        if initialize:
            initialize_database(self.db_path)

    def get_currency(self) -> str:
        with database_transaction(self.db_path) as connection:
            return SettingsRepository(connection).get("currency", "USD")

    def set_currency(self, currency_code: str) -> str:
        currency = currency_code.strip().upper()
        if len(currency) != 3 or not currency.isalpha():
            raise ValidationError("Currency must be a valid 3-letter ISO code.")
        with database_transaction(self.db_path) as connection:
            SettingsRepository(connection).set("currency", currency)
            return currency
