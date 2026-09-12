import { user, type Agent } from "@apeira/core";
import { createBlankPattern } from "@beadloom/core";
import i18n from "@/i18n/config";
import { createPatternRecordId } from "@/lib/pattern-storage";
import type { StateCreator } from "zustand";
import { clearPendingPrompt, logAgentEvent, setPendingPrompt } from "./agent-debug-log";
import type { AppStoreState } from "./app-store";
import { consumeAgentRun, createChartAgent } from "./chart-agent";
import { DEFAULT_CHART_SIZE } from "./chart-size";
import { updateChatTranscript, type ChatLine, type ChatTranscriptUpdate } from "./chart-chat-transcript";
import { selectActivePattern } from "./library-slice";

export type ChatSlice = {
  chatLines: ChatLine[];
  chatBusy: boolean;
  attachedFile: File | null;
  agent: Agent | null;
  attachFile: (file: File) => void;
  clearAttachedFile: () => void;
  applyTranscriptUpdate: (update: ChatTranscriptUpdate) => void;
  resetChat: () => void;
  disposeAgent: () => void;
  ensureAgent: () => Promise<Agent>;
  sendChatMessage: (text: string) => Promise<void>;
  interruptChat: () => void;
};

export function initialChatState(): Pick<ChatSlice, "chatLines" | "chatBusy" | "attachedFile" | "agent"> {
  return { chatLines: [], chatBusy: false, attachedFile: null, agent: null };
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("Could not read image."));
    };
    reader.onerror = () => reject(new Error("Could not read image."));
    reader.readAsDataURL(file);
  });
}

function isBrowserBlockedFetch(error: Error): boolean {
  return (
    error.name === "TypeError" &&
    (error.message === "Load failed" ||
      error.message === "Failed to fetch" ||
      error.message === "NetworkError when attempting to fetch resource.")
  );
}

function agentFailureText(error: unknown, corsMessage: string, fallback: string): string {
  if (error instanceof Error && isBrowserBlockedFetch(error)) {
    return corsMessage;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return fallback;
}

export const createChatSlice: StateCreator<
  AppStoreState,
  [],
  [["zustand/subscribeWithSelector", never]],
  ChatSlice
> = (set, get) => ({
  ...initialChatState(),
  attachFile: (file) => {
    set({ attachedFile: file });
  },
  clearAttachedFile: () => {
    set({ attachedFile: null });
  },
  applyTranscriptUpdate: (update) => {
    set((state) => ({ chatLines: updateChatTranscript(state.chatLines, update) }));
  },
  resetChat: () => {
    set({ agent: null, chatLines: [], attachedFile: null });
  },
  disposeAgent: () => {
    set({ agent: null });
  },
  ensureAgent: async () => {
    const { agent } = get();
    if (agent !== null) {
      return agent;
    }
    const created = await createChartAgent({
      getPattern: () => selectActivePattern(get()) ?? createBlankPattern(DEFAULT_CHART_SIZE, DEFAULT_CHART_SIZE),
      commitPattern: (next) => {
        get().persistPattern(next);
      },
      llm: get().llm,
      onBoardPreview: (previewUrl, toolCallId) => {
        get().applyTranscriptUpdate({ type: "toolPreview", toolCallId, previewUrl });
      }
    });
    await created.init();
    set({ agent: created });
    return created;
  },
  sendChatMessage: async (text) => {
    const { llm, attachedFile } = get();
    if (llm.apiKey.trim() === "") {
      set({ settingsOpen: true });
      return;
    }
    const trimmed = text.trim();
    const prompt = trimmed === "" ? i18n.t("chat.drawThis") : trimmed;
    set({ attachedFile: null });
    set((state) => ({
      chatLines: [...state.chatLines, { kind: "user", id: createPatternRecordId(), text: prompt }]
    }));
    set({ chatBusy: true });
    try {
      const agent = await get().ensureAgent();
      const imageUrl = attachedFile === null ? null : await fileToDataUrl(attachedFile);
      const input =
        imageUrl === null
          ? user(prompt)
          : {
              role: "user" as const,
              type: "message" as const,
              content: [
                { type: "input_text" as const, text: prompt },
                { type: "input_image" as const, image_url: imageUrl }
              ]
            };
      setPendingPrompt(prompt);
      await consumeAgentRun(agent, input, (event) => {
        void logAgentEvent(event);
        switch (event.type) {
          case "text.start": {
            const id = createPatternRecordId();
            get().applyTranscriptUpdate({ type: "textStarted", id });
            break;
          }
          case "text.delta": {
            get().applyTranscriptUpdate({ type: "textDelta", delta: event.delta });
            break;
          }
          case "text.done": {
            get().applyTranscriptUpdate({ type: "textDone", content: event.content });
            break;
          }
          case "tool-call.start": {
            const id = createPatternRecordId();
            get().applyTranscriptUpdate({
              type: "toolStarted",
              id,
              toolCallId: event.toolCallId,
              name: event.toolName
            });
            break;
          }
          case "tool-call.done": {
            get().applyTranscriptUpdate({
              type: "toolArgsDone",
              toolCallId: event.toolCallId,
              args: event.args
            });
            break;
          }
          case "tool-result.done": {
            const resultText =
              typeof event.result === "string"
                ? event.result
                : (JSON.stringify(event.result, null, 2) ?? String(event.result));
            get().applyTranscriptUpdate({
              type: "toolResultDone",
              toolCallId: event.toolCallId,
              resultText,
              isError: event.isError === true
            });
            break;
          }
          case "turn.failed": {
            const message = agentFailureText(event.error, i18n.t("chat.corsBlocked"), i18n.t("chat.turnFailed"));
            const id = createPatternRecordId();
            get().applyTranscriptUpdate({ type: "error", id, text: message });
            break;
          }
          case "turn.aborted": {
            const id = createPatternRecordId();
            get().applyTranscriptUpdate({ type: "error", id, text: i18n.t("chat.turnAborted") });
            break;
          }
          case "error": {
            const id = createPatternRecordId();
            get().applyTranscriptUpdate({ type: "error", id, text: event.message });
            break;
          }
          default:
            break;
        }
      });
    } catch (error) {
      clearPendingPrompt();
      const message = agentFailureText(error, i18n.t("chat.corsBlocked"), i18n.t("chat.turnFailed"));
      const id = createPatternRecordId();
      get().applyTranscriptUpdate({ type: "error", id, text: message });
    } finally {
      set({ chatBusy: false });
    }
  },
  interruptChat: () => {
    void get().agent?.interrupt("user interrupted");
    set({ chatBusy: false });
  }
});
