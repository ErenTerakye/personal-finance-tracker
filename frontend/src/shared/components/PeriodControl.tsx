import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import {
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { monthNames, periodLabel } from "../format/periods";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { useI18n } from "../i18n/I18nProvider";
import { IconButton } from "./actions";

export interface PeriodValue {
  month: number;
  year: number;
}

type PickerView = "months" | "years";

const MIN_YEAR = 1;
const MAX_YEAR = 9999;
const YEAR_PAGE_SIZE = 10;

export function PeriodControl({
  value,
  onChange,
  onPrepare,
  label = "Period",
  busy = false,
}: {
  value: PeriodValue;
  onChange: (period: PeriodValue) => void;
  onPrepare?: (period: PeriodValue) => void;
  label?: string;
  busy?: boolean;
}) {
  const pickerId = useId();
  const yearListId = useId();
  const [draft, setDraft] = useState(value);
  const [pickerView, setPickerView] = useState<PickerView>("months");
  const [yearPageStart, setYearPageStart] = useState(() =>
    yearPage(value.year).at(0)!,
  );
  const [expanded, setExpanded] = useState(false);
  const latestValue = useRef(value);
  const focusOrigin = useRef<"keyboard" | "pointer">("keyboard");
  const pickerRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selectedMonthRef = useRef<HTMLButtonElement>(null);
  const selectedYearRef = useRef<HTMLButtonElement>(null);
  const monthRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const yearRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const compactLayout = useMediaQuery("(max-width: 63.999rem)");
  const narrowMonthGrid = useMediaQuery("(max-width: 26.25rem)");
  const previous = shiftPeriod(value, -1);
  const next = shiftPeriod(value, 1);
  const years = useMemo(
    () => yearsFromPageStart(yearPageStart),
    [yearPageStart],
  );
  const { t } = useI18n();

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useLayoutEffect(() => {
    latestValue.current = value;
  }, [value]);

  useLayoutEffect(() => {
    if (!expanded) return;
    if (pickerView === "months") {
      applyFocusOrigin(selectedMonthRef.current, focusOrigin.current);
      selectedMonthRef.current?.focus();
      return;
    }
    applyFocusOrigin(selectedYearRef.current, focusOrigin.current);
    selectedYearRef.current?.focus();
  }, [expanded, pickerView]);

  useEffect(() => {
    const picker = pickerRef.current;
    if (!picker || (!picker.open && !isPopoverOpen(picker))) return;
    closePickerElement(picker);
    setExpanded(false);
    setDraft(value);
    setPickerView("months");
  }, [compactLayout, value]);

  function resetPicker() {
    setDraft(value);
    setPickerView("months");
    setYearPageStart(yearPage(value.year).at(0)!);
  }

  function openCompactPicker() {
    const picker = pickerRef.current;
    if (!picker) return;
    resetPicker();
    delete picker.dataset.entered;
    picker.showModal();
    requestAnimationFrame(() => {
      if (picker.open) picker.dataset.entered = "true";
    });
    setExpanded(true);
  }

  function closePicker() {
    const picker = pickerRef.current;
    if (!picker) return;
    closePickerElement(picker);
  }

  function finishClosing() {
    const picker = pickerRef.current;
    if (picker) delete picker.dataset.entered;
    setExpanded(false);
    resetPicker();
    requestAnimationFrame(() => {
      applyFocusOrigin(triggerRef.current, focusOrigin.current);
      triggerRef.current?.focus();
    });
  }

  function choosePeriod(period: PeriodValue) {
    latestValue.current = period;
    onChange(period);
    closePicker();
  }

  function chooseYear(year: number) {
    setDraft((period) => ({ ...period, year }));
    setPickerView("months");
  }

  function showYears() {
    setYearPageStart(yearPage(draft.year).at(0)!);
    setPickerView("years");
  }

  function showMonths() {
    setPickerView("months");
  }

  function markPointerFocus(event: ReactPointerEvent<HTMLButtonElement>) {
    focusOrigin.current = "pointer";
    event.currentTarget.dataset.focusOrigin = "pointer";
    if (triggerRef.current) {
      triggerRef.current.dataset.focusOrigin = "pointer";
    }
  }

  function markKeyboardFocus(event: ReactKeyboardEvent<HTMLButtonElement>) {
    focusOrigin.current = "keyboard";
    delete event.currentTarget.dataset.focusOrigin;
    if (triggerRef.current) {
      delete triggerRef.current.dataset.focusOrigin;
    }
  }

  function clearPointerFocus(event: ReactFocusEvent<HTMLButtonElement>) {
    delete event.currentTarget.dataset.focusOrigin;
  }

  function step(delta: -1 | 1) {
    const period = shiftPeriod(latestValue.current, delta);
    // Keep navigation responsive when several clicks land before React renders.
    latestValue.current = period;
    onChange(period);
  }

  function moveMonthFocus(
    event: ReactKeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    const columns = narrowMonthGrid ? 3 : 4;
    const nextIndex = keyboardIndex(event.key, index, 12, columns);
    if (nextIndex === null) return;
    event.preventDefault();
    monthRefs.current[nextIndex]?.focus();
  }

  function moveYearFocus(
    event: ReactKeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    const nextIndex = keyboardIndex(event.key, index, years.length, 5);
    if (nextIndex === null) return;
    event.preventDefault();
    yearRefs.current[nextIndex]?.focus();
  }

  return (
    <div className="period-control" role="group" aria-label={label}>
      <IconButton
        icon={ChevronLeft}
        label={t("periodControl.prevMonth", {
          period: periodLabel(previous.month, previous.year),
        })}
        variant="secondary"
        onFocus={() => onPrepare?.(previous)}
        onPointerEnter={() => onPrepare?.(previous)}
        onClick={() => step(-1)}
      />
      <button
        ref={triggerRef}
        className="period-chip"
        type="button"
        popoverTarget={compactLayout ? undefined : pickerId}
        aria-controls={pickerId}
        aria-expanded={expanded}
        aria-haspopup="dialog"
        aria-label={t("periodControl.choosePeriod", {
          period: periodLabel(value.month, value.year),
        })}
        onClick={compactLayout ? openCompactPicker : undefined}
        onPointerDown={markPointerFocus}
        onKeyDown={markKeyboardFocus}
        onBlur={clearPointerFocus}
      >
        <CalendarDays aria-hidden="true" size={17} />
        <span>{periodLabel(value.month, value.year)}</span>
        {busy ? (
          <span className="period-pending-mark" aria-hidden="true" />
        ) : null}
      </button>
      <IconButton
        icon={ChevronRight}
        label={t("periodControl.nextMonth", {
          period: periodLabel(next.month, next.year),
        })}
        variant="secondary"
        onFocus={() => onPrepare?.(next)}
        onPointerEnter={() => onPrepare?.(next)}
        onClick={() => step(1)}
      />

      <dialog
        ref={pickerRef}
        className="period-popover"
        id={pickerId}
        popover={compactLayout ? undefined : "auto"}
        aria-label={t("periodControl.pickerTitle")}
        onClick={(event) => {
          if (compactLayout && event.target === event.currentTarget) {
            closePicker();
          }
        }}
        onCancel={(event) => {
          event.preventDefault();
          closePicker();
        }}
        onKeyDown={(event) => {
          if (event.key !== "Escape") return;
          event.preventDefault();
          closePicker();
        }}
        onClose={finishClosing}
        onToggle={(event) => {
          if (event.currentTarget.open || isPopoverOpen(event.currentTarget)) {
            resetPicker();
            setExpanded(true);
          } else {
            finishClosing();
          }
        }}
      >
        <div className="period-sheet-header">
          <h2 aria-hidden="true">{t("periodControl.pickerTitle")}</h2>
          <IconButton
            icon={X}
            label={t("periodControl.closePicker")}
            variant="ghost"
            onClick={closePicker}
          />
        </div>

        <div className="period-picker">
          <div className="period-year-stepper">
            <IconButton
              icon={ChevronLeft}
              label={
                pickerView === "months"
                  ? t("periodControl.prevYear", { year: draft.year - 1 })
                  : t("periodControl.prevYears", {
                      range: pageRange(previousYearPageStart(yearPageStart)),
                    })
              }
              variant="ghost"
              disabled={
                pickerView === "months"
                  ? draft.year <= MIN_YEAR
                  : yearPageStart <= MIN_YEAR
              }
              onClick={() => {
                if (pickerView === "years") {
                  setYearPageStart(previousYearPageStart(yearPageStart));
                } else {
                  setDraft((period) => ({
                    ...period,
                    year: Math.max(MIN_YEAR, period.year - 1),
                  }));
                }
              }}
            />
            <button
              className="period-year-trigger"
              type="button"
              aria-expanded={pickerView === "years"}
              aria-controls={yearListId}
              onClick={pickerView === "years" ? showMonths : showYears}
              onPointerDown={markPointerFocus}
              onKeyDown={markKeyboardFocus}
              onBlur={clearPointerFocus}
            >
              <span>{draft.year}</span>
              <ChevronDown aria-hidden="true" size={16} />
            </button>
            <IconButton
              icon={ChevronRight}
              label={
                pickerView === "months"
                  ? t("periodControl.nextYear", { year: draft.year + 1 })
                  : t("periodControl.nextYears", {
                      range: pageRange(nextYearPageStart(yearPageStart)),
                    })
              }
              variant="ghost"
              disabled={
                pickerView === "months"
                  ? draft.year >= MAX_YEAR
                  : yearPageStart + YEAR_PAGE_SIZE > MAX_YEAR
              }
              onClick={() => {
                if (pickerView === "years") {
                  setYearPageStart(nextYearPageStart(yearPageStart));
                } else {
                  setDraft((period) => ({
                    ...period,
                    year: Math.min(MAX_YEAR, period.year + 1),
                  }));
                }
              }}
            />
          </div>

          {pickerView === "months" ? (
            <div
              className="period-month-grid period-picker-grid"
              key="months"
              role="group"
              aria-label={t("periodControl.monthLabel")}
            >
              {monthNames.slice(1).map((name, index) => {
                const month = index + 1;
                const selected = month === draft.month;
                return (
                  <button
                    ref={(element) => {
                      monthRefs.current[index] = element;
                      if (selected) selectedMonthRef.current = element;
                    }}
                    className="period-month-option"
                    type="button"
                    key={name}
                    tabIndex={selected ? 0 : -1}
                    aria-pressed={selected}
                    onPointerDown={markPointerFocus}
                    onPointerEnter={() =>
                      onPrepare?.({ month, year: draft.year })
                    }
                    onFocus={() => onPrepare?.({ month, year: draft.year })}
                    onBlur={clearPointerFocus}
                    onKeyDown={(event) => {
                      markKeyboardFocus(event);
                      moveMonthFocus(event, index);
                    }}
                    onClick={() => choosePeriod({ month, year: draft.year })}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
          ) : (
            <div
              className="period-year-grid period-picker-grid"
              key="years"
              id={yearListId}
              role="group"
              aria-label={t("periodControl.yearLabel")}
            >
              {years.map((year, index) => {
                const selected = year === draft.year;
                return (
                  <button
                    ref={(element) => {
                      yearRefs.current[index] = element;
                      if (selected) selectedYearRef.current = element;
                    }}
                    className="period-year-option"
                    type="button"
                    key={year}
                    tabIndex={selected ? 0 : -1}
                    aria-pressed={selected}
                    onPointerDown={markPointerFocus}
                    onBlur={clearPointerFocus}
                    onKeyDown={(event) => {
                      markKeyboardFocus(event);
                      moveYearFocus(event, index);
                    }}
                    onClick={() => chooseYear(year)}
                  >
                    {year}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </dialog>
    </div>
  );
}

export function yearPage(center: number): number[] {
  const start = yearPageStartFor(center);
  return yearsFromPageStart(start);
}

function yearPageStartFor(center: number): number {
  if (center < 10) return MIN_YEAR;
  return Math.min(Math.floor(center / 10) * 10, 9990);
}

function yearsFromPageStart(start: number): number[] {
  return Array.from(
    { length: Math.min(YEAR_PAGE_SIZE, MAX_YEAR - start + 1) },
    (_, index) => start + index,
  );
}

function previousYearPageStart(start: number): number {
  return Math.max(MIN_YEAR, start - YEAR_PAGE_SIZE);
}

function nextYearPageStart(start: number): number {
  return Math.min(9990, start + YEAR_PAGE_SIZE);
}

function pageRange(start: number): string {
  return `${start}\u2013${Math.min(MAX_YEAR, start + YEAR_PAGE_SIZE - 1)}`;
}

function applyFocusOrigin(
  element: HTMLButtonElement | null,
  origin: "keyboard" | "pointer",
) {
  if (!element) return;
  if (origin === "pointer") {
    element.dataset.focusOrigin = "pointer";
  } else {
    delete element.dataset.focusOrigin;
  }
}

function keyboardIndex(
  key: string,
  index: number,
  itemCount: number,
  columns: number,
): number | null {
  if (key === "Home") return 0;
  if (key === "End") return itemCount - 1;

  const delta =
    key === "ArrowRight" || key === "ArrowDown"
      ? key === "ArrowDown"
        ? columns
        : 1
      : key === "ArrowLeft" || key === "ArrowUp"
        ? key === "ArrowUp"
          ? -columns
          : -1
        : null;
  if (delta === null) return null;
  return (index + delta + itemCount) % itemCount;
}

function shiftPeriod(value: PeriodValue, delta: -1 | 1): PeriodValue {
  const date = new Date(value.year, value.month - 1 + delta, 1);
  return {
    month: date.getMonth() + 1,
    year: date.getFullYear(),
  };
}

function isPopoverOpen(picker: HTMLDialogElement): boolean {
  try {
    return picker.matches(":popover-open");
  } catch {
    return false;
  }
}

function closePickerElement(picker: HTMLDialogElement) {
  if (picker.open) {
    picker.close();
  } else if (isPopoverOpen(picker)) {
    picker.hidePopover?.();
  }
}
