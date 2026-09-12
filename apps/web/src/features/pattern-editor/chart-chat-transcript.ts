export type ChatToolStatus = "running" | "done" | "error";

export type ChatLine =
  | { kind: "user"; id: string; text: string }
  | { kind: "assistantText"; id: string; text: string }
  | {
      kind: "tool";
      id: string;
      toolCallId: string;
      name: string;
      status: ChatToolStatus;
      argsText: string;
      resultText: string | null;
      previewUrl: string | null;
    }
  | { kind: "error"; id: string; text: string };

export type ChatTranscriptUpdate =
  | { type: "textStarted"; id: string }
  | { type: "textDelta"; delta: string }
  | { type: "textDone"; content: string }
  | { type: "toolStarted"; id: string; toolCallId: string; name: string }
  | { type: "toolArgsDone"; toolCallId: string; args: string }
  | { type: "toolResultDone"; toolCallId: string; resultText: string; isError: boolean }
  | { type: "toolPreview"; toolCallId: string; previewUrl: string }
  | { type: "error"; id: string; text: string };

function withoutTrailingEmptyText(lines: ChatLine[]): ChatLine[] {
  const last = lines.at(-1);
  if (last !== undefined && last.kind === "assistantText" && last.text === "") {
    return lines.slice(0, -1);
  }
  return lines;
}

function updateToolByCallId(
  lines: ChatLine[],
  toolCallId: string,
  update: (line: Extract<ChatLine, { kind: "tool" }>) => Extract<ChatLine, { kind: "tool" }>
): ChatLine[] {
  let matched = false;
  const next = lines.map((line) => {
    if (line.kind === "tool" && line.toolCallId === toolCallId) {
      matched = true;
      return update(line);
    }
    return line;
  });
  return matched ? next : lines;
}

export function updateChatTranscript(lines: ChatLine[], update: ChatTranscriptUpdate): ChatLine[] {
  switch (update.type) {
    case "textStarted": {
      return [...withoutTrailingEmptyText(lines), { kind: "assistantText", id: update.id, text: "" }];
    }
    case "textDelta": {
      const last = lines.at(-1);
      if (last === undefined || last.kind !== "assistantText") {
        return lines;
      }
      return [...lines.slice(0, -1), { ...last, text: `${last.text}${update.delta}` }];
    }
    case "textDone": {
      const last = lines.at(-1);
      if (last === undefined || last.kind !== "assistantText") {
        return lines;
      }
      if (update.content === "") {
        return last.text === "" ? lines.slice(0, -1) : lines;
      }
      return [...lines.slice(0, -1), { ...last, text: update.content }];
    }
    case "toolStarted": {
      return [
        ...withoutTrailingEmptyText(lines),
        {
          kind: "tool",
          id: update.id,
          toolCallId: update.toolCallId,
          name: update.name,
          status: "running",
          argsText: "",
          resultText: null,
          previewUrl: null
        }
      ];
    }
    case "toolArgsDone": {
      return updateToolByCallId(lines, update.toolCallId, (line) => ({ ...line, argsText: update.args }));
    }
    case "toolResultDone": {
      return updateToolByCallId(lines, update.toolCallId, (line) => ({
        ...line,
        status: update.isError ? "error" : "done",
        resultText: update.resultText
      }));
    }
    case "toolPreview": {
      return updateToolByCallId(lines, update.toolCallId, (line) => ({
        ...line,
        previewUrl: update.previewUrl
      }));
    }
    case "error": {
      return [...withoutTrailingEmptyText(lines), { kind: "error", id: update.id, text: update.text }];
    }
  }
}
