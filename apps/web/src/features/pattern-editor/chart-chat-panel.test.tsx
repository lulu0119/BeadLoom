import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
  it("creates, switches, renames, deletes and restores sessions through the published storage adapter", async () => {
    let view = panel();
    await send("Draw a cat");
    const first = (screen.getByLabelText(i18n.t("chat.sessions")) as HTMLSelectElement).value;
    fireEvent.click(screen.getByRole("button", { name: i18n.t("chat.newSession") }));
    await waitFor(() =>
      expect(
        screen.queryByText("Draw a cat", { selector: '[data-slot="bubble-content"]' })
      ).not.toBeInTheDocument()
    );
    await send("Draw a tree");
    const second = (screen.getByLabelText(i18n.t("chat.sessions")) as HTMLSelectElement).value;
    expect(second).not.toBe(first);
    fireEvent.click(screen.getByRole("button", { name: i18n.t("chat.renameSession") }));
    fireEvent.change(screen.getByLabelText(i18n.t("chat.sessionTitle")), {
      target: { value: "Tree" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.getByRole("option", { name: "Tree" })).toBeInTheDocument());
    view.unmount();
    view = panel();
    await waitFor(() =>
      expect(
        screen.getByText("Draw a tree", { selector: '[data-slot="bubble-content"]' })
      ).toBeInTheDocument()
    );
    fireEvent.change(screen.getByLabelText(i18n.t("chat.sessions")), {
      target: { value: first }
    });
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
