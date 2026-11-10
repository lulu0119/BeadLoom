"use client";

import { useEffect, useMemo, useState, type ReactElement, type ReactNode } from "react";
import {
  AssistantRuntimeProvider,
  SimpleImageAttachmentAdapter,
  useAui,
  useAuiEvent
} from "@assistant-ui/react";
import { createXsaiAdapter } from "@beadloom/assistant-xsai";
import { browserStorage, useXsaiRuntime } from "@beadloom/assistant-xsai/react";
import { useAppStore } from "./app-store";
import { createChartRun } from "./chart-agent";
import { chartChatPrefix } from "./chart-chat-storage";
import { logAgentEvent, logXsaiEvent, setPendingPrompt } from "./agent-debug-log";
import { selectActiveRecord } from "./library-slice";

export function ChartChatRuntime({
  patternId,
  children
}: {
  patternId: string;
  children: ReactNode;
}): ReactElement {
  const prefix = chartChatPrefix(patternId);
  const [threadId, setThreadId] = useState<string | undefined>(
    () => window.localStorage.getItem(prefix + "active") ?? undefined
  );
  const adapter = useMemo(
    () =>
      createXsaiAdapter(async (run) => {
        const state = useAppStore.getState();
        if (state.llm.apiKey.trim() === "") {
          state.setSettingsOpen(true);
          throw new Error("Configure an API key before sending a message.");
        }
        const assertCurrent = (): void => {
          run.abortSignal.throwIfAborted();
          if (selectActiveRecord(useAppStore.getState())?.id !== patternId)
            throw new DOMException("Chart changed", "AbortError");
        };
        const turnId = run.unstable_assistantMessageId ?? crypto.randomUUID();
        const prompt =
          run.messages
            .at(-1)
            ?.content.filter((part) => part.type === "text")
            .map((part) => part.text)
            .join("\n") ?? "";
        setPendingPrompt(prompt);
        await logAgentEvent({ type: "turn.start", turnId });
        const config = await createChartRun({
          llm: { ...state.llm },
          turnId,
          sessionId: run.unstable_threadId ?? run.messages[0]?.id,
          getPattern: () => {
            assertCurrent();
            const record = useAppStore.getState().library.patterns.find((entry) => entry.id === patternId);
            if (!record) throw new Error("Chart no longer exists.");
            return record.pattern;
          },
          commitPattern: (pattern) => {
            assertCurrent();
            useAppStore.getState().persistPattern(pattern);
          }
        });
        return {
          ...config,
          onEvent: (event) => {
            void logXsaiEvent(turnId, event);
          }
        };
      }),
    [patternId]
  );
  const runtime = useXsaiRuntime(adapter, {
    prefix,
    threadId,
    onThreadIdChange: (id) => {
      setThreadId(id);
      if (id) void browserStorage.setItem(prefix + "active", id);
      else void browserStorage.removeItem(prefix + "active");
    },
    adapters: { attachments: new SimpleImageAttachmentAdapter() }
  });
  useEffect(() => {
    const cancel = (): void => runtime.thread.cancelRun();
    useAppStore.setState({ cancelChat: cancel });
    return () => {
      cancel();
      if (useAppStore.getState().cancelChat === cancel) useAppStore.setState({ cancelChat: null });
    };
  }, [runtime]);
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <DrawingTurnLog />
      {children}
    </AssistantRuntimeProvider>
  );
}

function DrawingTurnLog(): null {
  const aui = useAui();
  useAuiEvent("thread.runEnd", () => {
    const message = aui.thread.getState().messages.at(-1);
    if (message?.role !== "assistant") return;
    const status = message.status;
    void logAgentEvent(
      status.type === "incomplete" && status.reason === "error"
        ? { type: "turn.failed", turnId: message.id, error: status.error }
        : {
            type:
              status.type === "incomplete" && status.reason === "cancelled" ? "turn.aborted" : "turn.done",
            turnId: message.id
          }
    );
  });
  return null;
}
