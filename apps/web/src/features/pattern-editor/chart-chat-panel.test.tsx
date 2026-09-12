import { render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import i18n, { i18nInitialization } from "@/i18n/config";
import { resetAppStore, useAppStore } from "./app-store";
import { ChartChatPanel } from "./chart-chat-panel";
import type { ChatLine } from "./chart-chat-transcript";

function renderPanel(): void {
  render(
    <I18nextProvider i18n={i18n}>
      <ChartChatPanel />
    </I18nextProvider>
  );
}

const userLine: ChatLine = { kind: "user", id: "user-1", text: "draw" };

function toolLine(status: "running" | "done"): ChatLine {
  return {
    kind: "tool",
    id: "tool-1",
    toolCallId: "call-1",
    name: "look_at_board",
    status,
    argsText: "{}",
    resultText: status === "done" ? "{}" : null,
    previewUrl: null
  };
}

describe("chart chat thinking indicator", () => {
  beforeAll(async () => {
    await i18nInitialization;
    await i18n.changeLanguage("en");
  });

  beforeEach(() => {
    resetAppStore();
  });

  it("shows thinking while waiting for the first response", () => {
    useAppStore.setState({ chatLines: [userLine], chatBusy: true });
    renderPanel();

    expect(screen.getByText("Thinking")).toBeInTheDocument();
  });

  it("shows thinking after a tool finishes while the turn continues", () => {
    useAppStore.setState({ chatLines: [userLine, toolLine("done")], chatBusy: true });
    renderPanel();

    expect(screen.getByText("Thinking")).toBeInTheDocument();
  });

  it("hides thinking while assistant text streams", () => {
    useAppStore.setState({
      chatLines: [userLine, { kind: "assistantText", id: "text-1", text: "looking" }],
      chatBusy: true
    });
    renderPanel();

    expect(screen.queryByText("Thinking")).not.toBeInTheDocument();
  });

  it("hides thinking while a tool runs", () => {
    useAppStore.setState({ chatLines: [userLine, toolLine("running")], chatBusy: true });
    renderPanel();

    expect(screen.queryByText("Thinking")).not.toBeInTheDocument();
  });

  it("hides thinking when idle", () => {
    useAppStore.setState({ chatLines: [userLine], chatBusy: false });
    renderPanel();

    expect(screen.queryByText("Thinking")).not.toBeInTheDocument();
  });
});
