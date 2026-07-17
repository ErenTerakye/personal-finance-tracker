import { Moon, Sun } from "lucide-react";
import { useI18n } from "../i18n/I18nProvider";
import { useTheme } from "../theme/ThemeProvider";

export function PreferenceChoiceGroups({ idPrefix }: { idPrefix: string }) {
  const { locale, setLocale, t } = useI18n();
  const { scheme, setScheme } = useTheme();

  return (
    <div className="preference-choice-groups">
      <fieldset className="preference-choice-group">
        <legend>{t("preferences.language")}</legend>
        <div className="preference-segments">
          {(["en", "tr"] as const).map((language) => (
            <label key={language}>
              <input
                type="radio"
                name={`${idPrefix}-language`}
                value={language}
                checked={locale === language}
                onChange={() => setLocale(language)}
              />
              <span>
                {t(
                  language === "en"
                    ? "preferences.english"
                    : "preferences.turkish",
                )}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="preference-choice-group">
        <legend>{t("preferences.appearance")}</legend>
        <div className="preference-segments">
          {(["light", "dark"] as const).map((colorScheme) => {
            const Icon = colorScheme === "light" ? Sun : Moon;
            return (
              <label key={colorScheme}>
                <input
                  type="radio"
                  name={`${idPrefix}-theme`}
                  value={colorScheme}
                  checked={scheme === colorScheme}
                  onChange={() => setScheme(colorScheme)}
                />
                <span>
                  <Icon aria-hidden="true" size={16} />
                  {t(`preferences.${colorScheme}`)}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>
    </div>
  );
}
