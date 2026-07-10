"""Trend report PNG chart rendering."""

from io import BytesIO
from pathlib import Path

from finance_tracker.charts.common import configure_matplotlib
from finance_tracker.reports.models import TrendReport


def save_trend_chart(report: TrendReport, output_path: Path | str) -> Path:
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(render_trend_chart_png(report))
    return path


def render_trend_chart_png(report: TrendReport) -> bytes:
    configure_matplotlib()

    import matplotlib.pyplot as plt

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
    buffer = BytesIO()
    fig.savefig(buffer, format="png")
    plt.close(fig)
    return buffer.getvalue()
