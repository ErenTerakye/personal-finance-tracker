import { compactMoney } from "../format/money";

export function KpiCard({
  label,
  value,
  detail,
  tone = "neutral",
  featured = false,
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: "cash" | "expenses" | "warning" | "neutral";
  featured?: boolean;
}) {
  return (
    <article
      className={`kpi-card ${tone} ${featured ? "featured" : ""}`.trim()}
    >
      <span>{label}</span>
      <strong>{value}</strong>
      {detail ? <em>{detail}</em> : null}
    </article>
  );
}

export function compactValue(value: string | number): string {
  return compactMoney(value);
}
