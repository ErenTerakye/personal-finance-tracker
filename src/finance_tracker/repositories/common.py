"""Shared repository query helpers."""


def period_bounds(year: int, month: int) -> tuple[str, str]:
    start = f"{year:04d}-{month:02d}-01"
    end = f"{year + 1:04d}-01-01" if month == 12 else f"{year:04d}-{month + 1:02d}-01"
    return start, end
