import { CalendarCheck, GitMerge } from "lucide-react";
import { useI18n } from "../../../shared/i18n/I18nProvider";

export function RulesIntro() {
  const { t } = useI18n();
  return (
    <div className="rules-intro-grid">
      <article className="info-card">
        <div className="info-card-icon" aria-hidden="true">
          <GitMerge size={20} />
        </div>
        <div className="info-card-content">
          <h3>{t("rules.infoCard1Title")}</h3>
          <p>{t("rules.infoCard1Desc")}</p>
        </div>
      </article>

      <article className="info-card">
        <div className="info-card-icon" aria-hidden="true">
          <CalendarCheck size={20} />
        </div>
        <div className="info-card-content">
          <h3>{t("rules.infoCard2Title")}</h3>
          <p>{t("rules.infoCard2Desc")}</p>
        </div>
      </article>
    </div>
  );
}
