"""Chart generation for monthly reports."""

import os
import tempfile
from pathlib import Path

from finance_tracker.reports import MonthlyReport, TrendReport


def _configure_matplotlib() -> None:
    cache_dir = Path(tempfile.gettempdir()) / "finance-tracker-matplotlib"
    cache_dir.mkdir(parents=True, exist_ok=True)
    os.environ.setdefault("MPLCONFIGDIR", str(cache_dir))
    os.environ.setdefault("MPLBACKEND", "Agg")


def save_monthly_chart(report: MonthlyReport, output_path: Path | str) -> Path:
    _configure_matplotlib()

    import matplotlib.pyplot as plt

    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)

    fig, axes = plt.subplots(1, 2, figsize=(12, 5))
    fig.suptitle(f"Financial Report {report.year}-{report.month:02d}")

    axes[0].bar(["Income", "Expenses", "Net"], [
        float(report.total_income),
        float(report.total_expenses),
        float(report.net_savings),
    ])
    axes[0].set_title("Monthly totals")
    axes[0].set_ylabel("Amount")

    if report.expenses_by_category:
        labels = list(report.expenses_by_category.keys())
        values = [float(value) for value in report.expenses_by_category.values()]
        axes[1].pie(values, labels=labels, autopct="%1.1f%%")
        axes[1].set_title("Expenses by category")
    else:
        axes[1].text(0.5, 0.5, "No expenses", ha="center", va="center")
        axes[1].set_axis_off()

    fig.tight_layout()
    fig.savefig(path)
    plt.close(fig)
    return path


def save_trend_chart(report: TrendReport, output_path: Path | str) -> Path:
    _configure_matplotlib()

    import matplotlib.pyplot as plt

    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)

    labels = [f"{period.year}-{period.month:02d}" for period in report.months]
    income = [float(period.total_income) for period in report.months]
    expenses = [float(period.total_expenses) for period in report.months]
    net_savings = [float(period.net_savings) for period in report.months]

    fig, ax = plt.subplots(figsize=(10, 5))
    ax.plot(labels, income, marker="o", label="Income")
    ax.plot(labels, expenses, marker="o", label="Expenses")
    ax.plot(labels, net_savings, marker="o", label="Net savings")
    ax.set_title("Financial Trends")
    ax.set_xlabel("Month")
    ax.set_ylabel("Amount")
    ax.legend()
    ax.grid(True, alpha=0.3)
    plt.xticks(rotation=35, ha="right")

    fig.tight_layout()
    fig.savefig(path)
    plt.close(fig)
    return path
