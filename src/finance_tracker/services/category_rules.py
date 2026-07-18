"""Category rule use cases and transaction boundaries."""

from pathlib import Path

from finance_tracker.database import initialize_database
from finance_tracker.database import transaction as database_transaction
from finance_tracker.models.category_rules import CategoryRule
from finance_tracker.repositories.category_rules import CategoryRuleRepository


class CategoryRuleService:
    def __init__(self, db_path: Path | str, *, initialize: bool = True) -> None:
        self.db_path = Path(db_path)
        if initialize:
            initialize_database(self.db_path)

    def set_rule(self, alias: str, category: str) -> CategoryRule:
        rule = CategoryRule.create(alias=alias, category=category)
        with database_transaction(self.db_path) as connection:
            repository = CategoryRuleRepository(connection)
            canonical_category = repository.resolve_category(rule.category)
            rule = CategoryRule.create(alias=rule.alias, category=canonical_category)
            return repository.set(rule)

    def list_rules(self) -> list[CategoryRule]:
        with database_transaction(self.db_path) as connection:
            return CategoryRuleRepository(connection).list()

    def delete_rule(self, rule_id: int) -> None:
        with database_transaction(self.db_path) as connection:
            CategoryRuleRepository(connection).delete(rule_id)
