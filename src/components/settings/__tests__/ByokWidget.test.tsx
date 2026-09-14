import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ByokWidget } from "@/components/settings/ByokWidget";

describe("ByokWidget", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("shows an unauthenticated unavailable state", () => {
    render(<ByokWidget authenticated={false} />);
    expect(
      screen.getByRole("heading", {
        name: /advanced ai configuration unavailable/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/anonymous visitors cannot save/i),
    ).toBeInTheDocument();
  });

  it("marks reserved providers unavailable and allows local LM Studio config", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const method = init?.method ?? "GET";
        if (method === "GET") {
          return new Response(JSON.stringify({ ok: true, config: null }), {
            status: 200,
          });
        }
        return new Response(
          JSON.stringify({
            ok: true,
            config: {
              provider: "local",
              selectedModel: "qwen2.5-7b-instruct",
              keyLast4: "ocal",
              updatedAt: "2026-09-14T00:00:00.000Z",
              disabled: false,
            },
          }),
          { status: 200 },
        );
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<ByokWidget authenticated />);

    expect(await screen.findByRole("button", { name: /groq/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /gemini/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /kimi/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /openrouter/i })).toBeDisabled();

    await user.click(
      screen.getByRole("button", { name: /local \/ openai-compatible/i }),
    );
    expect(
      screen.getByLabelText(/local openai-compatible base url/i),
    ).toHaveValue("http://127.0.0.1:1234/v1");
    expect(
      screen.getByText(/reachable from the running aicare server/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/leave empty to fallback/i)).not.toBeInTheDocument();
    expect(
      screen.getAllByText(/encrypted before storage and is never shown again/i)
        .length,
    ).toBeGreaterThan(0);

    await user.type(
      screen.getByLabelText(/model identifier/i),
      "qwen2.5-7b-instruct",
    );
    await user.type(
      screen.getByLabelText(/provider credential/i),
      "lm-studio-local-key",
    );
    await user.click(
      screen.getByRole("button", { name: /save configuration/i }),
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/byok",
        expect.objectContaining({ method: "PUT" }),
      );
    });

    const putCall = fetchMock.mock.calls.find(
      (call) => (call[1] as RequestInit | undefined)?.method === "PUT",
    );
    expect(String(putCall?.[1]?.body)).toContain("http://127.0.0.1:1234/v1");
    expect(String(putCall?.[1]?.body)).toContain("qwen2.5-7b-instruct");

    expect(await screen.findByText(/key ending/i)).toBeInTheDocument();
    expect(screen.getByText(/••••ocal/i)).toBeInTheDocument();
    expect(screen.queryByText("lm-studio-local-key")).not.toBeInTheDocument();
  });

  it("supports explicit disable and delete actions", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        const method = init?.method ?? "GET";
        if (method === "GET") {
          return new Response(
            JSON.stringify({
              ok: true,
              config: {
                provider: "openai",
                selectedModel: "user-model",
                keyLast4: "abcd",
                updatedAt: "2026-09-14T00:00:00.000Z",
                disabled: false,
              },
            }),
            { status: 200 },
          );
        }
        const body = JSON.parse(String(init?.body ?? "{}")) as {
          action?: string;
        };
        if (body.action === "disable") {
          return new Response(
            JSON.stringify({
              ok: true,
              config: {
                provider: "openai",
                selectedModel: "user-model",
                keyLast4: "abcd",
                updatedAt: "2026-09-14T00:00:00.000Z",
                disabled: true,
              },
            }),
            { status: 200 },
          );
        }
        if (body.action === "delete") {
          return new Response(JSON.stringify({ ok: true, config: null }), {
            status: 200,
          });
        }
        return new Response(JSON.stringify({ ok: false, message: "nope" }), {
          status: 400,
        });
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<ByokWidget authenticated />);
    expect(await screen.findByText(/enabled/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^disable$/i }));
    await waitFor(() => {
      expect(screen.getByText(/disabled/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /^delete$/i }));
    await waitFor(() => {
      expect(
        screen.getByText(/no personal configuration saved/i),
      ).toBeInTheDocument();
    });
  });
});
