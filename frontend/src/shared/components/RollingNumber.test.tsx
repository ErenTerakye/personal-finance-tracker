import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RollingNumber } from "./RollingNumber";

const format = (value: number) => `$${value.toFixed(2)}`;

describe("RollingNumber", () => {
  it("keeps one accessible value while rolling changed digits upward", () => {
    const { container, rerender } = render(
      <strong>
        <RollingNumber value={120} format={format} />
      </strong>,
    );

    rerender(
      <strong>
        <RollingNumber value={145} previousValue={120} format={format} />
      </strong>,
    );

    expect(screen.getByText("$145.00")).toBeInTheDocument();
    expect(container.querySelector(".rolling-number")).toHaveClass(
      "is-rolling-up",
    );
    expect(container.querySelectorAll(".rolling-number-reel").length).toBe(2);
    expect(container).toHaveTextContent("$145.00");
    expect(container).not.toHaveTextContent("$120.00");
  });

  it("rolls downward when the numeric value decreases", () => {
    const { container, rerender } = render(
      <RollingNumber value={145} format={format} />,
    );

    rerender(<RollingNumber value={95} previousValue={145} format={format} />);

    expect(container.querySelector(".rolling-number")).toHaveClass(
      "is-rolling-down",
    );
    expect(screen.getByText("$95.00")).toBeInTheDocument();
  });

  it("does not reserve leading slots when the new value has fewer digits", () => {
    const { container } = render(
      <RollingNumber value={0} previousValue={4_500} format={format} />,
    );

    const characters = Array.from(
      container.querySelectorAll<HTMLElement>("[data-character]"),
      (element) => element.dataset.character,
    );

    expect(characters).toEqual(Array.from("$0.00"));
    expect(characters).not.toContain("\u00a0");
  });
});
