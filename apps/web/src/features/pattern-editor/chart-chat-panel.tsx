"use client";

import { useRef, useState, type ReactElement } from "react";
import { ChevronRight, Paperclip, SendHorizontal, Square, Plus, Pencil, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  useAui,
  useAuiState,
  ThreadPrimitive,
  ComposerPrimitive,
  unstable_useSlashCommandAdapter,
  type ThreadAssistantMessagePart,
  type ToolCallMessagePart
} from "@assistant-ui/react";
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
  MessageScrollerViewport
} from "@beadloom/ui";
import { useAppStore } from "./app-store";
import { selectActiveRecord } from "./library-slice";
import { ChartChatRuntime } from "./chart-chat-runtime";

function formatJsonPayload(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

function TextBubble({
  text,
  user = false,
  error = false
}: {
  text: string;
  user?: boolean;
  error?: boolean;
}): ReactElement {
  const align = user ? "end" : "start";
  return (
    <Message align={align}>
      <MessageContent>
        <Bubble align={align} variant={error ? "destructive" : user ? "default" : "secondary"}>
          <BubbleContent className="whitespace-pre-wrap">{text}</BubbleContent>
        </Bubble>
      </MessageContent>
    </Message>
  );
}

function ToolBubble({ part, running }: { part: ToolCallMessagePart; running: boolean }): ReactElement {
  const { t } = useTranslation();
  const status =
    part.isError || (part.result === undefined && !running)
      ? "error"
      : part.result === undefined
        ? "running"
        : "done";
  const dots = {
    running: "bg-amber-500 animate-pulse",
    done: "bg-emerald-500",
    error: "bg-destructive"
  };
  const labels = {
    running: t("chat.toolRunning"),
    done: t("chat.toolDone"),
    error: t("chat.toolError")
  };
  return (
    <Message align="start">
      <MessageContent>
        <Bubble align="start" variant="muted">
          <BubbleContent>
            <details className="group/tool min-w-0">
              <summary className="flex cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden">
                <ChevronRight className="h-3 w-3 shrink-0 transition-transform group-open/tool:rotate-90" />
                <span className="font-mono text-xs">{part.toolName}</span>
                <span className="text-muted-foreground flex items-center gap-1 text-xs">
                  <span className={`h-1.5 w-1.5 rounded-full ${dots[status]}`} />
                  {labels[status]}
                </span>
              </summary>
              <div className="mt-2 grid min-w-0 gap-2">
                <div className="text-muted-foreground text-xs">{t("chat.toolArguments")}</div>
                <pre className="overflow-x-auto font-mono text-xs whitespace-pre-wrap">
                  {formatJsonPayload(part.argsText)}
                </pre>
                {part.result !== undefined && (
                  <>
                    <div className="text-muted-foreground text-xs">{t("chat.toolResult")}</div>
                    <pre className="overflow-x-auto font-mono text-xs whitespace-pre-wrap">
                      {typeof part.result === "string" ? part.result : JSON.stringify(part.result)}
                    </pre>
                  </>
                )}
                {typeof part.artifact === "string" && (
                  <a href={part.artifact} target="_blank" rel="noreferrer">
                    <img
                      src={part.artifact}
                      alt={t("chat.toolPreviewAlt")}
                      className="h-auto w-full max-w-64 rounded-md border"
                    />
                  </a>
                )}
              </div>
            </details>
          </BubbleContent>
        </Bubble>
      </MessageContent>
    </Message>
  );
}

function AssistantPart({
  part,
  running
}: {
  part: ThreadAssistantMessagePart;
  running: boolean;
}): ReactElement | null {
  const { t } = useTranslation();
  if (part.type === "text") return part.text ? <TextBubble text={part.text} /> : null;
  if (part.type === "reasoning")
    return (
      <details className="text-muted-foreground px-3 text-xs">
        <summary>{t("chat.reasoning")}</summary>
        <p className="whitespace-pre-wrap">{part.text}</p>
      </details>
    );
  if (part.type === "tool-call") return <ToolBubble part={part} running={running} />;
  return null;
}

export function ChartChatPanel(): ReactElement {
  const patternId = useAppStore((state) => selectActiveRecord(state)?.id);
  return patternId ? (
    <ChartChatRuntime key={patternId} patternId={patternId}>
      <ChartChatContent />
    </ChartChatRuntime>
  ) : (
    <div />
  );
}

export function ChartChatContent(): ReactElement {
  const { t } = useTranslation();
  const aui = useAui();
  const messages = useAuiState((state) => state.thread.messages);
  const busy = useAuiState((state) => state.thread.isRunning);
  const sessions = useAuiState((state) => state.threads.threadItems);
  const activeId = useAuiState((state) => state.threads.mainThreadId);
  const attachments = useAuiState((state) => state.composer.attachments);
  const active = sessions.find((entry) => entry.id === activeId);
  const [renaming, setRenaming] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasApiKey = useAppStore((state) => state.llm.apiKey.trim() !== "");
  const setSettingsOpen = useAppStore((state) => state.setSettingsOpen);
  const newSession = (): void => {
    aui.thread.cancelRun();
    aui.threads.switchToNewThread();
  };
  const slash = unstable_useSlashCommandAdapter({
    removeOnExecute: true,
    commands: [
      { id: "new", description: t("chat.newSession"), execute: newSession },
      {
        id: "stop",
        description: t("chat.stop"),
        execute: () => aui.thread.cancelRun()
      },
      {
        id: "model",
        description: t("settings.title"),
        execute: () => setSettingsOpen(true)
      }
    ]
  });
  const last = messages.at(-1);
  const lastPart = last?.content.at(-1);
  const thinking =
    busy &&
    (!lastPart ||
      last?.role === "user" ||
      (lastPart.type !== "text" && !(lastPart.type === "tool-call" && lastPart.result === undefined)));

  return (
    <ThreadPrimitive.Root
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
      data-testid="chart-chat-panel"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        const file = event.dataTransfer.files[0];
        if (file?.type.startsWith("image/")) void aui.composer.addAttachment(file);
      }}
    >
      <div className="border-primary/10 flex shrink-0 items-center gap-1 border-b px-2 py-2">
        <select
          aria-label={t("chat.sessions")}
          className="bg-transparent min-w-0 flex-1 truncate rounded-md px-1 py-1 text-xs outline-offset-2"
          value={activeId}
          onChange={(event) => {
            aui.thread.cancelRun();
            aui.threads.switchToThread(event.currentTarget.value);
          }}
        >
          {!active && <option value={activeId}>{t("chat.newSession")}</option>}
          {sessions
            .filter((session) => session.status !== "archived")
            .map((session) => (
              <option key={session.id} value={session.id}>
                {session.title ?? t("chat.newSession")}
              </option>
            ))}
        </select>
        <Button
          aria-label={t("chat.newSession")}
          size="icon"
          variant="ghost"
          type="button"
          onClick={newSession}
        >
          <Plus className="size-3.5" />
        </Button>
        <Button
          aria-label={t("chat.renameSession")}
          size="icon"
          variant="ghost"
          type="button"
          onClick={() => setRenaming(!renaming)}
        >
          <Pencil className="size-3.5" />
        </Button>
        <Button
          aria-label={t("chat.deleteSession")}
          size="icon"
          variant="ghost"
          type="button"
          onClick={() => {
            aui.thread.cancelRun();
            aui.threads.item("main").delete();
          }}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
      {renaming && (
        <form
          className="flex gap-2 px-3 py-2"
          onSubmit={(event) => {
            event.preventDefault();
            const title = String(new FormData(event.currentTarget).get("title") ?? "").trim();
            if (title) aui.threads.item("main").rename(title);
            setRenaming(false);
          }}
        >
          <input
            autoFocus
            aria-label={t("chat.sessionTitle")}
            className="border-input min-w-0 flex-1 rounded border px-2 py-1 text-sm"
            name="title"
            defaultValue={active?.title ?? ""}
            maxLength={120}
            required
          />
          <Button type="submit" size="sm">
            {t("settings.save")}
          </Button>
        </form>
      )}
      <MessageScrollerProvider autoScroll>
        <MessageScroller className="min-h-0 flex-1">
          <MessageScrollerViewport>
            <MessageScrollerContent aria-busy={busy} className="min-h-0 gap-3">
              {messages.map((message) => (
                <MessageScrollerItem
                  key={message.id}
                  messageId={message.id}
                  scrollAnchor={message.role === "user"}
                >
                  <div className="grid gap-2">
                    {message.role === "assistant" ? (
                      <>
                        {message.content.map((part, index) => (
                          <AssistantPart
                            key={index}
                            part={part}
                            running={message.status.type === "running"}
                          />
                        ))}
                        {message.status.type === "incomplete" && message.status.reason === "error" && (
                          <TextBubble
                            error
                            text={
                              typeof message.status.error === "object" &&
                              message.status.error !== null &&
                              "message" in message.status.error
                                ? String(message.status.error.message)
                                : t("chat.turnFailed")
                            }
                          />
                        )}
                      </>
                    ) : message.role === "user" ? (
                      [
                        ...message.content,
                        ...message.attachments.flatMap((attachment) => attachment.content)
                      ].map((part, index) =>
                        part.type === "text" ? (
                          <TextBubble key={index} text={part.text} user />
                        ) : part.type === "image" ? (
                          <img
                            key={index}
                            src={part.image}
                            alt={t("chat.attachedImageAlt")}
                            className="ml-auto max-h-40 max-w-48 rounded-lg border object-contain"
                          />
                        ) : null
                      )
                    ) : null}
                  </div>
                </MessageScrollerItem>
              ))}
              {thinking && (
                <MessageScrollerItem messageId="thinking">
                  <span role="status" className="text-muted-foreground animate-pulse px-3 text-xs">
                    {t("chat.thinking")}
                  </span>
                </MessageScrollerItem>
              )}
            </MessageScrollerContent>
          </MessageScrollerViewport>
        </MessageScroller>
      </MessageScrollerProvider>
      {!hasApiKey && (
        <Button
          className="text-muted-foreground h-auto justify-start px-3 pb-1 text-left text-xs"
          type="button"
          variant="link"
          onClick={() => setSettingsOpen(true)}
        >
          {t("chat.needApiKey")}
        </Button>
      )}
      {attachments.map((attachment) => (
        <div key={attachment.id} className="flex items-center justify-between gap-2 px-3 text-xs">
          <span className="truncate">{attachment.name}</span>
          <Button
            className="h-auto px-0"
            type="button"
            variant="link"
            onClick={() => aui.composer.attachment({ id: attachment.id }).remove()}
          >
            {t("chat.removeImage")}
          </Button>
        </div>
      ))}
      <ComposerPrimitive.Root className="border-primary/20 bg-card/45 relative m-[var(--chrome-pad)] flex flex-col gap-1 rounded-[var(--chrome-inner-radius)] border-2 p-[var(--chrome-pad)] backdrop-blur-md">
        <ComposerPrimitive.Unstable_TriggerPopoverRoot>
          <ComposerPrimitive.Input
            className="field-sizing-fixed w-full resize-none bg-transparent px-1 py-1.5 text-sm outline-none"
            placeholder={t("chat.placeholder")}
            rows={2}
          />
          <ComposerPrimitive.Unstable_TriggerPopover
            char="/"
            adapter={slash.adapter}
            className="bg-popover absolute inset-x-0 bottom-full z-50 mb-2 rounded-lg border p-1 shadow-md"
          >
            <ComposerPrimitive.Unstable_TriggerPopover.Action {...slash.action} />
            <ComposerPrimitive.Unstable_TriggerPopoverItems>
              {(items) =>
                items.map((item, index) => (
                  <ComposerPrimitive.Unstable_TriggerPopoverItem
                    key={item.id}
                    item={item}
                    index={index}
                    className="hover:bg-accent data-[highlighted]:bg-accent flex w-full gap-2 rounded px-3 py-2 text-left text-sm"
                  >
                    <span>{item.label}</span>
                    <span className="text-muted-foreground text-xs">{item.description}</span>
                  </ComposerPrimitive.Unstable_TriggerPopoverItem>
                ))
              }
            </ComposerPrimitive.Unstable_TriggerPopoverItems>
          </ComposerPrimitive.Unstable_TriggerPopover>
        </ComposerPrimitive.Unstable_TriggerPopoverRoot>
        <input
          accept="image/*"
          className="hidden"
          ref={fileInputRef}
          type="file"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            if (file) void aui.composer.addAttachment(file);
            event.currentTarget.value = "";
          }}
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
            <ComposerPrimitive.Cancel asChild>
              <Button aria-label={t("chat.stop")} size="icon" type="button" variant="secondary">
                <Square className="h-4 w-4" />
              </Button>
            </ComposerPrimitive.Cancel>
          ) : (
            <ComposerPrimitive.Send asChild>
              <Button aria-label={t("chat.send")} className="rounded-full" size="icon" type="button">
                <SendHorizontal className="h-4 w-4" />
              </Button>
            </ComposerPrimitive.Send>
          )}
        </div>
      </ComposerPrimitive.Root>
    </ThreadPrimitive.Root>
  );
}
