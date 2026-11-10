import {
  tool,
  type StreamTextOptions,
  type LanguageModel,
  type Message,
  type UserMessageContent
} from "@xsai/text";
import { chat } from "@xsai/text-chat";
import {
  bucketFillPattern,
  buildLegend,
  drawPatternLine,
  setPatternCells,
  type PatternDocument
} from "@beadloom/core";
import { defaultPalette } from "@beadloom/palettes";
import { z } from "zod";
import { logStepRequest, logTurnInput, summarizeAgentInput, toLoggedMessages } from "./agent-debug-log";
import type { LlmSettings } from "./llm-settings";
import { relayModelRequest } from "./model-transport";
import { previewToDataUrl, renderBoardPreview, type BoardCrop } from "./look-at-board";

export type { LlmSettings };

export type ChartAgentOptions = {
  getPattern: () => PatternDocument;
  commitPattern: (pattern: PatternDocument) => void;
  llm: LlmSettings;
  fetch?: (request: Request) => Promise<Response>;
  turnId?: string;
  sessionId?: string;
};

const paletteByCode = new Map(defaultPalette.map((color) => [color.code, color]));
const paletteCodes = new Set(defaultPalette.map((color) => color.code));

const COORDINATE_NOTE =
  "Tool coordinates are 0-based {column, row}. The preview image ticks are 1-based (the top-left cell is column 1, row 1).";

const cellSchema = z.object({
  column: z.number().int(),
  row: z.number().int(),
  code: z.string().nullable()
});

function assertPaletteCode(code: string | null): void {
  if (code !== null && !paletteCodes.has(code)) {
    throw new Error(`Unknown palette code ${code}.`);
  }
}

function paletteUsage(pattern: PatternDocument) {
  const usedCodes = new Set<string>();
  for (const cell of pattern.cells) {
    if (cell !== null) {
      usedCodes.add(cell);
    }
  }
  return defaultPalette.map((color) => ({
    code: color.code,
    hex: color.hex,
    used: usedCodes.has(color.code)
  }));
}

export async function createChartTools(options: Pick<ChartAgentOptions, "getPattern" | "commitPattern">) {
  const lookAtBoard = tool({
    name: "look_at_board",
    description: `${COORDINATE_NOTE} Returns a preview PNG of the bead board (optional crop) plus legend counts. No bead-code glyphs.`,
    inputSchema: z.object({
      column: z.number().int().optional(),
      row: z.number().int().optional(),
      width: z.number().int().optional(),
      height: z.number().int().optional()
    }),
    execute: ({ column, row, width, height }) => {
      const pattern = options.getPattern();
      const crop: BoardCrop | undefined =
        column === undefined && row === undefined && width === undefined && height === undefined
          ? undefined
          : {
              column: column ?? 0,
              row: row ?? 0,
              width: width ?? pattern.width,
              height: height ?? pattern.height
            };
      const preview = renderBoardPreview(pattern, paletteByCode, crop);
      const dataUrl = previewToDataUrl(preview);
      const meta = {
        width: pattern.width,
        height: pattern.height,
        originColumn: preview.originColumn,
        originRow: preview.originRow,
        tickOrigin: "1-based on the image; tools stay 0-based",
        legend: preview.legend
      };
      return [
        { type: "text" as const, text: JSON.stringify(meta) },
        ...(dataUrl === null ? [] : [{ type: "image" as const, data: dataUrl }])
      ];
    }
  });

  const listPalette = tool({
    name: "list_palette",
    description: "List every palette code with its hex and whether it is already used on the current board.",
    inputSchema: z.object({}),
    execute: () => JSON.stringify({ colors: paletteUsage(options.getPattern()) })
  });

  const setCells = tool({
    name: "set_cells",
    description: `${COORDINATE_NOTE} Paint a batch of cells. code is a palette code or null to erase.`,
    inputSchema: z.object({
      cells: z.array(cellSchema)
    }),
    execute: ({ cells }) => {
      for (const cell of cells) {
        assertPaletteCode(cell.code);
      }
      const next = setPatternCells(options.getPattern(), cells);
      options.commitPattern(next);
      return JSON.stringify({ legend: buildLegend(next.cells) });
    }
  });

  const drawLine = tool({
    name: "draw_line",
    description: `${COORDINATE_NOTE} Draw a straight line of palette code (or null to erase) from start to end.`,
    inputSchema: z.object({
      startColumn: z.number().int(),
      startRow: z.number().int(),
      endColumn: z.number().int(),
      endRow: z.number().int(),
      code: z.string().nullable()
    }),
    execute: ({ startColumn, startRow, endColumn, endRow, code }) => {
      assertPaletteCode(code);
      const next = drawPatternLine(
        options.getPattern(),
        { column: startColumn, row: startRow },
        { column: endColumn, row: endRow },
        code
      );
      options.commitPattern(next);
      return JSON.stringify({ legend: buildLegend(next.cells) });
    }
  });

  const fillArea = tool({
    name: "fill_area",
    description: `${COORDINATE_NOTE} Flood-fill from a cell with a palette code.`,
    inputSchema: z.object({
      column: z.number().int(),
      row: z.number().int(),
      code: z.string()
    }),
    execute: ({ column, row, code }) => {
      assertPaletteCode(code);
      const next = bucketFillPattern(options.getPattern(), { column, row }, code);
      options.commitPattern(next);
      return JSON.stringify({ legend: buildLegend(next.cells) });
    }
  });

  return [lookAtBoard, listPalette, setCells, drawLine, fillArea];
}

const INSTRUCTIONS = `You are a bead-chart drawing agent for BeadLoom (豆织工坊).
${COORDINATE_NOTE}
Look at the board, draw with tools, look again, and stop when the chart is good enough.
Call list_palette for real color codes. Each entry is used or unused on the current board. Never guess codes. Never dump the full grid as JSON.`;

export async function createChartRun(options: ChartAgentOptions): Promise<{
  model: LanguageModel;
  options: Omit<StreamTextOptions, "input" | "signal">;
}> {
  const tools = await createChartTools({
    getPattern: options.getPattern,
    commitPattern: options.commitPattern
  });
  const baseURL = options.llm.baseURL.endsWith("/") ? options.llm.baseURL : options.llm.baseURL + "/";
  const isOpenCode = options.llm.providerId === "opencode-go" ||
    options.llm.providerId === "opencode" || new URL(baseURL).hostname === "opencode.ai";
  const model = chat({
    ...options.llm,
    baseURL,
    fetch: options.fetch ?? relayModelRequest,
    headers: isOpenCode ? { "x-opencode-session": options.sessionId } : undefined
  });
  return {
    model: (request) => model({ ...request, input: boardImagesForChat(request.input) }),
    options: {
      instructions: INSTRUCTIONS,
      tools,
      prepareStep: async (step) => {
        const input = [...step.input];
        if (options.turnId) {
          if (step.stepNumber === 0)
            void logTurnInput(options.turnId, {
              model: options.llm.model,
              baseURL,
              tools: tools.map((entry) => ({
                name: entry.name,
                description: entry.description ?? null
              })),
              summary: summarizeAgentInput(input)
            });
          void logStepRequest({
            turnId: options.turnId,
            stepNumber: step.stepNumber,
            model: options.llm.model,
            baseURL,
            injectedPreviewCount: 0,
            messages: toLoggedMessages(INSTRUCTIONS, input)
          });
        }
        return { input };
      }
    }
  };
}

// Chat Completions accepts board images in user messages, not tool messages.
function boardImagesForChat(input: Message[] | string): Message[] | string {
  if (typeof input === "string") return input;
  return input.flatMap((message): Message[] => {
    if (message.role !== "user" || typeof message.content === "string") return [message];
    const images: UserMessageContent[] = [];
    const content = message.content.map((part): UserMessageContent => {
      if (part.type !== "tool-result" || typeof part.output === "string") return part;
      images.push(...part.output.filter((item) => item.type === "image"));
      return {
        ...part,
        output: part.output.filter((item) => item.type === "text")
      };
    });
    return [
      { role: "user", content },
      ...(images.length ? [{ role: "user" as const, content: images }] : [])
    ];
  });
}
