import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TriageResultCard } from "@/components/consumer/TriageResultCard";
import type { TriageResult } from "@/lib/schemas/triage";

const sample: TriageResult = {
  disposition: "routine",
  rationale: "Symptoms sound non-emergent based on available details.",
  plainEnglishSummary:
    "This sounds like something you can plan to discuss with a clinician soon.",
  immediateActions: ["Rest and hydrate", "Monitor symptoms for two days"],
  redFlagsToMonitor: ["High fever", "Breathing difficulty"],
  pointOfCareChecklist: ["Onset timing", "Severity score"],
  confidenceScore: 0.7,
  clinicalFlags: [],
};

describe("TriageResultCard", () => {
  it("renders structured urgency, actions, red flags, and doctor checklist", () => {
    render(<TriageResultCard result={sample} />);
    expect(screen.getByLabelText(/urgency: routine/i)).toBeInTheDocument();
    expect(screen.getByText(sample.plainEnglishSummary)).toBeInTheDocument();
    expect(screen.getByText("Rest and hydrate")).toBeInTheDocument();
    expect(screen.getByText("High fever")).toBeInTheDocument();
    expect(screen.getByText("Onset timing")).toBeInTheDocument();
  });

  it("falls back to clipboard sharing when native share is unavailable", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: undefined,
    });

    render(<TriageResultCard result={sample} />);
    await user.click(
      screen.getAllByRole("button", { name: /share checklist/i })[0]!,
    );
    expect(writeText).toHaveBeenCalled();
    expect(await screen.findByText(/copied to clipboard/i)).toBeInTheDocument();
  });
});
