"use client";

import { useRef, type DragEvent, type FormEvent, type ReactElement } from "react";
import { Paperclip, SendHorizontal, Square } from "lucide-react";
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

export type ChatLine = {
  id: string;
  role: "user" | "assistant" | "tool";
  text: string;
};

type ChartChatPanelProps = {
  lines: ChatLine[];
  busy: boolean;
  hasApiKey: boolean;
  attachedName: string | null;
  onAttachFile: (file: File) => void;
  onClearAttach: () => void;
  onSend: (text: string) => void;
  onInterrupt: () => void;
  onOpenSettings: () => void;
};

function bubbleVariantForRole(role: ChatLine["role"]): "default" | "secondary" | "muted" {
  switch (role) {
    case "user":
      return "default";
    case "tool":
      return "muted";
    case "assistant":
      return "secondary";
  }
}

export function ChartChatPanel({
  lines,
  busy,
  hasApiKey,
  attachedName,
  onAttachFile,
  onClearAttach,
  onSend,
  onInterrupt,
  onOpenSettings
}: ChartChatPanelProps): ReactElement {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const hasMessages = lines.length > 0;

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const text = composerRef.current?.value ?? "";
    if (text.trim() === "" && attachedName === null) {
      return;
    }
    onSend(text);
    if (composerRef.current !== null) {
      composerRef.current.value = "";
    }
  }

  function takeDroppedImage(event: DragEvent<HTMLElement>): void {
    event.preventDefault();
    const dropped = event.dataTransfer.files[0];
    if (dropped !== undefined && dropped.type.startsWith("image/")) {
      onAttachFile(dropped);
    }
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
                {lines.map((line) => {
                  const align = line.role === "user" ? "end" : "start";
                  return (
                    <MessageScrollerItem key={line.id} messageId={line.id} scrollAnchor={line.role === "user"}>
                      <Message align={align}>
                        <MessageContent>
                          <Bubble align={align} variant={bubbleVariantForRole(line.role)}>
                            <BubbleContent className={line.role === "tool" ? "font-mono text-xs" : undefined}>
                              {line.text}
                            </BubbleContent>
                          </Bubble>
                        </MessageContent>
                      </Message>
                    </MessageScrollerItem>
                  );
                })}
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
          onClick={onOpenSettings}
        >
          {t("chat.needApiKey")}
        </Button>
      ) : null}
      {attachedName !== null ? (
        <div className="flex items-center justify-between gap-2 px-3 text-xs">
          <span className="truncate">{attachedName}</span>
          <Button className="h-auto px-0" type="button" variant="link" onClick={onClearAttach}>
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
              onAttachFile(file);
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
            <Button aria-label={t("chat.stop")} size="icon" type="button" variant="secondary" onClick={onInterrupt}>
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
