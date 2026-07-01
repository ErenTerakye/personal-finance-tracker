import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { FormEvent, useEffect, useId, useState } from "react";
import { monthNames, periodLabel } from "../format";
import { IconButton, SubmitButton } from "./ui";

export interface PeriodValue {
  month: number;
  year: number;
}

export function PeriodControl({
  value,
  onChange,
  label = "Period"
}: {
  value: PeriodValue;
  onChange: (period: PeriodValue) => void;
  label?: string;
}) {
  const popoverId = useId();
  const monthId = useId();
  const yearId = useId();
  const [draft, setDraft] = useState(value);
  const previous = shiftPeriod(value, -1);
  const next = shiftPeriod(value, 1);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onChange({ month: Number(draft.month), year: Number(draft.year) });
    closePopover(popoverId);
  }

  return (
    <div className="period-control" aria-label={label}>
      <IconButton
        icon={ChevronLeft}
        label={`Previous month, ${periodLabel(previous.month, previous.year)}`}
        variant="secondary"
        onClick={() => onChange(previous)}
      />
      <button
        className="period-chip"
        type="button"
        popoverTarget={popoverId}
        aria-label={`Choose period, current period is ${periodLabel(value.month, value.year)}`}
      >
        <CalendarDays aria-hidden="true" size={17} />
        <span>{periodLabel(value.month, value.year)}</span>
      </button>
      <IconButton
        icon={ChevronRight}
        label={`Next month, ${periodLabel(next.month, next.year)}`}
        variant="secondary"
        onClick={() => onChange(next)}
      />
      <div className="period-popover" id={popoverId} popover="auto">
        <form className="period-picker" onSubmit={submit}>
          <div className="field compact-field">
            <label htmlFor={monthId}>Month</label>
            <select
              id={monthId}
              value={draft.month}
              onChange={(event) => setDraft({ ...draft, month: Number(event.target.value) })}
            >
              {monthNames.slice(1).map((name, index) => (
                <option key={name} value={index + 1}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div className="field compact-field">
            <label htmlFor={yearId}>Year</label>
            <input
              id={yearId}
              min="1"
              type="number"
              value={draft.year}
              onChange={(event) => setDraft({ ...draft, year: Number(event.target.value) })}
            />
          </div>
          <SubmitButton icon={CalendarDays}>Apply</SubmitButton>
        </form>
      </div>
    </div>
  );
}

function shiftPeriod(value: PeriodValue, delta: -1 | 1): PeriodValue {
  const date = new Date(value.year, value.month - 1 + delta, 1);
  return {
    month: date.getMonth() + 1,
    year: date.getFullYear()
  };
}

function closePopover(id: string) {
  const popover = document.getElementById(id) as (HTMLElement & { hidePopover?: () => void }) | null;
  popover?.hidePopover?.();
}
