import { ArrowRight, PiggyBank } from "lucide-react";
import "./dashboard-net-worth.css";
import { ActionButton } from "../../shared/components/actions";
import { EmptyState } from "../../shared/components/feedback";
import { Panel } from "../../shared/components/lists";
import { formatDate } from "../../shared/format/dates";
import { money } from "../../shared/format/money";
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
    <section className="dashboard-net-worth">
      <Panel
        title={t("dashboard.netWorth.title")}
        detail={t("dashboard.netWorth.asOf", {
          date: formatDate(netWorth.as_of),
        })}
        actions={
          <button className="button ghost" type="button" onClick={onNavigate}>
            {t("dashboard.netWorth.action")}
            <ArrowRight aria-hidden="true" size={17} />
          </button>
        }
      >
        {netWorth.active_account_count + netWorth.archived_account_count ===
        0 ? (
          <EmptyState
            icon={PiggyBank}
            title={t("dashboard.netWorth.emptyTitle")}
            message={t("dashboard.netWorth.emptyMessage")}
            action={
              <ActionButton icon={PiggyBank} onClick={onNavigate}>
                {t("dashboard.netWorth.addAccount")}
              </ActionButton>
            }
          />
        ) : (
          <dl className="dashboard-net-worth-summary">
            <div>
              <dt>{t("dashboard.netWorth.netWorth")}</dt>
              <dd>{money(netWorth.total_net_worth)}</dd>
            </div>
            <div>
              <dt>{t("dashboard.netWorth.assets")}</dt>
              <dd>{money(netWorth.total_assets)}</dd>
            </div>
            <div>
              <dt>{t("dashboard.netWorth.liabilities")}</dt>
              <dd>{money(netWorth.total_liabilities)}</dd>
            </div>
            {netWorth.unresolved_account_count ? (
              <div className="dashboard-net-worth-coverage">
                <dt>{t("dashboard.netWorth.coverageLabel")}</dt>
                <dd>
                  {t("dashboard.netWorth.coverage", {
                    count: netWorth.unresolved_account_count,
                  })}
                </dd>
              </div>
            ) : null}
          </dl>
        )}
      </Panel>
    </section>
  );
}
