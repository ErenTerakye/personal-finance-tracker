import { CSSProperties, useId } from "react";
import { compactMoney, money, shortPeriodLabel, signedMoney } from "../format";
import type { DashboardData } from "../types";
import { EmptyState } from "./ui";

type TrendMonth = DashboardData["trend"]["months"][number];

type VariableStyle = CSSProperties & Record<`--${string}`, string | number>;

export function StatementTape({ months }: { months: TrendMonth[] }) {
  if (!months.length) {
    return <EmptyState title="No trend yet" message="Add transactions to build a cashflow strip." />;
  }

  const max = Math.max(
    1,
    ...months.flatMap((item) => [
      Math.abs(Number(item.total_income)),
      Math.abs(Number(item.total_expenses)),
      Math.abs(Number(item.net_savings))
    ])
  );

  return (
    <figure className="statement-tape">
      <figcaption>
        <strong>Six-month cashflow strip</strong>
        <span>Income, outflow, and net movement by close period.</span>
      </figcaption>
      <ol aria-label="Six-month cashflow summary">
        {months.map((item) => {
          const income = (Math.abs(Number(item.total_income)) / max) * 100;
          const expense = (Math.abs(Number(item.total_expenses)) / max) * 100;
          const net = (Math.abs(Number(item.net_savings)) / max) * 100;
          const positive = Number(item.net_savings) >= 0;
          return (
            <li
              key={item.label}
              className={positive ? "positive" : "negative"}
              style={
                {
                  "--income-size": `${income}%`,
                  "--expense-size": `${expense}%`,
                  "--net-size": `${Math.max(6, net)}%`
                } as VariableStyle
              }
            >
              <time dateTime={`${item.year}-${String(item.month).padStart(2, "0")}`}>
                {shortPeriodLabel(item.month, item.year)}
              </time>
              <div className="tape-bars" aria-hidden="true">
                <span className="cash" />
                <span className="outflow" />
                <span className="net" />
              </div>
              <strong>{signedMoney(item.net_savings)}</strong>
              <span>{item.transaction_count} entries</span>
            </li>
          );
        })}
      </ol>
    </figure>
  );
}

export function TrendLines({ months }: { months: TrendMonth[] }) {
  const titleId = useId();
  const descId = useId();

  if (!months.length) {
    return <EmptyState title="No trend data" message="The trend appears after transactions are posted." />;
  }

  const values = months.flatMap((item) => [
    Number(item.total_income),
    Number(item.total_expenses),
    Number(item.net_savings)
  ]);
  const min = Math.min(0, ...values);
  const max = Math.max(1, ...values);
  const span = max - min || 1;
  const x = (index: number) => 56 + (index * 612) / Math.max(months.length - 1, 1);
  const y = (value: number) => 250 - ((value - min) / span) * 190;
  const points = (key: "total_income" | "total_expenses" | "net_savings") =>
    months.map((item, index) => `${x(index)},${y(Number(item[key]))}`).join(" ");

  return (
    <figure className="line-chart">
      <svg
        role="img"
        aria-labelledby={`${titleId} ${descId}`}
        viewBox="0 0 720 300"
        preserveAspectRatio="xMidYMid meet"
      >
        <title id={titleId}>Six-month income, expense, and net savings trend</title>
        <desc id={descId}>
          Line chart comparing income, outflow, and net savings across the selected period.
        </desc>
        <line className="axis" x1="56" x2="680" y1="250" y2="250" />
        <line className="axis" x1="56" x2="56" y1="42" y2="250" />
        <polyline className="chart-line cash-line" points={points("total_income")} />
        <polyline className="chart-line outflow-line" points={points("total_expenses")} />
        <polyline className="chart-line net-line" points={points("net_savings")} />
        {months.map((item, index) => (
          <g key={item.label}>
            <text x={x(index)} y="282" textAnchor="middle">
              {item.label.slice(5)}
            </text>
          </g>
        ))}
      </svg>
      <figcaption>
        <span className="legend cash">Income</span>
        <span className="legend outflow">Outflow</span>
        <span className="legend net">Net</span>
      </figcaption>
    </figure>
  );
}

export function CategoryBars({
  title,
  items
}: {
  title: string;
  items: { label: string; value: string }[];
}) {
  if (!items.length) {
    return <EmptyState title="No category data" message="Categories appear after matching records exist." />;
  }

  const max = Math.max(1, ...items.map((item) => Math.abs(Number(item.value))));
  return (
    <div className="category-bars" aria-label={title}>
      {items.map((item) => (
        <div
          className="category-bar"
          key={item.label}
          style={{ "--bar-size": `${(Math.abs(Number(item.value)) / max) * 100}%` } as VariableStyle}
        >
          <span>{item.label}</span>
          <div aria-hidden="true">
            <span />
          </div>
          <strong>{money(item.value)}</strong>
        </div>
      ))}
    </div>
  );
}

export function KpiCard({
  label,
  value,
  detail,
  tone = "neutral"
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: "cash" | "outflow" | "warning" | "neutral";
}) {
  return (
    <article className={`kpi-card ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {detail ? <em>{detail}</em> : null}
    </article>
  );
}

export function compactValue(value: string | number): string {
  return compactMoney(value);
}
