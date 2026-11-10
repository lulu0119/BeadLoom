import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nextProvider } from "react-i18next";
import { createBlankPattern } from "@beadloom/core";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import i18n, { i18nInitialization } from "@/i18n/config";
import { resetAppStore, useAppStore } from "./app-store";
import { ChartChatPanel } from "./chart-chat-panel";

const mock = vi.hoisted(() => ({
  fetch: vi.fn<(request: Request) => Promise<Response>>()
}));
vi.mock("./chart-agent", async (original) => {
  const actual = await original<typeof import("./chart-agent")>();
  return {
    ...actual,
    createChartRun: (options: Parameters<typeof actual.createChartRun>[0]) =>
      actual.createChartRun({ ...options, fetch: mock.fetch })
  };
});
function answer(text = "Done"): Response {
  return new Response(
    `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: text }, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`,
    { headers: { "content-type": "text/event-stream" } }
  );
}
function panel() {
  return render(
    <I18nextProvider i18n={i18n}>
      <ChartChatPanel />
    </I18nextProvider>
  );
}
async function send(text: string): Promise<void> {
  fireEvent.change(screen.getByPlaceholderText(i18n.t("chat.placeholder")), {
    target: { value: text }
  });
  fireEvent.click(screen.getByRole("button", { name: i18n.t("chat.send") }));
  await waitFor(() => expect(screen.getByText("Done")).toBeInTheDocument());
}
beforeAll(async () => {
  await i18nInitialization;
  await i18n.changeLanguage("en");
});
beforeEach(() => {
  resetAppStore();
  localStorage.clear();
  useAppStore.getState().hydrateApp();
  useAppStore.getState().addChart(createBlankPattern(4, 4));
  useAppStore.getState().updateLlmField({
    apiKey: "test",
    baseURL: "https://model.test/",
    model: "test"
  });
  mock.fetch.mockReset().mockImplementation(async () => answer());
});
afterEach(async () => {
  resetAppStore();
  vi.restoreAllMocks();
});

describe("native assistant-ui chart sessions", () => {
  it("only enables deletion and renaming for saved sessions", async () => {
    const user = userEvent.setup();
    panel();
    const deleteButton = screen.getByRole("button", { name: i18n.t("chat.deleteSession") });
    const renameButton = screen.getByRole("button", { name: i18n.t("chat.renameSession") });
    expect(deleteButton).toBeDisabled();
    expect(renameButton).toBeDisabled();
    await user.click(deleteButton);
    expect(mock.fetch).not.toHaveBeenCalled();

    await send("Draw a cat");
    await waitFor(() => expect(deleteButton).toBeEnabled());
    expect(renameButton).toBeEnabled();
    await user.click(renameButton);
    expect(screen.getByLabelText(i18n.t("chat.sessionTitle"))).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: i18n.t("chat.newSession") }));
    await waitFor(() => expect(deleteButton).toBeDisabled());
    expect(renameButton).toBeDisabled();
    expect(screen.queryByLabelText(i18n.t("chat.sessionTitle"))).not.toBeInTheDocument();
    await user.click(screen.getByLabelText(i18n.t("chat.sessions")));
    await user.click(await screen.findByRole("option", { name: "Draw a cat" }));
    await waitFor(() => expect(deleteButton).toBeEnabled());
    expect(renameButton).toBeEnabled();
    await user.click(deleteButton);
    await waitFor(() => expect(deleteButton).toBeDisabled());
    expect(renameButton).toBeDisabled();
    expect(screen.queryByText("Done")).not.toBeInTheDocument();
  });

  it("keeps the OpenCode session header stable across turns and changes it for a new chat", async () => {
    useAppStore.getState().updateLlmField({ providerId: "opencode-go" });
    mock.fetch.mockImplementation(async () => answer(`Reply ${mock.fetch.mock.calls.length}`));
    let view = panel();
    for (const text of ["Draw a pig", "Make it pink"]) {
      fireEvent.change(screen.getByPlaceholderText(i18n.t("chat.placeholder")), { target: { value: text } });
      fireEvent.click(screen.getByRole("button", { name: i18n.t("chat.send") }));
      await screen.findByText(`Reply ${text === "Draw a pig" ? 1 : 2}`);
    }
    const firstSession = mock.fetch.mock.calls[0][0].headers.get("x-opencode-session");
    expect(firstSession).toBeTruthy();
    expect(mock.fetch.mock.calls[1][0].headers.get("x-opencode-session")).toBe(firstSession);
    view.unmount();
    view = panel();
    await screen.findByText("Reply 2");
    fireEvent.change(screen.getByPlaceholderText(i18n.t("chat.placeholder")), { target: { value: "Continue" } });
    fireEvent.click(screen.getByRole("button", { name: i18n.t("chat.send") }));
    await screen.findByText("Reply 3");
    expect(mock.fetch.mock.calls[2][0].headers.get("x-opencode-session")).toBe(firstSession);
    fireEvent.click(screen.getByRole("button", { name: i18n.t("chat.newSession") }));
    await waitFor(() => expect(screen.queryByText("Reply 3")).not.toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText(i18n.t("chat.placeholder")), { target: { value: "Draw a cat" } });
    fireEvent.click(screen.getByRole("button", { name: i18n.t("chat.send") }));
    await screen.findByText("Reply 4");
    expect(mock.fetch.mock.calls[3][0].headers.get("x-opencode-session")).toBeTruthy();
    expect(mock.fetch.mock.calls[3][0].headers.get("x-opencode-session")).not.toBe(firstSession);
    view.unmount();
  });

  it("explains a browser network failure without claiming the API key is wrong", async () => {
    mock.fetch.mockRejectedValue(new TypeError("Failed to fetch"));
    panel();
    fireEvent.change(screen.getByPlaceholderText(i18n.t("chat.placeholder")), { target: { value: "Draw a pig" } });
    fireEvent.click(screen.getByRole("button", { name: i18n.t("chat.send") }));
    expect(await screen.findByText(/check your connection and whether the server is running/i)).toBeInTheDocument();
  });

  it("preserves the provider response for HTTP errors", async () => {
    mock.fetch.mockResolvedValue(Response.json({ error: { message: "Invalid API key" } }, { status: 401 }));
    panel();
    fireEvent.change(screen.getByPlaceholderText(i18n.t("chat.placeholder")), { target: { value: "Draw a pig" } });
    fireEvent.click(screen.getByRole("button", { name: i18n.t("chat.send") }));
    expect(await screen.findByText(/HTTP 401.*Invalid API key/)).toBeInTheDocument();
    expect(screen.queryByText(/Could not connect to the model relay/i)).not.toBeInTheDocument();
    expect(mock.fetch.mock.calls[0][0].headers.has("x-opencode-session")).toBe(false);
  });

  it("creates, searches, switches, renames, deletes and restores sessions through the published storage adapter", async () => {
    const user = userEvent.setup();
    let view = panel();
    await send("Draw a cat");
    await waitFor(() => expect(screen.getByLabelText(i18n.t("chat.sessions"))).toHaveTextContent("Draw a cat"));
    fireEvent.click(screen.getByRole("button", { name: i18n.t("chat.newSession") }));
    await waitFor(() =>
      expect(
        screen.queryByText("Draw a cat", { selector: '[data-slot="bubble-content"]' })
      ).not.toBeInTheDocument()
    );
    await send("Draw a tree");
    await waitFor(() => expect(screen.getByLabelText(i18n.t("chat.sessions"))).toHaveTextContent("Draw a tree"));
    fireEvent.click(screen.getByRole("button", { name: i18n.t("chat.renameSession") }));
    fireEvent.change(screen.getByLabelText(i18n.t("chat.sessionTitle")), {
      target: { value: "Tree" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.getByLabelText(i18n.t("chat.sessions"))).toHaveTextContent("Tree"));
    view.unmount();
    view = panel();
    await waitFor(() =>
      expect(
        screen.getByText("Draw a tree", { selector: '[data-slot="bubble-content"]' })
      ).toBeInTheDocument()
    );
    await user.click(screen.getByLabelText(i18n.t("chat.sessions")));
    const search = await screen.findByPlaceholderText(i18n.t("chat.searchSessions"));
    await user.type(search, "no matching title");
    expect(await screen.findByText(i18n.t("chat.noSessions"))).toBeInTheDocument();
    await user.clear(search);
    await user.type(search, "cat");
    expect(screen.queryByRole("option", { name: "Tree" })).not.toBeInTheDocument();
    await user.keyboard("{ArrowDown}{Enter}");
    await waitFor(() =>
      expect(screen.getByText("Draw a cat", { selector: '[data-slot="bubble-content"]' })).toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole("button", { name: i18n.t("chat.deleteSession") }));
    await waitFor(() =>
      expect(
        screen.queryByText("Draw a cat", { selector: '[data-slot="bubble-content"]' })
      ).not.toBeInTheDocument()
    );
    view.unmount();
  });

  it("cancels a late drawing response when the chart changes", async () => {
    let finish: ((response: Response) => void) | undefined;
    mock.fetch.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    panel();
    fireEvent.change(screen.getByPlaceholderText(i18n.t("chat.placeholder")), {
      target: { value: "Draw" }
    });
    fireEvent.click(screen.getByRole("button", { name: i18n.t("chat.send") }));
    await waitFor(() => expect(mock.fetch).toHaveBeenCalledOnce());
    act(() => useAppStore.getState().addChart(createBlankPattern(2, 2)));
    finish?.(
      new Response(
        `data: ${JSON.stringify({ choices: [{ index: 0, delta: { tool_calls: [{ index: 0, id: "p", type: "function", function: { name: "set_cells", arguments: JSON.stringify({ cells: [{ column: 0, row: 0, code: "H7" }] }) } }] }, finish_reason: "tool_calls" }] })}\n\ndata: [DONE]\n\n`,
        { headers: { "content-type": "text/event-stream" } }
      )
    );
    await waitFor(() => expect(screen.queryByText("Draw")).not.toBeInTheDocument());
    expect(
      useAppStore
        .getState()
        .library.patterns.every((record) => record.pattern.cells.every((cell) => cell === null))
    ).toBe(true);
  });
});
