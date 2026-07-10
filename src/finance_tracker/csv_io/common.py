"""Shared CSV result models."""

from dataclasses import dataclass


@dataclass(frozen=True)
class ImportResult:
    imported_count: int
    skipped_count: int
    errors: list[str]
