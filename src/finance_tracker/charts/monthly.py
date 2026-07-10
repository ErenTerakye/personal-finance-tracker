"""Monthly report PNG chart rendering."""

from io import BytesIO
from pathlib import Path

from finance_tracker.charts.common import configure_matplotlib
from finance_tracker.reports.models import MonthlyReport


def save_monthly_chart(report: MonthlyReport, output_path: Path | str) -> Path:
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(render_monthly_chart_png(report))
    return path


def render_monthly_chart_png(report: MonthlyReport) -> bytes:
    configure_matplotlib()

    import matplotlib.pyplot as plt

    buffer = BytesIO()
    fig, axes = plt.subplots(1, 2, figsize=(12, 5))
    fig.suptitle(f"Financial Report {report.year}-{report.month:02d}")

    axes[0].bar(
        ["Income", "Expenses", "Net"],
        [
            float(report.total_income),
            float(report.total_expenses),
            float(report.net_savings),
        ],
    )
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
    fig.savefig(buffer, format="png")
    plt.close(fig)
    return buffer.getvalue()
