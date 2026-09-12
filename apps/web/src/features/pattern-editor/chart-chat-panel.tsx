"use client";

import { useRef, type DragEvent, type FormEvent, type ReactElement } from "react";
import { ChevronRight, Paperclip, SendHorizontal, Square } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Bubble,
  BubbleContent,
  Button,
  Message,
  MessageContent,
  MessageScroller,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
  Textarea
} from "@beadloom/ui";
import { useAppStore } from "./app-store";
import type { ChatLine, ChatToolStatus } from "./chart-chat-transcript";

function formatJsonPayload(raw: string): string {
  if (raw.trim() === "") {
    return raw;
  }
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

const toolStatusDots: Record<ChatToolStatus, string> = {
  running: "bg-amber-500 animate-pulse",
  done: "bg-emerald-500",
  error: "bg-destructive"
};

function textLine(align: "start" | "end", variant: "default" | "secondary" | "destructive", text: string): ReactElement {
  return (
    <Message align={align}>
      <MessageContent>
        <Bubble align={align} variant={variant}>
          <BubbleContent className="whitespace-pre-wrap">{text}</BubbleContent>
        </Bubble>
      </MessageContent>
    </Message>
  );
}

export function ChartChatPanel(): ReactElement {
  const { t } = useTranslation();
  const lines = useAppStore((state) => state.chatLines);
  const busy = useAppStore((state) => state.chatBusy);
  const hasApiKey = useAppStore((state) => state.llm.apiKey.trim() !== "");
  const attachedName = useAppStore((state) => state.attachedFile?.name ?? null);
  const attachFile = useAppStore((state) => state.attachFile);
  const clearAttachedFile = useAppStore((state) => state.clearAttachedFile);
  const sendChatMessage = useAppStore((state) => state.sendChatMessage);
  const interruptChat = useAppStore((state) => state.interruptChat);
  const setSettingsOpen = useAppStore((state) => state.setSettingsOpen);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const visibleLines = lines.filter((line) => line.kind !== "assistantText" || line.text !== "");
  const lastLine = visibleLines.at(-1);
  const showThinking =
    busy &&
    (lastLine === undefined ||
      (lastLine.kind !== "assistantText" &&
        lastLine.kind !== "error" &&
        !(lastLine.kind === "tool" && lastLine.status === "running")));
  const hasMessages = visibleLines.length > 0 || showThinking;

  function toolStatusText(status: ChatToolStatus): string {
    switch (status) {
      case "running":
        return t("chat.toolRunning");
      case "done":
        return t("chat.toolDone");
      case "error":
        return t("chat.toolError");
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const text = composerRef.current?.value ?? "";
    if (text.trim() === "" && attachedName === null) {
      return;
    }
    void sendChatMessage(text);
    if (composerRef.current !== null) {
      composerRef.current.value = "";
    }
  }

  function takeDroppedImage(event: DragEvent<HTMLElement>): void {
    event.preventDefault();
    const dropped = event.dataTransfer.files[0];
    if (dropped !== undefined && dropped.type.startsWith("image/")) {
      attachFile(dropped);
    }
  }

  function renderLine(line: ChatLine): ReactElement {
    if (line.kind === "user") {
      return textLine("end", "default", line.text);
    }
    if (line.kind === "assistantText") {
      return textLine("start", "secondary", line.text);
    }
    if (line.kind === "error") {
      return textLine("start", "destructive", line.text);
    }
    const hasDetails = line.argsText !== "" || line.resultText !== null || line.previewUrl !== null;
    const summaryRow = (
      <>
        {hasDetails ? <ChevronRight className="h-3 w-3 shrink-0 transition-transform group-open/tool:rotate-90" /> : null}
        <span className="font-mono text-xs">{line.name}</span>
        <span className="text-muted-foreground flex items-center gap-1 text-xs">
          <span className={`h-1.5 w-1.5 rounded-full ${toolStatusDots[line.status]}`} />
          {toolStatusText(line.status)}
        </span>
      </>
    );
    return (
      <Message align="start">
        <MessageContent>
          <Bubble align="start" variant="muted">
            <BubbleContent>
              {hasDetails ? (
                <details className="group/tool min-w-0">
                  <summary className="flex cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden">
                    {summaryRow}
                  </summary>
                  <div className="mt-2 grid min-w-0 gap-2">
                    {line.argsText !== "" ? (
                      <div className="grid min-w-0 gap-1">
                        <div className="text-muted-foreground text-xs">{t("chat.toolArguments")}</div>
                        <pre className="overflow-x-auto font-mono text-xs whitespace-pre-wrap">
                          {formatJsonPayload(line.argsText)}
                        </pre>
                      </div>
                    ) : null}
                    {line.resultText !== null ? (
                      <div className="grid min-w-0 gap-1">
                        <div className="text-muted-foreground text-xs">{t("chat.toolResult")}</div>
                        <pre className="overflow-x-auto font-mono text-xs whitespace-pre-wrap">{line.resultText}</pre>
                      </div>
                    ) : null}
                    {line.previewUrl !== null ? (
                      <div className="grid min-w-0 gap-1">
                        <div className="text-muted-foreground text-xs">{t("chat.toolPreview")}</div>
                        <a href={line.previewUrl} target="_blank" rel="noreferrer">
                          <img
                            src={line.previewUrl}
                            alt={t("chat.toolPreviewAlt")}
                            className="h-auto w-full max-w-64 rounded-md border"
                          />
                        </a>
                      </div>
                    ) : null}
                  </div>
                </details>
              ) : (
                <div className="flex items-center gap-2">{summaryRow}</div>
              )}
            </BubbleContent>
          </Bubble>
        </MessageContent>
      </Message>
    );
  }

  return (
    <div
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
      data-testid="chart-chat-panel"
      onDragOver={(event) => event.preventDefault()}
      onDrop={takeDroppedImage}
    >
      {hasMessages ? (
        <MessageScrollerProvider autoScroll>
          <MessageScroller className="min-h-0 flex-1">
            <MessageScrollerViewport>
              <MessageScrollerContent aria-busy={busy} className="min-h-0 gap-3">
                {visibleLines.map((line) => (
                  <MessageScrollerItem key={line.id} messageId={line.id} scrollAnchor={line.kind === "user"}>
                    {renderLine(line)}
                  </MessageScrollerItem>
                ))}
                {showThinking ? (
                  <MessageScrollerItem key="thinking" messageId="thinking">
                    <Message align="start">
                      <MessageContent>
                        <Bubble align="start" variant="secondary">
                          <BubbleContent>
                            <span className="flex items-center gap-2" role="status">
                              <span className="text-muted-foreground text-xs">{t("chat.thinking")}</span>
                              <span className="flex items-center gap-1" aria-hidden="true">
                                {["-0.3s", "-0.15s", "0s"].map((delay) => (
                                  <span
                                    key={delay}
                                    className="bg-muted-foreground h-1.5 w-1.5 animate-bounce rounded-full"
                                    style={{ animationDelay: delay }}
                                  />
                                ))}
                              </span>
                            </span>
                          </BubbleContent>
                        </Bubble>
                      </MessageContent>
                    </Message>
                  </MessageScrollerItem>
                ) : null}
              </MessageScrollerContent>
            </MessageScrollerViewport>
          </MessageScroller>
        </MessageScrollerProvider>
      ) : (
        <div className="min-h-0 flex-1" />
      )}
      {!hasApiKey ? (
        <Button
          className="text-muted-foreground h-auto justify-start px-3 pb-1 text-left text-xs"
          type="button"
          variant="link"
          onClick={() => setSettingsOpen(true)}
        >
          {t("chat.needApiKey")}
        </Button>
      ) : null}
      {attachedName !== null ? (
        <div className="flex items-center justify-between gap-2 px-3 text-xs">
          <span className="truncate">{attachedName}</span>
          <Button className="h-auto px-0" type="button" variant="link" onClick={clearAttachedFile}>
            {t("chat.removeImage")}
          </Button>
        </div>
      ) : null}
      <form
        className="border-primary/20 bg-card/45 m-[var(--chrome-pad)] flex flex-col gap-1 rounded-[var(--chrome-inner-radius)] border-2 p-[var(--chrome-pad)] backdrop-blur-md"
        onSubmit={handleSubmit}
      >
        <input
          accept="image/*"
          className="hidden"
          ref={fileInputRef}
          type="file"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            if (file !== undefined) {
              attachFile(file);
            }
            event.currentTarget.value = "";
          }}
        />
        <Textarea
          className="field-sizing-fixed resize-none border-0 bg-transparent px-1 py-1.5 shadow-none focus-visible:border-transparent focus-visible:ring-0"
          placeholder={t("chat.placeholder")}
          ref={composerRef}
          rows={2}
        />
        <div className="flex items-center justify-between gap-1">
          <Button
            aria-label={t("chat.attachImage")}
            size="icon"
            type="button"
            variant="ghost"
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          {busy ? (
            <Button aria-label={t("chat.stop")} size="icon" type="button" variant="secondary" onClick={interruptChat}>
              <Square className="h-4 w-4" />
            </Button>
          ) : (
            <Button aria-label={t("chat.send")} className="rounded-full" size="icon" type="submit">
              <SendHorizontal className="h-4 w-4" />
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
