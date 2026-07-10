import { money, signedMoney } from "../format/money";
import { periodLabel } from "../format/periods";
import { useI18n } from "../i18n/I18nProvider";
import type { TrendMonth } from "./geometry";

export function ChartDataTable({ months }: { months: TrendMonth[] }) {
  const { t } = useI18n();
  return (
    <details className="chart-data">
      <summary>{t("charts.dataTable")}</summary>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">{t("charts.period")}</th>
              <th scope="col">{t("charts.income")}</th>
              <th scope="col">{t("charts.expenses")}</th>
              <th scope="col">{t("charts.net")}</th>
            </tr>
          </thead>
          <tbody>
            {months.map((item) => (
              <tr key={item.label}>
                <th scope="row">{periodLabel(item.month, item.year)}</th>
                <td>{money(item.total_income)}</td>
                <td>{money(item.total_expenses)}</td>
                <td>{signedMoney(item.net_savings)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
