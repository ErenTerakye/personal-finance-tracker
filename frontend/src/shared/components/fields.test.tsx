import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Field } from "./fields";

describe("Field", () => {
  it("associates hints with the field while preserving existing descriptions", () => {
    render(
      <>
        <p id="existing-description">Existing description</p>
        <Field id="account" label="Account" hint="Choose the source account">
          <select id="account" aria-describedby="existing-description">
            <option>Checking</option>
          </select>
        </Field>
      </>,
    );

    expect(screen.getByLabelText("Account")).toHaveAttribute(
      "aria-describedby",
      "existing-description account-hint",
    );
    expect(screen.getByText("Choose the source account")).toHaveAttribute(
      "id",
      "account-hint",
    );
  });
});
