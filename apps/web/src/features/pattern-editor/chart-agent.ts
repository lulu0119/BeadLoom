import { createAgent, mem, run, tool, type Agent, type AgentEvent, type AgentInput, type Runner } from "@apeira/core";
import { chat } from "@apeira/core/chat";
import {
  bucketFillPattern,
  buildLegend,
  drawPatternLine,
  setPatternCells,
  type PatternDocument
} from "@beadloom/core";
import { defaultPalette } from "@beadloom/palettes";
import { z } from "zod";
import { installReadableStreamAsyncIterator } from "@/lib/install-readable-stream-async-iterator";
import type { LlmSettings } from "./llm-settings";
import { previewToDataUrl, renderBoardPreview, type BoardCrop } from "./look-at-board";

installReadableStreamAsyncIterator();

export type { LlmSettings };

export type ChartAgentOptions = {
  getPattern: () => PatternDocument;
  commitPattern: (pattern: PatternDocument) => void;
  llm: LlmSettings;
  runner?: Runner;
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

export async function createChartTools(
  options: Pick<ChartAgentOptions, "getPattern" | "commitPattern"> & {
    onBoardPreview?: (dataUrl: string) => void;
  }
) {
  const lookAtBoard = await tool({
    name: "look_at_board",
    description: `${COORDINATE_NOTE} Returns a preview PNG of the bead board (optional crop) plus legend counts. No bead-code glyphs.`,
    parameters: z.object({
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
      if (dataUrl !== null) {
        options.onBoardPreview?.(dataUrl);
      }
      return JSON.stringify(meta);
    }
  });

  const listPalette = await tool({
    name: "list_palette",
    description:
      "List every palette code with its hex and whether it is already used on the current board.",
    parameters: z.object({}),
    execute: () => JSON.stringify({ colors: paletteUsage(options.getPattern()) })
  });

  const setCells = await tool({
    name: "set_cells",
    description: `${COORDINATE_NOTE} Paint a batch of cells. code is a palette code or null to erase.`,
    parameters: z.object({
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

  const drawLine = await tool({
    name: "draw_line",
    description: `${COORDINATE_NOTE} Draw a straight line of palette code (or null to erase) from start to end.`,
    parameters: z.object({
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

  const fillArea = await tool({
    name: "fill_area",
    description: `${COORDINATE_NOTE} Flood-fill from a cell with a palette code.`,
    parameters: z.object({
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

const maxAgentSteps = 20;

function stopWhenToolsAreIdle({
  step,
  steps
}: {
  step: { toolCalls: readonly unknown[] };
  steps: readonly unknown[];
}): boolean {
  if (steps.length > maxAgentSteps) {
    return true;
  }
  return steps.length >= maxAgentSteps && step.toolCalls.length === 0;
}

function boardPreviewUserInput(previewDataUrls: string[]): AgentInput {
  return {
    role: "user",
    type: "message",
    content: [
      {
        type: "input_text",
        text: "look_at_board preview. Image ticks are 1-based; tools stay 0-based."
      },
      ...previewDataUrls.map((imageUrl) => ({ type: "input_image" as const, image_url: imageUrl }))
    ]
  };
}

export async function createChartAgent(options: ChartAgentOptions): Promise<Agent> {
  const pendingBoardPreviews: string[] = [];
  const tools = await createChartTools({
    getPattern: options.getPattern,
    commitPattern: options.commitPattern,
    onBoardPreview: (dataUrl) => {
      pendingBoardPreviews.push(dataUrl);
    }
  });
  const normalizedBaseURL = options.llm.baseURL.endsWith("/") ? options.llm.baseURL : `${options.llm.baseURL}/`;
  const innerRunner =
    options.runner ??
    chat({
      apiKey: options.llm.apiKey,
      baseURL: normalizedBaseURL,
      headers: {
        "x-opencode-session": crypto.randomUUID()
      },
      fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = input instanceof URL ? input : new URL(String(input));
        const useDevProxy =
          process.env.NODE_ENV === "development" &&
          typeof window !== "undefined" &&
          url.origin !== window.location.origin;
        const requestUrl = useDevProxy ? new URL("http://127.0.0.1:8787/") : url;
        const requestInit = useDevProxy
          ? {
              ...init,
              headers: (() => {
                const headers = new Headers(init?.headers);
                headers.set("x-llm-target", url.href);
                return headers;
              })()
            }
          : init;
        return globalThis.fetch(requestUrl, requestInit);
      },
      model: options.llm.model,
      stopWhen: stopWhenToolsAreIdle
    });

  const runner: Runner = async (context) =>
    innerRunner({
      ...context,
      prepareStep: async (step) => {
        const previewDataUrls = pendingBoardPreviews.splice(0);
        const input =
          previewDataUrls.length === 0
            ? step.input
            : [...step.input, boardPreviewUserInput(previewDataUrls)];
        if (context.prepareStep != null) {
          return context.prepareStep({ ...step, input });
        }
        if (previewDataUrls.length === 0) {
          return {};
        }
        return { input };
      }
    });

  return createAgent({
    instructions: INSTRUCTIONS,
    runner,
    storage: mem(),
    tools
  });
}

export async function consumeAgentRun(agent: Agent, input: AgentInput, onEvent: (event: AgentEvent) => void): Promise<void> {
  const stream = run(agent, input);
  const reader = stream.getReader();
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) {
        return;
      }
      onEvent(result.value);
    }
  } finally {
    reader.releaseLock();
  }
}
