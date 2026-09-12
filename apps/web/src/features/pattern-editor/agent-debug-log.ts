import { toChat } from "@apeira/core/chat";
import type { AgentEvent, AgentInput } from "@apeira/core";

export type LoggedChatMessage = ReturnType<typeof toChat>[number];

export const AGENT_LOG_KEEP_TURNS = 30;
export const AGENT_LOG_KEEP_BLOBS = 300;

// Short remote urls stay readable inline; only data: urls pay the blob-store cost.
const IMAGE_BLOB_MIN_LENGTH = 2048;
const TURN_ERROR_MAX_LENGTH = 4000;

export type AgentTurnStatus = "running" | "done" | "failed" | "aborted";

export type TurnToolSummary = {
  name: string;
  description: string | null;
};

export type TurnInputSummaryItem = {
  kind: string;
  role?: string;
  content?: string;
  toolCalls?: string[] | null;
  callId?: string;
  name?: string;
};

export type AgentTurnRecord = {
  turnId: string;
  startedAt: number;
  endedAt: number | null;
  status: AgentTurnStatus;
  prompt: string | null;
  model: string | null;
  baseURL: string | null;
  tools: TurnToolSummary[] | null;
  inputSummary: TurnInputSummaryItem[] | null;
  error: string | null;
};

export type StoredChatMessage = {
  role: string;
  content: unknown;
  tool_calls?: unknown;
  tool_call_id?: unknown;
  [key: string]: unknown;
};

export type AgentRequestRecord = {
  id?: number;
  turnId: string;
  stepNumber: number;
  loggedAt: number;
  model: string;
  baseURL: string;
  injectedPreviewCount: number;
  messageCount: number;
  imageHashes: string[];
  messages: StoredChatMessage[];
};

export type AgentEventRecord = {
  id?: number;
  turnId: string;
  stepNumber: number | null;
  loggedAt: number;
  type: string;
  toolCallId?: string;
  toolName?: string;
  args?: string;
  resultText?: string;
  isError?: boolean;
  text?: string;
  error?: string;
  usage?: { inputTokens: number; outputTokens: number; totalTokens: number };
};

export type ImageBlobRecord = {
  hash: string;
  dataUrl: string;
  byteLength: number;
  firstSeen: number;
};

export type AgentTurnDetail = {
  turn: AgentTurnRecord;
  requests: AgentRequestRecord[];
  events: AgentEventRecord[];
};

export type AgentLogBackend = {
  upsertTurn(turn: AgentTurnRecord): Promise<void>;
  getTurn(turnId: string): Promise<AgentTurnRecord | null>;
  listTurns(limit: number): Promise<AgentTurnRecord[]>;
  addRequest(request: Omit<AgentRequestRecord, "id">): Promise<void>;
  listRequests(turnId: string): Promise<AgentRequestRecord[]>;
  addEvent(event: Omit<AgentEventRecord, "id">): Promise<void>;
  listEvents(turnId: string): Promise<AgentEventRecord[]>;
  putBlob(blob: ImageBlobRecord): Promise<void>;
  getBlob(hash: string): Promise<ImageBlobRecord | null>;
  prune(keepTurns: number, keepBlobs: number): Promise<void>;
  clear(): Promise<void>;
};

export function hashImageUrl(url: string): string {
  let high = 0xcbf29ce4;
  let low = 0x84222325;
  for (let index = 0; index < url.length; index += 1) {
    const code = url.charCodeAt(index);
    high = Math.imul(high ^ code, 0x01000193);
    low = Math.imul(low ^ (code + index), 0x01000193);
  }
  return `${(high >>> 0).toString(16).padStart(8, "0")}${(low >>> 0).toString(16).padStart(8, "0")}`;
}

function isImageUrlPart(value: unknown): value is { type: "image_url"; image_url: { url: unknown; detail?: unknown } } {
  if (typeof value !== "object" || value === null || !("type" in value) || value.type !== "image_url") {
    return false;
  }
  return "image_url" in value && typeof value.image_url === "object" && value.image_url !== null;
}

function extractImagesFromValue(
  value: unknown,
  blobs: Map<string, string>
): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => extractImagesFromValue(entry, blobs));
  }
  if (typeof value === "object" && value !== null) {
    if (isImageUrlPart(value)) {
      const url = value.image_url.url;
      const detail = value.image_url.detail;
      if (typeof url === "string" && url.length >= IMAGE_BLOB_MIN_LENGTH) {
        const hash = hashImageUrl(url);
        blobs.set(hash, url);
        return {
          type: "image_url",
          imageHash: hash,
          imageByteLength: url.length,
          ...(typeof detail === "string" ? { detail } : {})
        };
      }
      return value;
    }
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, extractImagesFromValue(entry, blobs)])
    );
  }
  return value;
}

export function extractMessageImages(message: LoggedChatMessage): {
  message: StoredChatMessage;
  blobs: Array<{ hash: string; dataUrl: string }>;
} {
  const blobs = new Map<string, string>();
  const stored: StoredChatMessage = {
    ...message,
    role: message.role,
    content: extractImagesFromValue(message.content, blobs)
  };
  return {
    message: stored,
    blobs: [...blobs].map(([hash, dataUrl]) => ({ hash, dataUrl }))
  };
}

function resolveImagesInValue(value: unknown, blobs: Map<string, string>): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => resolveImagesInValue(entry, blobs));
  }
  if (typeof value === "object" && value !== null) {
    if ("imageHash" in value && typeof value.imageHash === "string") {
      const dataUrl = blobs.get(value.imageHash);
      if (dataUrl === undefined) {
        return { type: "image_url", imageMissing: true, imageHash: value.imageHash };
      }
      return {
        type: "image_url",
        image_url: {
          url: dataUrl,
          ...("detail" in value && typeof value.detail === "string" ? { detail: value.detail } : {})
        }
      };
    }
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, resolveImagesInValue(entry, blobs)])
    );
  }
  return value;
}

export function resolveMessageImages(message: StoredChatMessage, blobs: Map<string, string>): StoredChatMessage {
  return { ...message, content: resolveImagesInValue(message.content, blobs) };
}

export function toLoggedMessages(
  instructions: string,
  inputs: readonly AgentInput[]
): LoggedChatMessage[] {
  const prefix: LoggedChatMessage[] =
    instructions === "" ? [] : [{ content: instructions, role: "system" }];
  return [...prefix, ...toChat(inputs)];
}

function describeContentPart(part: unknown): string {
  if (typeof part !== "object" || part === null || !("type" in part)) {
    return "unknown";
  }
  const textLength =
    "text" in part && typeof part.text === "string" ? part.text.length : null;
  const imageLength =
    "image_url" in part && typeof part.image_url === "string" ? part.image_url.length : null;
  if (textLength !== null) {
    return `${String(part.type)}:${textLength}`;
  }
  if (imageLength !== null) {
    return `${String(part.type)}:${imageLength}`;
  }
  return String(part.type);
}

export function summarizeAgentInput(inputs: readonly AgentInput[]): TurnInputSummaryItem[] {
  return inputs.map((input) => {
    if (input.type === "function_call") {
      return { kind: "function_call", callId: input.call_id, name: input.name };
    }
    if (input.type === "function_call_output") {
      return { kind: "function_call_output", callId: input.call_id };
    }
    if (input.type !== "message") {
      return { kind: typeof input.type === "string" ? input.type : "unknown" };
    }
    const content =
      typeof input.content === "string"
        ? `text:${input.content.length}`
        : input.content.map(describeContentPart).join("+");
    const toolCalls =
      "tool_calls" in input && Array.isArray(input.tool_calls)
        ? input.tool_calls.map((call) =>
            typeof call === "object" && call !== null && "id" in call ? String(call.id) : "unknown"
          )
        : null;
    return { kind: "message", role: input.role, content, toolCalls };
  });
}

export function createMemoryAgentLogBackend(): AgentLogBackend {
  const turns = new Map<string, AgentTurnRecord>();
  const requests: AgentRequestRecord[] = [];
  const events: AgentEventRecord[] = [];
  const blobs = new Map<string, ImageBlobRecord>();
  let nextId = 1;
  return {
    upsertTurn: async (turn) => {
      turns.set(turn.turnId, { ...turn });
    },
    getTurn: async (turnId) => turns.get(turnId) ?? null,
    listTurns: async (limit) =>
      [...turns.values()].sort((left, right) => right.startedAt - left.startedAt).slice(0, limit),
    addRequest: async (request) => {
      requests.push({ ...request, id: nextId });
      nextId += 1;
    },
    listRequests: async (turnId) => requests.filter((request) => request.turnId === turnId),
    addEvent: async (event) => {
      events.push({ ...event, id: nextId });
      nextId += 1;
    },
    listEvents: async (turnId) => events.filter((event) => event.turnId === turnId),
    putBlob: async (blob) => {
      if (!blobs.has(blob.hash)) {
        blobs.set(blob.hash, { ...blob });
      }
    },
    getBlob: async (hash) => blobs.get(hash) ?? null,
    prune: async (keepTurns, keepBlobs) => {
      const victimIds = [...turns.values()]
        .sort((left, right) => right.startedAt - left.startedAt)
        .slice(keepTurns)
        .map((turn) => turn.turnId);
      for (const turnId of victimIds) {
        turns.delete(turnId);
      }
      for (let index = requests.length - 1; index >= 0; index -= 1) {
        if (victimIds.includes(requests[index].turnId)) {
          requests.splice(index, 1);
        }
      }
      for (let index = events.length - 1; index >= 0; index -= 1) {
        if (victimIds.includes(events[index].turnId)) {
          events.splice(index, 1);
        }
      }
      const victimBlobs = [...blobs.values()]
        .sort((left, right) => right.firstSeen - left.firstSeen)
        .slice(keepBlobs)
        .map((blob) => blob.hash);
      for (const hash of victimBlobs) {
        blobs.delete(hash);
      }
    },
    clear: async () => {
      turns.clear();
      requests.length = 0;
      events.length = 0;
      blobs.clear();
    }
  };
}

let backendOverride: AgentLogBackend | null = null;
let defaultBackend: AgentLogBackend | null = null;
let pendingPrompt: string | null = null;
const turnSteps = new Map<string, number>();
const turnWriteChains = new Map<string, Promise<void>>();

export function setAgentLogBackendForTesting(backend: AgentLogBackend | null): void {
  backendOverride = backend;
}

function resolveBackend(): AgentLogBackend {
  if (backendOverride !== null) {
    return backendOverride;
  }
  if (defaultBackend === null) {
    defaultBackend = createMemoryAgentLogBackend();
  }
  return defaultBackend;
}

export function setPendingPrompt(prompt: string): void {
  pendingPrompt = prompt;
}

export function clearPendingPrompt(): void {
  pendingPrompt = null;
}

function takePendingPrompt(): string | null {
  const prompt = pendingPrompt;
  pendingPrompt = null;
  return prompt;
}

// turn.start and runner entry race to create the same record; serialize per-turn merges.
function chainTurnWrite(turnId: string, write: () => Promise<void>): Promise<void> {
  const previous = turnWriteChains.get(turnId) ?? Promise.resolve();
  const next = previous.then(write, write);
  turnWriteChains.set(turnId, next);
  return next;
}

async function mergeTurnRecord(
  backend: AgentLogBackend,
  turnId: string,
  patch: Partial<AgentTurnRecord>
): Promise<void> {
  const current = await backend.getTurn(turnId);
  await backend.upsertTurn({
    turnId,
    startedAt: Date.now(),
    endedAt: null,
    status: "running",
    prompt: null,
    model: null,
    baseURL: null,
    tools: null,
    inputSummary: null,
    error: null,
    ...current,
    ...patch
  });
}

function mergeTurn(turnId: string, patch: Partial<AgentTurnRecord>): Promise<void> {
  return chainTurnWrite(turnId, () => mergeTurnRecord(resolveBackend(), turnId, patch));
}

function eventStepNumber(turnId: string): number | null {
  return turnSteps.get(turnId) ?? null;
}

function failureText(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`.slice(0, TURN_ERROR_MAX_LENGTH);
  }
  return String(error).slice(0, TURN_ERROR_MAX_LENGTH);
}

function resultTextOf(result: unknown): string {
  if (typeof result === "string") {
    return result;
  }
  return JSON.stringify(result, null, 2) ?? String(result);
}

export async function logAgentEvent(event: AgentEvent): Promise<void> {
  try {
    const backend = resolveBackend();
    const turnId = event.turnId;
    switch (event.type) {
      case "turn.start": {
        await mergeTurn(turnId, { startedAt: Date.now(), status: "running", prompt: takePendingPrompt() });
        break;
      }
      case "step.start": {
        const stepNumber = (turnSteps.get(turnId) ?? -1) + 1;
        turnSteps.set(turnId, stepNumber);
        await backend.addEvent({ turnId, stepNumber, loggedAt: Date.now(), type: event.type });
        break;
      }
      case "step.done": {
        await backend.addEvent({
          turnId,
          stepNumber: eventStepNumber(turnId),
          loggedAt: Date.now(),
          type: event.type,
          ...(event.usage === undefined ? {} : { usage: event.usage })
        });
        break;
      }
      case "text.done":
      case "reasoning.done": {
        await backend.addEvent({
          turnId,
          stepNumber: eventStepNumber(turnId),
          loggedAt: Date.now(),
          type: event.type,
          text: event.content
        });
        break;
      }
      case "tool-call.start": {
        await backend.addEvent({
          turnId,
          stepNumber: eventStepNumber(turnId),
          loggedAt: Date.now(),
          type: event.type,
          toolCallId: event.toolCallId,
          toolName: event.toolName
        });
        break;
      }
      case "tool-call.done": {
        await backend.addEvent({
          turnId,
          stepNumber: eventStepNumber(turnId),
          loggedAt: Date.now(),
          type: event.type,
          toolCallId: event.toolCallId,
          toolName: event.toolName,
          args: event.args
        });
        break;
      }
      case "tool-result.done": {
        await backend.addEvent({
          turnId,
          stepNumber: eventStepNumber(turnId),
          loggedAt: Date.now(),
          type: event.type,
          toolCallId: event.toolCallId,
          toolName: event.toolName,
          resultText: resultTextOf(event.result),
          ...(event.isError === true ? { isError: true } : {})
        });
        break;
      }
      case "turn.done": {
        await mergeTurn(turnId, { endedAt: Date.now(), status: "done" });
        turnSteps.delete(turnId);
        await backend.prune(AGENT_LOG_KEEP_TURNS, AGENT_LOG_KEEP_BLOBS);
        break;
      }
      case "turn.failed": {
        await mergeTurn(turnId, { endedAt: Date.now(), status: "failed", error: failureText(event.error) });
        turnSteps.delete(turnId);
        await backend.prune(AGENT_LOG_KEEP_TURNS, AGENT_LOG_KEEP_BLOBS);
        break;
      }
      case "turn.aborted": {
        await mergeTurn(turnId, { endedAt: Date.now(), status: "aborted" });
        turnSteps.delete(turnId);
        await backend.prune(AGENT_LOG_KEEP_TURNS, AGENT_LOG_KEEP_BLOBS);
        break;
      }
      case "error": {
        await backend.addEvent({
          turnId,
          stepNumber: eventStepNumber(turnId),
          loggedAt: Date.now(),
          type: event.type,
          error: event.message
        });
        break;
      }
      case "turn.queued":
      case "turn.input_queued":
      case "turn.input_drained":
      case "agent.reset":
      case "text.start":
      case "text.delta":
      case "reasoning.start":
      case "reasoning.delta":
      case "tool-call.delta": {
        // Queue markers and streaming deltas carry no evidence beyond the done events.
        break;
      }
      default: {
        event satisfies never;
        break;
      }
    }
  } catch {
    // Logging must never break drawing.
  }
}

export async function logTurnInput(
  turnId: string,
  input: {
    model: string;
    baseURL: string;
    tools: TurnToolSummary[];
    summary: TurnInputSummaryItem[];
  }
): Promise<void> {
  try {
    await mergeTurn(turnId, {
      model: input.model,
      baseURL: input.baseURL,
      tools: input.tools,
      inputSummary: input.summary
    });
  } catch {
    // Logging must never break drawing.
  }
}

export async function logStepRequest(input: {
  turnId: string;
  stepNumber: number;
  model: string;
  baseURL: string;
  injectedPreviewCount: number;
  messages: readonly LoggedChatMessage[];
}): Promise<void> {
  try {
    const backend = resolveBackend();
    const blobs = new Map<string, string>();
    const messages = input.messages.map((message) => {
      const extracted = extractMessageImages(message);
      for (const blob of extracted.blobs) {
        blobs.set(blob.hash, blob.dataUrl);
      }
      return extracted.message;
    });
    for (const [hash, dataUrl] of blobs) {
      await backend.putBlob({ hash, dataUrl, byteLength: dataUrl.length, firstSeen: Date.now() });
    }
    await backend.addRequest({
      turnId: input.turnId,
      stepNumber: input.stepNumber,
      loggedAt: Date.now(),
      model: input.model,
      baseURL: input.baseURL,
      injectedPreviewCount: input.injectedPreviewCount,
      messageCount: messages.length,
      imageHashes: [...blobs.keys()],
      messages
    });
  } catch {
    // Logging must never break drawing.
  }
}

export function getRecentTurns(limit = AGENT_LOG_KEEP_TURNS): Promise<AgentTurnRecord[]> {
  return resolveBackend().listTurns(limit);
}

export async function getTurnDetail(turnId: string): Promise<AgentTurnDetail | null> {
  const backend = resolveBackend();
  const turn = await backend.getTurn(turnId);
  if (turn === null) {
    return null;
  }
  const [requests, events] = await Promise.all([
    backend.listRequests(turnId),
    backend.listEvents(turnId)
  ]);
  const hashes = new Set<string>();
  for (const request of requests) {
    for (const hash of request.imageHashes) {
      hashes.add(hash);
    }
  }
  const blobs = new Map<string, string>();
  for (const hash of hashes) {
    const blob = await backend.getBlob(hash);
    if (blob !== null) {
      blobs.set(hash, blob.dataUrl);
    }
  }
  return {
    turn,
    requests: requests.map((request) => ({
      ...request,
      messages: request.messages.map((message) => resolveMessageImages(message, blobs))
    })),
    events
  };
}

export async function clearAgentLogs(): Promise<void> {
  turnSteps.clear();
  await resolveBackend().clear();
}

if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  (window as unknown as { __beadloomAgentLogs?: unknown }).__beadloomAgentLogs = {
    getRecentTurns,
    getTurnDetail,
    clearAgentLogs
  };
}
