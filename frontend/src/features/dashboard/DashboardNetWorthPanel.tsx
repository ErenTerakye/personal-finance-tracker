import { ArrowRight, Landmark } from "lucide-react";
import "./dashboard-net-worth.css";
import { formatDate } from "../../shared/format/dates";
import { signedMoney } from "../../shared/format/money";
import { useI18n } from "../../shared/i18n/I18nProvider";
import type { DashboardData } from "../../types";

export default function DashboardNetWorthPanel({
  netWorth,
  onNavigate,
}: {
  netWorth: DashboardData["net_worth"];
  onNavigate: () => void;
}) {
  const { t } = useI18n();

  return (
    <section
      className="dashboard-net-worth"
      aria-labelledby="cashflow-worth-title"
    >
      <Landmark aria-hidden="true" />
      <div>
        <p className="eyebrow">{t("dashboard.netWorth.title")}</p>
        <h2 id="cashflow-worth-title">
          {netWorth.active_account_count + netWorth.archived_account_count
            ? signedMoney(netWorth.total_net_worth)
            : t("dashboard.netWorth.emptyTitle")}
        </h2>
        <p>
          {netWorth.active_account_count + netWorth.archived_account_count
            ? t("dashboard.netWorth.asOf", {
                date: formatDate(netWorth.as_of),
              })
            : t("dashboard.netWorth.emptyMessage")}
        </p>
      </div>
      <button className="button ghost" type="button" onClick={onNavigate}>
        {t("dashboard.netWorth.action")}
        <ArrowRight aria-hidden="true" size={17} />
      </button>
    </section>
  );
}
