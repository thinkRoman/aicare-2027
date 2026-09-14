import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SettingsPage from "@/app/settings/page";

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

describe("settings page isolation", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("isolates advanced configuration behind authentication", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes("/api/auth/session")) {
        return new Response(
          JSON.stringify({
            ok: true,
            authenticated: false,
            user: null,
          }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ ok: true, config: null }), {
        status: 200,
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<SettingsPage />);

    expect(
      await screen.findByRole("heading", { name: /settings/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/isolated from the ordinary triage flow/i),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", {
        name: /advanced ai configuration unavailable/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /sign in to manage settings/i }),
    ).toBeInTheDocument();
  });

  it("does not accept a client-supplied user id field for identity", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        if (
          String(input).includes("/api/auth/session") &&
          init?.method === "POST"
        ) {
          return new Response(
            JSON.stringify({
              ok: true,
              authenticated: true,
              user: { userId: "server-derived", email: "person@example.com" },
            }),
            { status: 200 },
          );
        }
        if (String(input).includes("/api/auth/session")) {
          return new Response(
            JSON.stringify({ ok: true, authenticated: false, user: null }),
            { status: 200 },
          );
        }
        return new Response(JSON.stringify({ ok: true, config: null }), {
          status: 200,
        });
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<SettingsPage />);
    expect(screen.queryByLabelText(/user id/i)).not.toBeInTheDocument();

    await user.type(
      await screen.findByLabelText(/email/i),
      "person@example.com",
    );
    await user.click(
      screen.getAllByRole("button", {
        name: /sign in to manage settings/i,
      })[0]!,
    );

    await waitFor(() => {
      const post = fetchMock.mock.calls.find(
        (call) => (call[1] as RequestInit | undefined)?.method === "POST",
      );
      expect(post?.[1]?.body).toBe(
        JSON.stringify({ email: "person@example.com" }),
      );
      expect(post?.[1]?.body).not.toContain("userId");
    });
  });
});
