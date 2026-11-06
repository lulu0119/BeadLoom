import { describe, expect, it, vi } from "vitest";
import {
  fromThreadMessageLike as convertMessage,
  type ThreadMessageLike,
  type ChatModelRunResult,
  type ChatModelRunOptions
} from "@assistant-ui/react";
import { chat } from "@xsai/text-chat";
import { maxSteps, tool } from "@xsai/text";
import { createXsaiAdapter } from "./index";
import { readHistory } from "./messages";

function fromThreadMessageLike(message: ThreadMessageLike) {
  return convertMessage(message, crypto.randomUUID(), { type: "complete", reason: "stop" });
}

function sse(delta: object, finish = "stop"): Response {
  return new Response(
    `data: ${JSON.stringify({ choices: [{ index: 0, delta, finish_reason: finish }] })}\n\ndata: [DONE]\n\n`,
    { headers: { "content-type": "text/event-stream" } }
  );
}
const call = () =>
  sse(
    {
      tool_calls: [
        {
          index: 0,
          id: "call-1",
          type: "function",
          function: { name: "paint", arguments: "{}" }
        }
      ]
    },
    "tool_calls"
  );
function options(messages: ChatModelRunOptions["messages"]): ChatModelRunOptions {
  return {
    messages,
    abortSignal: new AbortController().signal,
    context: {},
    runConfig: {},
    unstable_getMessage: () => fromThreadMessageLike({ role: "assistant", content: [] })
  };
}
async function collect(
  adapter: ReturnType<typeof createXsaiAdapter>,
  run: ChatModelRunOptions
): Promise<ChatModelRunResult> {
  const output = adapter.run(run);
  if (!(Symbol.asyncIterator in output)) return output;
  let last: ChatModelRunResult = {};
  for await (const update of output) last = update;
  return last;
}

describe("xsAI ChatModelAdapter", () => {
  it("keeps a model token limit as an incomplete response", async () => {
    const adapter = createXsaiAdapter(() => ({
      model: chat({
        baseURL: "https://model.test/",
        model: "test",
        fetch: async () => sse({ content: "Partial" }, "length")
      })
    }));
    const result = await collect(
      adapter,
      options([fromThreadMessageLike({ role: "user", content: "Draw" })])
    );
    expect(result.status).toEqual({ type: "incomplete", reason: "length" });
  });
  it("executes a tool once and roundtrips step order through native assistant-ui history", async () => {
    const execute = vi.fn(() => "painted");
    const requests: unknown[] = [];
    const adapter = createXsaiAdapter(() => ({
      model: chat({
        baseURL: "https://model.test/",
        model: "test",
        fetch: async (request) => {
          requests.push(await request.json());
          return requests.length === 1 ? call() : sse({ content: "Done" });
        }
      }),
      options: {
        tools: [tool({ name: "paint", inputSchema: { type: "object" }, execute })]
      }
    }));
    const user = fromThreadMessageLike({ role: "user", content: "Draw" });
    const result = await collect(adapter, options([user]));
    expect(execute).toHaveBeenCalledOnce();
    expect(requests).toHaveLength(2);
    expect(result.status).toEqual({ type: "complete", reason: "stop" });
    const assistant = fromThreadMessageLike({
      role: "assistant",
      content: result.content ?? [],
      metadata: result.metadata
    });
    const next = fromThreadMessageLike({ role: "user", content: "Continue" });
    const input = readHistory([user, assistant, next]);
    expect(input.map((item) => item.role)).toEqual(["user", "assistant", "user", "assistant", "user"]);
    await collect(adapter, options([user, assistant, next]));
    expect(execute).toHaveBeenCalledOnce();
    expect(requests[2]).toMatchObject({
      messages: [
        { role: "user" },
        { role: "assistant", tool_calls: [{ id: "call-1" }] },
        { role: "tool", content: "painted" },
        { role: "assistant" },
        { role: "user" }
      ]
    });
  });

  it("closes interrupted calls before the next user message without replaying tools", async () => {
    const execute = vi.fn(() => "painted");
    const adapter = createXsaiAdapter(() => ({
      model: chat({
        baseURL: "https://model.test/",
        model: "test",
        fetch: async () => call()
      }),
      options: {
        stopWhen: maxSteps(1),
        tools: [tool({ name: "paint", inputSchema: { type: "object" }, execute })]
      }
    }));
    const result = await collect(
      adapter,
      options([fromThreadMessageLike({ role: "user", content: "Draw" })])
    );
    const assistant = fromThreadMessageLike({
      role: "assistant",
      content: result.content ?? [],
      metadata: result.metadata
    });
    const history = readHistory([assistant, fromThreadMessageLike({ role: "user", content: "Continue" })]);
    expect(execute).not.toHaveBeenCalled();
    expect(result.status).toEqual({ type: "incomplete", reason: "tool-calls" });
    expect(history[1]).toMatchObject({
      role: "user",
      content: [{ type: "tool-result", isError: true, callId: "call-1" }]
    });
    expect(history[2]).toMatchObject({
      role: "user",
      content: [{ text: "Continue" }]
    });
  });

  it("preserves reasoning/provider data and image attachments across JSON storage", () => {
    const native = fromThreadMessageLike({
      role: "assistant",
      content: [{ type: "text", text: "Done" }],
      metadata: {
        custom: {
          xsai: [
            {
              role: "assistant",
              content: [
                {
                  type: "provider",
                  source: "test",
                  value: { signature: "sig" }
                },
                {
                  type: "reasoning",
                  id: "r1",
                  content: [{ type: "encrypted", text: "opaque" }]
                }
              ]
            }
          ]
        }
      }
    });
    const restored = fromThreadMessageLike({
      ...native,
      metadata: JSON.parse(JSON.stringify(native.metadata))
    });
    expect(readHistory([restored])[0]).toMatchObject({
      content: [
        { value: { signature: "sig" } },
        { id: "r1", content: [{ type: "encrypted", text: "opaque" }] }
      ]
    });
    expect(
      readHistory([
        fromThreadMessageLike({
          role: "user",
          content: [{ type: "image", image: "data:image/png;base64,AA==" }]
        })
      ])[0]
    ).toMatchObject({
      content: [{ type: "image", data: "data:image/png;base64,AA==" }]
    });
  });
});
