"""Category rule domain model and validation."""

from dataclasses import dataclass
from datetime import datetime

from finance_tracker.exceptions import ValidationError
from finance_tracker.models.common import validate_text


@dataclass(frozen=True)
class CategoryRule:
    alias: str
    category: str
    id: int | None = None
    created_at: datetime | None = None

    @classmethod
    def create(cls, alias: str, category: str) -> CategoryRule:
        alias_text = validate_text(alias, "alias")
        category_text = validate_text(category, "category")
        if alias_text.lower() == category_text.lower():
            raise ValidationError("Alias and category must be different.")
        return cls(alias=alias_text, category=category_text)
