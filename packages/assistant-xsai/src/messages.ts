import type { ThreadMessage } from "@assistant-ui/react";
import type { Message, ToolCallPart } from "@xsai/text";
import { z } from "zod";

const metadata = z.record(z.string(), z.json()).optional();
const text = z.object({
  type: z.literal("text"),
  text: z.string(),
  providerMetadata: metadata
});
const image = z.object({
  type: z.literal("image"),
  data: z.union([z.string(), z.instanceof(URL)]),
  detail: z.enum(["auto", "high", "low"]).optional()
});
const call = z.object({
  type: z.literal("tool-call"),
  id: z.string(),
  callId: z.string(),
  name: z.string(),
  arguments: z.string()
});
const result = z.object({
  type: z.literal("tool-result"),
  callId: z.string(),
  isError: z.boolean().optional(),
  output: z.union([z.string(), z.array(z.union([text, image]))])
});
const assistant = z.union([
  text,
  call,
  z.object({
    type: z.literal("provider"),
    source: z.string(),
    value: z.json()
  }),
  z.object({ type: z.literal("refusal"), refusal: z.string() }),
  z.object({
    type: z.literal("reasoning"),
    id: z.string().optional(),
    providerMetadata: metadata,
    content: z.array(
      z.object({
        type: z.enum(["encrypted", "redacted", "summary", "text"]),
        text: z.string()
      })
    )
  })
]);
const message: z.ZodType<Message> = z.discriminatedUnion("role", [
  z.object({
    role: z.literal("assistant"),
    id: z.string().optional(),
    providerMetadata: metadata,
    content: z.union([z.string(), z.array(assistant)])
  }),
  z.object({
    role: z.literal("user"),
    content: z.union([
      z.string(),
      z.array(
        z.union([
          text,
          image,
          result,
          z.object({
            type: z.literal("file"),
            data: z.union([z.string(), z.instanceof(URL)])
          }),
          z.object({
            type: z.literal("audio"),
            data: z.string(),
            format: z.enum(["mp3", "wav"])
          })
        ])
      )
    ])
  }),
  z.object({
    role: z.enum(["system", "developer"]),
    content: z.union([z.string(), z.array(text)])
  })
]);
export function readToolArgs(argumentsText: string) {
  try {
    return z.record(z.string(), z.json()).parse(JSON.parse(argumentsText));
  } catch {
    return {};
  }
}

export function readHistory(messages: readonly ThreadMessage[]): Message[] {
  const input: Message[] = messages.flatMap((item): Message[] => {
    if (item.role === "assistant") {
      const protocol = item.metadata.custom.xsai;
      if (protocol !== undefined) return closePending(z.array(message).parse(protocol));
      return [
        {
          role: "assistant",
          content: item.content.flatMap((part) =>
            part.type === "text" ? [{ type: "text" as const, text: part.text }] : []
          )
        }
      ];
    }
    if (item.role === "system") return [{ role: "system", content: item.content }];
    return [
      {
        role: "user",
        content: [...item.content, ...item.attachments.flatMap((attachment) => attachment.content)].map(
          (part) => {
            if (part.type === "image") return { type: "image", data: part.image };
            if (part.type === "text") return { type: "text", text: part.text };
            if (part.type === "file") return { type: "file", data: part.data };
            if (part.type === "audio") return { type: "audio", ...part.audio };
            throw new Error(`Unsupported user message part: ${part.type}`);
          }
        )
      }
    ];
  });
  return input;
}

function closePending(input: Message[]): Message[] {
  const pending = new Map<string, ToolCallPart>();
  for (const item of input) {
    if (typeof item.content === "string") continue;
    for (const part of item.content) {
      if (part.type === "tool-call") pending.set(part.callId, part);
      if (part.type === "tool-result") pending.delete(part.callId);
    }
  }
  // A cancelled tool is context, never a request to replay its side effects.
  if (pending.size > 0)
    input.push({
      role: "user",
      content: [...pending.values()].map((part) => ({
        type: "tool-result",
        callId: part.callId,
        isError: true,
        output:
          "This tool was interrupted. Its outcome is unknown; inspect the current state before continuing."
      }))
    });
  return input;
}
