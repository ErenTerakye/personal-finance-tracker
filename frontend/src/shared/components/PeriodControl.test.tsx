import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { installAppTestLifecycle } from "../../test/appTestSupport";
import { I18nProvider } from "../i18n/I18nProvider";
import { PeriodControl, yearPage } from "./PeriodControl";

installAppTestLifecycle();

function renderCompactPeriodControl(
  onChange = vi.fn(),
  value = { month: 6, year: 2026 },
) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      media: query,
      matches: query === "(max-width: 63.999rem)",
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );

  render(
    <I18nProvider>
      <PeriodControl value={value} onChange={onChange} />
    </I18nProvider>,
  );
  return onChange;
}

describe("PeriodControl", () => {
  it("accumulates rapid month steps without waiting for a parent render", async () => {
    const onChange = renderCompactPeriodControl();
    const next = screen.getByRole("button", { name: /^Next month,/ });

    await userEvent.click(next);
    await userEvent.click(next);
    await userEvent.click(next);

    expect(onChange).toHaveBeenNthCalledWith(1, { month: 7, year: 2026 });
    expect(onChange).toHaveBeenNthCalledWith(2, { month: 8, year: 2026 });
    expect(onChange).toHaveBeenNthCalledWith(3, { month: 9, year: 2026 });
  });

  it("prepares pointer and keyboard period targets before selection", async () => {
    const onPrepare = vi.fn();
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        media: query,
        matches: query === "(max-width: 63.999rem)",
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );
    render(
      <I18nProvider>
        <PeriodControl
          value={{ month: 6, year: 2026 }}
          onChange={vi.fn()}
          onPrepare={onPrepare}
        />
      </I18nProvider>,
    );

    fireEvent.pointerEnter(
      screen.getByRole("button", { name: "Next month, July 2026" }),
    );
    expect(onPrepare).toHaveBeenCalledWith({ month: 7, year: 2026 });

    onPrepare.mockClear();
    fireEvent.focus(
      screen.getByRole("button", { name: "Previous month, May 2026" }),
    );
    expect(onPrepare).toHaveBeenCalledWith({ month: 5, year: 2026 });

    await userEvent.click(
      screen.getByRole("button", {
        name: "Choose period, current period is June 2026",
      }),
    );
    onPrepare.mockClear();
    fireEvent.pointerEnter(screen.getByRole("button", { name: "November" }));
    expect(onPrepare).toHaveBeenCalledWith({ month: 11, year: 2026 });
  });

  it("shows a visible static pending mark without disabling rapid controls", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    render(
      <I18nProvider>
        <PeriodControl
          value={{ month: 6, year: 2026 }}
          onChange={vi.fn()}
          busy
        />
      </I18nProvider>,
    );

    expect(document.querySelector(".period-pending-mark")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Next month,/ })).toBeEnabled();
  });

  it("uses a native anchored popover on desktop", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        media: query,
        matches: false,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );
    render(
      <I18nProvider>
        <PeriodControl value={{ month: 6, year: 2026 }} onChange={vi.fn()} />
      </I18nProvider>,
    );

    expect(document.querySelector(".period-popover")).toHaveAttribute(
      "popover",
      "auto",
    );
  });

  it("selects a month with roving arrow-key focus and Enter", async () => {
    const onChange = renderCompactPeriodControl();
    await userEvent.click(
      screen.getByRole("button", {
        name: "Choose period, current period is June 2026",
      }),
    );

    expect(screen.getByRole("button", { name: "June" })).toHaveFocus();
    await userEvent.keyboard("{ArrowRight}{Enter}");

    expect(onChange).toHaveBeenCalledWith({ month: 7, year: 2026 });
    expect(document.querySelector(".period-popover")).not.toHaveAttribute(
      "open",
    );
    expect(
      screen.getByRole("button", {
        name: "Choose period, current period is June 2026",
      }),
    ).not.toHaveAttribute("data-focus-origin");
  });

  it("supports End and Space for month selection", async () => {
    const onChange = renderCompactPeriodControl();
    await userEvent.click(
      screen.getByRole("button", {
        name: "Choose period, current period is June 2026",
      }),
    );

    await userEvent.keyboard("{End} ");
    expect(onChange).toHaveBeenCalledWith({ month: 12, year: 2026 });
  });

  it("chooses a nearby year before committing a month", async () => {
    const onChange = renderCompactPeriodControl();
    await userEvent.click(
      screen.getByRole("button", {
        name: "Choose period, current period is June 2026",
      }),
    );
    await userEvent.click(screen.getByRole("button", { name: "2026" }));

    const yearList = screen.getByRole("group", { name: "Year" });
    expect(within(yearList).getAllByRole("button")).toHaveLength(10);
    expect(
      within(yearList).getByRole("button", { name: "2026" }),
    ).toHaveFocus();

    await userEvent.keyboard("{ArrowRight}{Enter}");
    expect(screen.queryByRole("group", { name: "Year" })).toBeNull();
    expect(screen.getByRole("button", { name: "2027" })).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: "January" }));
    expect(onChange).toHaveBeenCalledWith({ month: 1, year: 2027 });
  });

  it("toggles the year grid closed from the year heading", async () => {
    renderCompactPeriodControl();
    await userEvent.click(
      screen.getByRole("button", {
        name: "Choose period, current period is June 2026",
      }),
    );
    const yearHeading = screen.getByRole("button", { name: "2026" });

    await userEvent.click(yearHeading);
    expect(screen.getByRole("group", { name: "Year" })).toBeVisible();

    await userEvent.click(yearHeading);
    expect(screen.queryByRole("group", { name: "Year" })).toBeNull();
    expect(screen.getByRole("group", { name: "Month" })).toBeVisible();
  });

  it("pages through years without a scrollable list", async () => {
    renderCompactPeriodControl();
    await userEvent.click(
      screen.getByRole("button", {
        name: "Choose period, current period is June 2026",
      }),
    );
    await userEvent.click(screen.getByRole("button", { name: "2026" }));

    const yearGrid = screen.getByRole("group", { name: "Year" });
    expect(yearGrid).toHaveClass("period-year-grid");
    expect(
      within(yearGrid).getByRole("button", { name: "2020" }),
    ).toBeVisible();
    expect(
      within(yearGrid).getByRole("button", { name: "2029" }),
    ).toBeVisible();

    await userEvent.click(
      screen.getByRole("button", { name: "Next years, 2030–2039" }),
    );
    expect(
      within(yearGrid).getByRole("button", { name: "2030" }),
    ).toBeVisible();
    expect(
      within(yearGrid).getByRole("button", { name: "2039" }),
    ).toBeVisible();
  });

  it("suppresses restored focus rings only for pointer selection", async () => {
    renderCompactPeriodControl();
    const trigger = screen.getByRole("button", {
      name: "Choose period, current period is June 2026",
    });
    await userEvent.click(trigger);
    await userEvent.click(screen.getByRole("button", { name: "July" }));

    await waitFor(() => expect(trigger).toHaveFocus());
    expect(trigger).toHaveAttribute("data-focus-origin", "pointer");
  });

  it("discards an uncommitted year when the sheet is dismissed", async () => {
    renderCompactPeriodControl();
    const trigger = screen.getByRole("button", {
      name: "Choose period, current period is June 2026",
    });
    await userEvent.click(trigger);
    await userEvent.click(
      screen.getByRole("button", { name: "Next year, 2027" }),
    );

    const picker = screen.getByRole("dialog", { name: "Choose a period" });
    fireEvent(picker, new Event("cancel", { cancelable: true }));
    await waitFor(() => expect(trigger).toHaveFocus());

    await userEvent.click(trigger);
    expect(screen.getByRole("button", { name: "2026" })).toBeVisible();
  });

  it("light-dismisses the compact sheet from its backdrop", async () => {
    renderCompactPeriodControl();
    const trigger = screen.getByRole("button", {
      name: "Choose period, current period is June 2026",
    });
    await userEvent.click(trigger);

    const picker = screen.getByRole("dialog", { name: "Choose a period" });
    fireEvent.click(picker);

    expect(picker).not.toHaveAttribute("open");
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("dismisses the surface with Escape", async () => {
    renderCompactPeriodControl();
    const trigger = screen.getByRole("button", {
      name: "Choose period, current period is June 2026",
    });
    await userEvent.click(trigger);

    await userEvent.keyboard("{Escape}");

    expect(document.querySelector(".period-popover")).not.toHaveAttribute(
      "open",
    );
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("keeps decade pages inside the valid year range", () => {
    expect(yearPage(1)).toEqual(
      Array.from({ length: 10 }, (_, index) => index + 1),
    );
    expect(yearPage(5000)).toEqual(
      Array.from({ length: 10 }, (_, index) => 5000 + index),
    );
    expect(yearPage(9999)).toEqual(
      Array.from({ length: 10 }, (_, index) => 9990 + index),
    );
  });
});
