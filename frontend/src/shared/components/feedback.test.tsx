import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { installAppTestLifecycle } from "../../test/appTestSupport";
import { I18nProvider } from "../i18n/I18nProvider";
import { ErrorBanner } from "./feedback";

installAppTestLifecycle();

function renderBanner(message: string, onRetry?: () => void) {
  return render(
    <I18nProvider>
      <ErrorBanner message={message} onRetry={onRetry} />
    </I18nProvider>,
  );
}

describe("ErrorBanner", () => {
  it("announces the message without exposing a recovery action by default", () => {
    renderBanner("The entry could not be saved.");

    expect(screen.getByRole("alert")).toHaveTextContent(
      "The entry could not be saved.",
    );
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
  });

  it("renders a native localized retry action when recovery is available", async () => {
    const onRetry = vi.fn();
    renderBanner("Load failed", onRetry);

    const retry = screen.getByRole("button", { name: "Retry" });
    expect(retry).toHaveAttribute("type", "button");
    await userEvent.click(retry);

    expect(onRetry).toHaveBeenCalledOnce();
  });
});
