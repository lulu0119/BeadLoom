import type { AgentEvent, AgentInput } from "@apeira/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AGENT_LOG_KEEP_BLOBS,
  AGENT_LOG_KEEP_TURNS,
  clearAgentLogs,
  clearPendingPrompt,
  createMemoryAgentLogBackend,
  extractMessageImages,
  getRecentTurns,
  getTurnDetail,
  hashImageUrl,
  logAgentEvent,
  logStepRequest,
  logTurnInput,
  resolveMessageImages,
  setAgentLogBackendForTesting,
  setPendingPrompt,
  summarizeAgentInput,
  toLoggedMessages,
  type AgentLogBackend
} from "./agent-debug-log";

let backend: AgentLogBackend;

beforeEach(() => {
  backend = createMemoryAgentLogBackend();
  setAgentLogBackendForTesting(backend);
  clearPendingPrompt();
});

afterEach(() => {
  setAgentLogBackendForTesting(null);
});

function userInputWithImage(imageUrl: string): AgentInput {
  return {
    role: "user",
    type: "message",
    content: [
      { type: "input_text", text: "draw" },
      { type: "input_image", image_url: imageUrl }
    ]
  };
}

describe("turn lifecycle", () => {
  it("records prompt, steps, tools, and outcome for a turn", async () => {
    setPendingPrompt("draw a cat");
    await logAgentEvent({ type: "turn.start", turnId: "turn-1" });
    await logTurnInput("turn-1", {
      model: "glm-5.3-flash",
      baseURL: "https://open.bigmodel.cn/api/paas/v4/",
      tools: [{ name: "look_at_board", description: null }],
      summary: [{ kind: "message", role: "user", content: "text:10", toolCalls: null }]
    });
    await logAgentEvent({ type: "step.start", turnId: "turn-1" });
    await logAgentEvent({ type: "tool-call.start", turnId: "turn-1", toolCallId: "call-1", toolName: "look_at_board" });
    await logAgentEvent({
      type: "tool-call.done",
      turnId: "turn-1",
      toolCallId: "call-1",
      toolCallType: "function",
      toolName: "look_at_board",
      args: "{}"
    });
    await logAgentEvent({
      type: "tool-result.done",
      turnId: "turn-1",
      toolCallId: "call-1",
      toolName: "look_at_board",
      args: {},
      result: "{}"
    });
    await logAgentEvent({ type: "step.done", turnId: "turn-1" });
    await logAgentEvent({ type: "step.start", turnId: "turn-1" });
    await logAgentEvent({ type: "text.done", turnId: "turn-1", content: "nice" });
    await logAgentEvent({ type: "turn.done", turnId: "turn-1" });

    const turns = await getRecentTurns();
    expect(turns).toHaveLength(1);
    expect(turns[0]).toMatchObject({
      turnId: "turn-1",
      status: "done",
      prompt: "draw a cat",
      model: "glm-5.3-flash"
    });
    expect(turns[0].endedAt).not.toBeNull();

    const detail = await getTurnDetail("turn-1");
    expect(detail?.events.map((event) => event.type)).toEqual([
      "step.start",
      "tool-call.start",
      "tool-call.done",
      "tool-result.done",
      "step.done",
      "step.start",
      "text.done"
    ]);
    expect(detail?.events.map((event) => event.stepNumber)).toEqual([0, 0, 0, 0, 0, 1, 1]);
    expect(detail?.events[2]).toMatchObject({ toolCallId: "call-1", args: "{}" });
    expect(detail?.events[3]).toMatchObject({ toolCallId: "call-1", resultText: "{}" });
  });

  it("records failures with the error text", async () => {
    await logAgentEvent({ type: "turn.start", turnId: "turn-2" });
    await logAgentEvent({ type: "turn.failed", turnId: "turn-2", error: new Error("Remote sent 400") });

    const detail = await getTurnDetail("turn-2");
    expect(detail?.turn.status).toBe("failed");
    expect(detail?.turn.error).toContain("Remote sent 400");
  });

  it("ignores streaming deltas", async () => {
    await logAgentEvent({ type: "turn.start", turnId: "turn-3" });
    await logAgentEvent({ type: "text.delta", turnId: "turn-3", delta: "a" });
    await logAgentEvent({ type: "tool-call.delta", turnId: "turn-3", delta: "{" });

    const detail = await getTurnDetail("turn-3");
    expect(detail?.events).toHaveLength(0);
  });
});

describe("step requests", () => {
  it("round-trips messages with tool calls through image extraction", async () => {
    const dataUrl = `data:image/png;base64,${"x".repeat(3000)}`;
    const messages = toLoggedMessages("instructions", [
      userInputWithImage(dataUrl),
      {
        role: "assistant",
        type: "message",
        content: "",
        tool_calls: [
          { id: "call-1", type: "function", function: { name: "look_at_board", arguments: "{}" } }
        ]
      },
      { role: "user", type: "message", content: "again" }
    ]);
    await logAgentEvent({ type: "turn.start", turnId: "turn-4" });
    await logStepRequest({
      turnId: "turn-4",
      stepNumber: 2,
      model: "model",
      baseURL: "https://example.test/",
      injectedPreviewCount: 1,
      messages
    });

    const detail = await getTurnDetail("turn-4");
    expect(detail?.requests).toHaveLength(1);
    expect(detail?.requests[0]).toMatchObject({ stepNumber: 2, injectedPreviewCount: 1 });
    expect(detail?.requests[0].imageHashes).toHaveLength(1);
    expect(detail?.requests[0].messages).toEqual(messages);
  });

  it("dedupes identical images by hash", () => {
    const dataUrl = `data:image/png;base64,${"y".repeat(3000)}`;
    const messages = toLoggedMessages("", [userInputWithImage(dataUrl), userInputWithImage(dataUrl)]);
    const first = extractMessageImages(messages[0]);
    const second = extractMessageImages(messages[1]);

    expect(first.blobs).toHaveLength(1);
    expect(second.blobs).toHaveLength(1);
    expect(first.blobs[0].hash).toBe(second.blobs[0].hash);
    expect(hashImageUrl(dataUrl)).toBe(first.blobs[0].hash);
  });

  it("keeps short remote urls inline", () => {
    const messages = toLoggedMessages("", [userInputWithImage("https://example.test/board.png")]);
    const extracted = extractMessageImages(messages[0]);

    expect(extracted.blobs).toHaveLength(0);
    expect(extracted.message).toEqual(messages[0]);
  });

  it("marks resolved images whose blob was pruned", () => {
    const dataUrl = `data:image/png;base64,${"z".repeat(3000)}`;
    const messages = toLoggedMessages("", [userInputWithImage(dataUrl)]);
    const extracted = extractMessageImages(messages[0]);
    const resolved = resolveMessageImages(extracted.message, new Map());

    expect(JSON.stringify(resolved)).toContain("imageMissing");
  });

  it("prefixes instructions as a system message", () => {
    expect(toLoggedMessages("", [{ role: "user", type: "message", content: "hi" }])).toHaveLength(1);
    const withInstructions = toLoggedMessages("be nice", [{ role: "user", type: "message", content: "hi" }]);
    expect(withInstructions).toHaveLength(2);
    expect(withInstructions[0]).toMatchObject({ role: "system", content: "be nice" });
  });
});

describe("input summary", () => {
  it("describes content without image bytes", () => {
    const summary = summarizeAgentInput([
      userInputWithImage(`data:image/png;base64,${"q".repeat(100)}`),
      {
        role: "assistant",
        type: "message",
        content: "",
        tool_calls: [{ id: "call-9", type: "function", function: { name: "set_cells", arguments: "{}" } }]
      },
      { type: "function_call", call_id: "call-9", name: "set_cells", arguments: "{}" },
      { type: "function_call_output", call_id: "call-9", output: "{}" }
    ]);

    expect(summary[0]).toMatchObject({ kind: "message", role: "user", content: "input_text:4+input_image:122" });
    expect(summary[1]).toMatchObject({ kind: "message", role: "assistant", toolCalls: ["call-9"] });
    expect(summary[2]).toMatchObject({ kind: "function_call", callId: "call-9", name: "set_cells" });
    expect(summary[3]).toMatchObject({ kind: "function_call_output", callId: "call-9" });
    expect(JSON.stringify(summary)).not.toContain("q".repeat(10));
  });
});

describe("retention", () => {
  it("keeps only the newest turns with their requests and events", async () => {
    for (let index = 0; index < AGENT_LOG_KEEP_TURNS + 5; index += 1) {
      const turnId = `turn-${index}`;
      await backend.upsertTurn({
        turnId,
        startedAt: index,
        endedAt: index,
        status: "done",
        prompt: null,
        model: null,
        baseURL: null,
        tools: null,
        inputSummary: null,
        error: null
      });
      await backend.addRequest({
        turnId,
        stepNumber: 0,
        loggedAt: index,
        model: "model",
        baseURL: "base",
        injectedPreviewCount: 0,
        messageCount: 0,
        imageHashes: [],
        messages: []
      });
      await backend.addEvent({ turnId, stepNumber: 0, loggedAt: index, type: "step.start" });
    }
    await backend.prune(AGENT_LOG_KEEP_TURNS, AGENT_LOG_KEEP_BLOBS);

    expect(await backend.listTurns(100)).toHaveLength(AGENT_LOG_KEEP_TURNS);
    expect(await backend.getTurn("turn-0")).toBeNull();
    expect(await backend.listRequests("turn-0")).toHaveLength(0);
    expect(await backend.listEvents("turn-0")).toHaveLength(0);
    expect(await backend.listRequests(`turn-${AGENT_LOG_KEEP_TURNS + 4}`)).toHaveLength(1);
  });

  it("prunes on turn end", async () => {
    let pruneCalls = 0;
    const counting: AgentLogBackend = {
      ...backend,
      prune: async (...args) => {
        pruneCalls += 1;
        return backend.prune(...args);
      }
    };
    setAgentLogBackendForTesting(counting);
    await logAgentEvent({ type: "turn.start", turnId: "turn-prune" });
    await logAgentEvent({ type: "turn.done", turnId: "turn-prune" });

    expect(pruneCalls).toBe(1);
  });

  it("clears everything", async () => {
    await logAgentEvent({ type: "turn.start", turnId: "turn-clear" });
    await clearAgentLogs();

    expect(await getRecentTurns()).toHaveLength(0);
    expect(await getTurnDetail("turn-clear")).toBeNull();
  });
});

describe("failure safety", () => {
  it("never throws when the backend fails", async () => {
    const failing: AgentLogBackend = {
      upsertTurn: async () => {
        throw new Error("no storage");
      },
      getTurn: async () => {
        throw new Error("no storage");
      },
      listTurns: async () => {
        throw new Error("no storage");
      },
      addRequest: async () => {
        throw new Error("no storage");
      },
      listRequests: async () => {
        throw new Error("no storage");
      },
      addEvent: async () => {
        throw new Error("no storage");
      },
      listEvents: async () => {
        throw new Error("no storage");
      },
      putBlob: async () => {
        throw new Error("no storage");
      },
      getBlob: async () => {
        throw new Error("no storage");
      },
      prune: async () => {
        throw new Error("no storage");
      },
      clear: async () => {
        throw new Error("no storage");
      }
    };
    setAgentLogBackendForTesting(failing);
    const event: AgentEvent = { type: "turn.start", turnId: "turn-fail" };

    await expect(logAgentEvent(event)).resolves.toBeUndefined();
    await expect(
      logTurnInput("turn-fail", { model: "m", baseURL: "b", tools: [], summary: [] })
    ).resolves.toBeUndefined();
    await expect(
      logStepRequest({ turnId: "turn-fail", stepNumber: 0, model: "m", baseURL: "b", injectedPreviewCount: 0, messages: [] })
    ).resolves.toBeUndefined();
  });
});
