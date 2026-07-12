import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { monthNames, periodLabel } from "../format/periods";
import { useI18n } from "../i18n/I18nProvider";
import { IconButton } from "./actions";

export interface PeriodValue {
  month: number;
  year: number;
}

export function PeriodControl({
  value,
  onChange,
  label = "Period",
}: {
  value: PeriodValue;
  onChange: (period: PeriodValue) => void;
  label?: string;
}) {
  const popoverId = useId();
  const monthId = useId();
  const yearId = useId();
  const [draft, setDraft] = useState(value);
  const latestValue = useRef(value);
  const previous = shiftPeriod(value, -1);
  const next = shiftPeriod(value, 1);
  const { t } = useI18n();

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useLayoutEffect(() => {
    latestValue.current = value;
  }, [value]);

  function applyDraft() {
    const period = { month: Number(draft.month), year: Number(draft.year) };
    latestValue.current = period;
    onChange(period);
    closePopover(popoverId);
  }

  function step(delta: -1 | 1) {
    const period = shiftPeriod(latestValue.current, delta);
    // Keep navigation responsive when several clicks land before React renders.
    latestValue.current = period;
    onChange(period);
  }

  const periodTrigger = (
    <button
      className="period-chip"
      type="button"
      popoverTarget={popoverId}
      aria-label={t("periodControl.choosePeriod", {
        period: periodLabel(value.month, value.year),
      })}
    >
      <CalendarDays aria-hidden="true" size={17} />
      <span>{periodLabel(value.month, value.year)}</span>
    </button>
  );

  return (
    <div className="period-control" role="group" aria-label={label}>
      <IconButton
        icon={ChevronLeft}
        label={t("periodControl.prevMonth", {
          period: periodLabel(previous.month, previous.year),
        })}
        variant="secondary"
        onClick={() => step(-1)}
      />
      {periodTrigger}
      <IconButton
        icon={ChevronRight}
        label={t("periodControl.nextMonth", {
          period: periodLabel(next.month, next.year),
        })}
        variant="secondary"
        onClick={() => step(1)}
      />
      <div className="period-popover" id={popoverId} popover="auto">
        <div className="period-picker">
          <div className="field compact-field">
            <label htmlFor={monthId}>{t("periodControl.monthLabel")}</label>
            <select
              id={monthId}
              value={draft.month}
              onChange={(event) =>
                setDraft({ ...draft, month: Number(event.target.value) })
              }
            >
              {monthNames.slice(1).map((name, index) => (
                <option key={name} value={index + 1}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div className="field compact-field">
            <label htmlFor={yearId}>{t("periodControl.yearLabel")}</label>
            <input
              id={yearId}
              min="1"
              type="number"
              value={draft.year}
              onChange={(event) =>
                setDraft({ ...draft, year: Number(event.target.value) })
              }
            />
          </div>
          <button className="button primary" type="button" onClick={applyDraft}>
            <CalendarDays aria-hidden="true" size={18} />
            {t("periodControl.applyBtn")}
          </button>
        </div>
      </div>
    </div>
  );
}

function shiftPeriod(value: PeriodValue, delta: -1 | 1): PeriodValue {
  const date = new Date(value.year, value.month - 1 + delta, 1);
  return {
    month: date.getMonth() + 1,
    year: date.getFullYear(),
  };
}

function closePopover(id: string) {
  const popover = document.getElementById(id) as
    (HTMLElement & { hidePopover?: () => void }) | null;
  popover?.hidePopover?.();
}
