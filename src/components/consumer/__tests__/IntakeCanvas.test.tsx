import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { IntakeCanvas } from "@/components/consumer/IntakeCanvas";
import { BYOK_FAILURE_MESSAGE } from "@/services/ai/errors";
import { MIN_TOUCH_TARGET_PX } from "@/lib/consumer/triageUi";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: ReactNode;
    href: string;
  } & AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe("IntakeCanvas consumer flow", () => {
  it("requires consent before submitting triage", async () => {
    const user = userEvent.setup();
    const submitTriage = vi.fn();
    render(<IntakeCanvas submitTriage={submitTriage} />);

    await user.type(
      screen.getByLabelText(/what feels wrong/i),
      "mild cough for two days",
    );
    await user.click(
      screen.getByRole("button", { name: /get triage guidance/i }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /confirm the consent statement/i,
    );
    expect(submitTriage).not.toHaveBeenCalled();
  });

  it("keeps touch targets at least 48px for primary controls", () => {
    render(<IntakeCanvas submitTriage={vi.fn()} />);
    const submit = screen.getAllByRole("button", {
      name: /get triage guidance/i,
    })[0]!;
    expect(submit).toHaveStyle({ minHeight: `${MIN_TOUCH_TARGET_PX}px` });
    const speak = screen.getAllByRole("button", { name: /speak/i })[0]!;
    expect(speak).toHaveStyle({ minHeight: `${MIN_TOUCH_TARGET_PX}px` });
  });

  it("never exposes BYOK or provider controls in the ordinary flow", () => {
    render(<IntakeCanvas submitTriage={vi.fn()} />);
    expect(screen.queryByText(/bring your own/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/api key/i)).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText(/provider credential/i),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/openai/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/anthropic/i)).not.toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: /open advanced settings/i })[0],
    ).toHaveAttribute("href", "/settings");
  });

  it("renders emergency takeover from a diverted response", async () => {
    const user = userEvent.setup();
    const submitTriage = vi.fn(async () => ({
      ok: true as const,
      encounterId: "enc-1",
      status: "diverted_emergency" as const,
      emergency: {
        action: "Call Local Emergency Services",
        locale: "en-US",
        known: false,
      },
      matchedRuleIds: ["chest-pain"],
    }));

    render(<IntakeCanvas submitTriage={submitTriage} />);
    await user.type(
      screen.getAllByLabelText(/what feels wrong/i)[0]!,
      "sudden crushing chest pain",
    );
    await user.click(screen.getAllByRole("checkbox")[0]!);
    await user.click(
      screen.getAllByRole("button", { name: /get triage guidance/i })[0]!,
    );

    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByText("Call Local Emergency Services")).toBeInTheDocument();
  });

  it("shows a safe retry state for malformed model output", async () => {
    const user = userEvent.setup();
    const submitTriage = vi.fn(async () => ({
      ok: false as const,
      code: "MALFORMED_MODEL_OUTPUT" as const,
      message: "raw zod dump",
      retryable: true as const,
    }));

    render(<IntakeCanvas submitTriage={submitTriage} />);
    await user.type(
      screen.getAllByLabelText(/what feels wrong/i)[0]!,
      "sore throat",
    );
    await user.click(screen.getAllByRole("checkbox")[0]!);
    await user.click(
      screen.getAllByRole("button", { name: /get triage guidance/i })[0]!,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /could not complete triage safely/i,
    );
    expect(screen.queryByText(/raw zod dump/i)).not.toBeInTheDocument();
  });

  it("shows the actionable BYOK failure message without technical details", async () => {
    const user = userEvent.setup();
    const submitTriage = vi.fn(async () => ({
      ok: false as const,
      code: "BYOK_EXECUTION_FAILED" as const,
      message: BYOK_FAILURE_MESSAGE,
      retryable: true as const,
    }));

    render(<IntakeCanvas submitTriage={submitTriage} />);
    await user.type(
      screen.getAllByLabelText(/what feels wrong/i)[0]!,
      "mild headache",
    );
    await user.click(screen.getAllByRole("checkbox")[0]!);
    await user.click(
      screen.getAllByRole("button", { name: /get triage guidance/i })[0]!,
    );

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(BYOK_FAILURE_MESSAGE);
    });
  });
});
