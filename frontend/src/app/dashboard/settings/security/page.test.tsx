import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { AxiosResponse } from "axios";
import { render, screen, waitFor } from "@/lib/test-utils";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import userEvent from "@testing-library/user-event";
import SecuritySessionsPage from "./page";
import { devicesApi, sessionsApi } from "@/lib/api";
import { clearAuth, setTokens } from "@/lib/auth";

vi.mock("@/lib/api", () => ({
  authApi: {
    logout: vi.fn(),
  },
  sessionsApi: {
    list: vi.fn(),
    revoke: vi.fn(),
    revokeOthers: vi.fn(),
  },
  devicesApi: {
    list: vi.fn(),
    toggleTrust: vi.fn(),
    remove: vi.fn(),
  },
}));

// Build an unsigned token whose payload carries the session id, which is all
// getSessionId() reads. No verification happens client-side.
function fakeToken(sessionId: string): string {
  const payload = Buffer.from(JSON.stringify({ sid: sessionId })).toString(
    "base64url"
  );
  return `header.${payload}.signature`;
}

function sessionRow(overrides: Record<string, unknown>) {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    ip_address: "203.0.113.7",
    user_agent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0",
    device_id: null,
    is_active: true,
    created_at: "2026-10-01T09:00:00.000Z",
    expires_at: "2026-11-01T09:00:00.000Z",
    ...overrides,
  };
}

function deviceRow(overrides: Record<string, unknown>) {
  return {
    id: 42,
    device_id: "device-abc",
    device_name: "Work laptop",
    device_type: "laptop",
    os: "Windows",
    browser: "Chrome",
    ip_address: "203.0.113.9",
    is_trusted: false,
    last_used_at: "2026-10-10T08:30:00.000Z",
    created_at: "2026-09-01T08:00:00.000Z",
    ...overrides,
  };
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <SecuritySessionsPage />
    </QueryClientProvider>
  );
}

describe("SecuritySessionsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearAuth();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("lists active sessions and marks the current one", async () => {
    vi.mocked(sessionsApi.list).mockResolvedValue({
      data: [
        sessionRow({ id: "sid-1" }),
        sessionRow({
          id: "sid-2",
          user_agent:
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15",
          ip_address: "198.51.100.4",
        }),
      ],
    } as unknown as AxiosResponse);
    vi.mocked(devicesApi.list).mockResolvedValue({
      data: [deviceRow({ is_trusted: true })],
    } as unknown as AxiosResponse);
    setTokens(fakeToken("sid-1"));

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Current session")).toBeInTheDocument();
    });
    expect(screen.getByText("Chrome on Windows")).toBeInTheDocument();
    expect(screen.getByText("Safari on macOS")).toBeInTheDocument();
    expect(screen.getByText(/203\.0\.113\.7/)).toBeInTheDocument();
    // The session that made this request is not revocable in bulk by mistake.
    expect(
      screen.getByRole("button", { name: /revoke all other sessions/i })
    ).toBeEnabled();

    await waitFor(() => {
      expect(screen.getByText("Work laptop")).toBeInTheDocument();
    });
    expect(screen.getByText("Trusted")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /remove trust/i })
    ).toBeInTheDocument();
  });

  it("revokes a single session after confirmation", async () => {
    vi.mocked(sessionsApi.list).mockResolvedValue({
      data: [sessionRow({ id: "sid-1" }), sessionRow({ id: "sid-2" })],
    } as unknown as AxiosResponse);
    vi.mocked(devicesApi.list).mockResolvedValue({
      data: [],
    } as unknown as AxiosResponse);
    vi.mocked(sessionsApi.revoke).mockResolvedValue({} as AxiosResponse);
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    setTokens(fakeToken("sid-1"));

    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: "Revoke" })).toHaveLength(2);
    });
    await user.click(screen.getAllByRole("button", { name: "Revoke" })[1]);

    await waitFor(() => {
      expect(sessionsApi.revoke).toHaveBeenCalledWith("sid-2");
    });
    expect(confirmSpy).toHaveBeenCalled();
  });

  it("warns that revoking the current session signs the user out", async () => {
    vi.mocked(sessionsApi.list).mockResolvedValue({
      data: [sessionRow({ id: "sid-1" })],
    } as unknown as AxiosResponse);
    vi.mocked(devicesApi.list).mockResolvedValue({
      data: [],
    } as unknown as AxiosResponse);
    vi.mocked(sessionsApi.revoke).mockResolvedValue({} as AxiosResponse);
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    setTokens(fakeToken("sid-1"));

    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Current session")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: "Revoke" }));

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalledWith(
        expect.stringContaining("signs you out")
      );
      expect(sessionsApi.revoke).toHaveBeenCalledWith("sid-1");
    });
  });

  it("revokes all other sessions with the current session id header", async () => {
    vi.mocked(sessionsApi.list).mockResolvedValue({
      data: [sessionRow({ id: "sid-1" }), sessionRow({ id: "sid-2" })],
    } as unknown as AxiosResponse);
    vi.mocked(devicesApi.list).mockResolvedValue({
      data: [],
    } as unknown as AxiosResponse);
    vi.mocked(sessionsApi.revokeOthers).mockResolvedValue({} as AxiosResponse);
    setTokens(fakeToken("sid-1"));

    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /revoke all other sessions/i })
      ).toBeEnabled();
    });
    await user.click(
      screen.getByRole("button", { name: /revoke all other sessions/i })
    );

    await waitFor(() => {
      expect(sessionsApi.revokeOthers).toHaveBeenCalledWith("sid-1");
    });
  });

  it("toggles device trust through the devices API", async () => {
    vi.mocked(sessionsApi.list).mockResolvedValue({
      data: [sessionRow({ id: "sid-1" })],
    } as unknown as AxiosResponse);
    vi.mocked(devicesApi.list).mockResolvedValue({
      data: [deviceRow({ is_trusted: false })],
    } as unknown as AxiosResponse);
    vi.mocked(devicesApi.toggleTrust).mockResolvedValue({
      data: deviceRow({ is_trusted: true }),
    } as unknown as AxiosResponse);

    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /trust device/i })
      ).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /trust device/i }));

    await waitFor(() => {
      expect(devicesApi.toggleTrust).toHaveBeenCalledWith(42);
    });
  });

  it("renders empty states for a new account", async () => {
    vi.mocked(sessionsApi.list).mockResolvedValue({
      data: [],
    } as unknown as AxiosResponse);
    vi.mocked(devicesApi.list).mockResolvedValue({
      data: [],
    } as unknown as AxiosResponse);
    setTokens(fakeToken("sid-new"));

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("No active sessions yet")).toBeInTheDocument();
    });
    expect(screen.getByText("No devices registered yet")).toBeInTheDocument();
  });

  it("renders honest error states when the APIs reject", async () => {
    vi.mocked(sessionsApi.list).mockRejectedValue(new Error("down"));
    vi.mocked(devicesApi.list).mockRejectedValue(new Error("down"));
    setTokens(fakeToken("sid-1"));

    renderPage();

    await waitFor(() => {
      expect(
        screen.getByText("Failed to load active sessions")
      ).toBeInTheDocument();
    });
    expect(screen.getByText("Failed to load devices")).toBeInTheDocument();
  });
});
