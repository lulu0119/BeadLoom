import { createBlankPattern } from "@beadloom/core";
import { defaultPalette } from "@beadloom/palettes";
import { user } from "@apeira/core";
import { describe, expect, it } from "vitest";
import { consumeAgentRun, createChartAgent, createChartTools } from "./chart-agent";
import { renderBoardPreview } from "./look-at-board";

describe("look_at_board preview", () => {
  it("paints the top-left cell after the gutter in 0-based pattern space", () => {
    const pattern = createBlankPattern(2, 2);
    pattern.cells[0] = "H7";
    const paletteByCode = new Map(defaultPalette.map((color) => [color.code, color]));
    const preview = renderBoardPreview(pattern, paletteByCode);
    const gutter = 16;
    const black = preview.pixels[gutter * preview.width + gutter];
    expect(black).toEqual({ red: 0, green: 0, blue: 0 });
  });
});

describe("chart agent tools", () => {
  it("mutates the document when a mock runner calls set_cells", async () => {
    let pattern = createBlankPattern(4, 4);
    const agent = await createChartAgent({
      getPattern: () => pattern,
      commitPattern: (next) => {
        pattern = next;
      },
      llm: { apiKey: "test", baseURL: "https://example.test/v1/", model: "test" },
      runner: async (context) => {
        const setCells = context.tools.find((entry) => entry.function.name === "set_cells");
        if (setCells === undefined) {
          throw new Error("set_cells tool missing");
        }
        await setCells.execute(
          { cells: [{ column: 1, row: 0, code: "H7" }] },
          { abortSignal: new AbortController().signal, messages: [], toolCallId: "call-1" }
        );
        return { output: [] };
      }
    });

    await agent.init();
    await consumeAgentRun(agent, user("paint"), () => {
      /* drain */
    });

    expect(pattern.cells[1]).toBe("H7");
  });

  it("lists each palette code as used or unused on the current board", async () => {
    const pattern = createBlankPattern(2, 2);
    pattern.cells[0] = "H7";
    const tools = await createChartTools({
      getPattern: () => pattern,
      commitPattern: () => undefined
    });
    const listPalette = tools.find((entry) => entry.function.name === "list_palette");
    if (listPalette === undefined) {
      throw new Error("list_palette tool missing");
    }
    const raw = await listPalette.execute(
      {},
      { abortSignal: new AbortController().signal, messages: [], toolCallId: "call-palette" }
    );
    const parsed = JSON.parse(typeof raw === "string" ? raw : String(raw)) as {
      colors: { code: string; hex: string; used: boolean }[];
    };
    const black = parsed.colors.find((color) => color.code === "H7");
    const unused = parsed.colors.find((color) => color.code === "A1");
    expect(parsed.colors).toHaveLength(defaultPalette.length);
    expect(black).toEqual({ code: "H7", hex: "#000000", used: true });
    expect(unused?.used).toBe(false);
    expect(unused?.hex).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });
});
