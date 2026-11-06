import type {
  ChatModelAdapter,
  ChatModelRunOptions,
  MessageStatus,
  ThreadAssistantMessagePart
} from "@assistant-ui/react";
import {
  maxSteps,
  streamText,
  type LanguageModel,
  type Message,
  type StreamTextOptions,
  type TextEvent
} from "@xsai/text";
import { readHistory, readToolArgs } from "./messages.ts";

export type XsaiRun = {
  model: LanguageModel;
  options?: Omit<StreamTextOptions, "input" | "signal">;
  onEvent?: (event: TextEvent) => void;
};

/** xsAI executes the whole tool loop; assistant-ui owns messages and lifecycle. */
export function createXsaiAdapter(
  prepareRun: (run: ChatModelRunOptions) => XsaiRun | Promise<XsaiRun>
): ChatModelAdapter {
  return {
    async *run(run) {
      const config = await prepareRun(run);
      run.abortSignal.throwIfAborted();
      const content: ThreadAssistantMessagePart[] = [];
      const protocol: Message[] = [];
      const indices = new Map<number, number>();
      const calls = new Map<string, number>();
      let stepNumber = 0;
      let status: MessageStatus = { type: "complete", reason: "stop" };
      const snapshot = () => ({
        content: [...content],
        metadata: { custom: { xsai: [...protocol] } }
      });
      const indexFor = (index: number): number => {
        let position = indices.get(index);
        if (position === undefined) {
          position = content.length;
          indices.set(index, position);
        }
        return position;
      };
      const callFor = (callId: string, name = ""): number => {
        let position = calls.get(callId);
        if (position === undefined) {
          position = content.length;
          calls.set(callId, position);
          content.push({
            type: "tool-call",
            toolCallId: `${stepNumber}:${callId}`,
            toolName: name,
            args: {},
            argsText: ""
          });
        }
        return position;
      };
      const reader = streamText(config.model, {
        ...config.options,
        stopWhen: config.options?.stopWhen ?? maxSteps(20),
        input: readHistory(run.messages),
        signal: run.abortSignal
      }).getReader();
      try {
        while (true) {
          const { done, value: event } = await reader.read();
          if (done) break;
          run.abortSignal.throwIfAborted();
          config.onEvent?.(event);
          if (event.type === "step.start") {
            stepNumber++;
            indices.clear();
            calls.clear();
          }
          if (
            event.type === "text.delta" ||
            event.type === "reasoning.delta" ||
            event.type === "refusal.delta"
          ) {
            const position = indexFor(event.index);
            const previous = content[position];
            content[position] = {
              type: event.type === "reasoning.delta" ? "reasoning" : "text",
              text:
                (previous?.type === "text" || previous?.type === "reasoning" ? previous.text : "") +
                event.delta
            };
          }
          if (event.type === "tool-call.delta") {
            const position = callFor(event.callId, event.name);
            const previous = content[position];
            if (previous.type === "tool-call")
              content[position] = {
                ...previous,
                toolName: event.name ?? previous.toolName,
                argsText: previous.argsText + event.delta
              };
          }
          if (event.type === "content.end") {
            const part = event.content;
            if (part.type === "text" || part.type === "refusal") {
              content[indexFor(event.index)] = {
                type: "text",
                text: part.type === "text" ? part.text : part.refusal
              };
            } else if (part.type === "reasoning") {
              content[indexFor(event.index)] = {
                type: "reasoning",
                text: part.content
                  .filter((item) => item.type === "text" || item.type === "summary")
                  .map((item) => item.text)
                  .join("\n")
              };
            } else if (part.type === "tool-call") {
              const position = callFor(part.callId, part.name);
              const previous = content[position];
              if (previous.type === "tool-call")
                content[position] = {
                  ...previous,
                  toolName: part.name,
                  argsText: part.arguments,
                  args: readToolArgs(part.arguments)
                };
            } else if (part.type === "tool-result") {
              protocol.push({ role: "user", content: [part] });
              const position = callFor(part.callId);
              const previous = content[position];
              if (previous.type === "tool-call")
                content[position] = {
                  ...previous,
                  result:
                    typeof part.output === "string"
                      ? part.output
                      : part.output
                          .filter((item) => item.type === "text")
                          .map((item) => item.text)
                          .join("\n"),
                  isError: part.isError,
                  artifact:
                    typeof part.output === "string"
                      ? undefined
                      : part.output.find((item) => item.type === "image")?.data.toString()
                };
            }
          }
          if (event.type === "step.end") {
            if (event.status === "failed") throw event.error;
            if (event.status === "cancelled") return;
            if (event.status === "incomplete")
              status = {
                type: "incomplete",
                reason: event.reason === "length" ? "length" : event.reason === "content-filter" ? "content-filter" : "other"
              };
            protocol.push(event.message);
          }
          yield { ...snapshot(), status: { type: "running" } };
        }
        const pending = content.some((part) => part.type === "tool-call" && part.result === undefined);
        yield {
          ...snapshot(),
          status: pending ? { type: "incomplete", reason: "tool-calls" } : status
        };
      } finally {
        await reader.cancel().catch(() => undefined);
        reader.releaseLock();
      }
    }
  };
}
