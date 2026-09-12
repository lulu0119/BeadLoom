import { describe, expect, it } from "vitest";
import { updateChatTranscript, type ChatLine } from "./chart-chat-transcript";

describe("chat transcript", () => {
  it("keeps text before and after a tool call in separate linear blocks", () => {
    let lines: ChatLine[] = [{ kind: "user", id: "user-1", text: "draw" }];
    lines = updateChatTranscript(lines, { type: "textStarted", id: "text-1" });
    lines = updateChatTranscript(lines, { type: "textDelta", delta: "looking" });
    lines = updateChatTranscript(lines, { type: "textDone", content: "looking" });
    lines = updateChatTranscript(lines, { type: "toolStarted", id: "tool-1", toolCallId: "call-1", name: "look_at_board" });
    lines = updateChatTranscript(lines, { type: "toolResultDone", toolCallId: "call-1", resultText: "{}", isError: false });
    lines = updateChatTranscript(lines, { type: "textStarted", id: "text-2" });
    lines = updateChatTranscript(lines, { type: "textDelta", delta: "done" });
    lines = updateChatTranscript(lines, { type: "textDone", content: "done" });

    expect(lines.map((line) => line.kind)).toEqual(["user", "assistantText", "tool", "assistantText"]);
    expect(lines[1]).toMatchObject({ id: "text-1", text: "looking" });
    expect(lines[3]).toMatchObject({ id: "text-2", text: "done" });
  });

  it("accumulates tool arguments and results by tool call id", () => {
    let lines: ChatLine[] = [];
    lines = updateChatTranscript(lines, { type: "toolStarted", id: "tool-1", toolCallId: "call-1", name: "set_cells" });
    lines = updateChatTranscript(lines, { type: "toolArgsDone", toolCallId: "call-1", args: '{"cells":[]}' });
    lines = updateChatTranscript(lines, {
      type: "toolResultDone",
      toolCallId: "call-1",
      resultText: '{"legend":[]}',
      isError: false
    });

    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      kind: "tool",
      status: "done",
      argsText: '{"cells":[]}',
      resultText: '{"legend":[]}'
    });
  });

  it("attaches a board preview to its tool call without disturbing order", () => {
    let lines: ChatLine[] = [];
    lines = updateChatTranscript(lines, { type: "toolStarted", id: "tool-1", toolCallId: "call-1", name: "look_at_board" });
    lines = updateChatTranscript(lines, { type: "toolPreview", toolCallId: "call-1", previewUrl: "data:image/png;base64,x" });

    expect(lines[0]).toMatchObject({ kind: "tool", previewUrl: "data:image/png;base64,x", status: "running" });
  });

  it("drops empty text blocks and keeps errors as their own lines", () => {
    let lines: ChatLine[] = [{ kind: "user", id: "user-1", text: "draw" }];
    lines = updateChatTranscript(lines, { type: "textStarted", id: "text-1" });
    lines = updateChatTranscript(lines, { type: "error", id: "error-1", text: "failed" });

    expect(lines.map((line) => line.kind)).toEqual(["user", "error"]);
  });
});
