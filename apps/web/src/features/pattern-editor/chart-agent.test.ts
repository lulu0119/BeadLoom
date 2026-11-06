import { generateText } from "@xsai/text";
import { createBlankPattern } from "@beadloom/core";
import { defaultPalette } from "@beadloom/palettes";
import { describe, expect, it } from "vitest";
import { createChartRun, createChartTools } from "./chart-agent";
import { renderBoardPreview } from "./look-at-board";

describe("chart xsAI tools", () => {
  it("paints a board through a real xsAI tool loop", async () => {
    let pattern = createBlankPattern(4, 4);
    let requests = 0;
    const run = await createChartRun({
      getPattern: () => pattern,
      commitPattern: (next) => {
        pattern = next;
      },
      llm: { apiKey: "test", baseURL: "https://model.test/v1/", model: "test" },
      fetch: async () => {
        const delta =
          ++requests === 1
            ? {
                tool_calls: [
                  {
                    index: 0,
                    id: "paint-1",
                    type: "function",
                    function: {
                      name: "set_cells",
                      arguments: JSON.stringify({
                        cells: [{ column: 1, row: 0, code: "H7" }]
                      })
                    }
                  }
                ]
              }
            : { content: "Painted" };
        return new Response(
          `data: ${JSON.stringify({ choices: [{ index: 0, delta, finish_reason: requests === 1 ? "tool_calls" : "stop" }] })}\n\ndata: [DONE]\n\n`,
          { headers: { "content-type": "text/event-stream" } }
        );
      }
    });
    const result = await generateText(run.model, {
      ...run.options,
      input: "paint"
    });
    expect(result.text).toBe("Painted");
    expect(pattern.cells[1]).toBe("H7");
    expect(requests).toBe(2);
  });

  it("exposes only drawing and inspection tools with validated palette codes", async () => {
    const pattern = createBlankPattern(2, 2);
    pattern.cells[0] = "H7";
    const tools = await createChartTools({
      getPattern: () => pattern,
      commitPattern: () => undefined
    });
    expect(tools.map((entry) => entry.name)).toEqual([
      "look_at_board",
      "list_palette",
      "set_cells",
      "draw_line",
      "fill_area"
    ]);
    const list = tools.find((entry) => entry.name === "list_palette");
    if (!list) throw new Error("Missing palette tool");
    const raw = await list.execute({});
    expect(JSON.parse(String(raw))).toMatchObject({
      colors: expect.arrayContaining([{ code: "H7", hex: "#000000", used: true }])
    });
    const paint = tools.find((entry) => entry.name === "set_cells");
    if (!paint) throw new Error("Missing paint tool");
    await expect(paint.execute({ cells: [{ column: 0, row: 0, code: "invented" }] })).rejects.toThrow(
      "Unknown palette code"
    );
  });

  it("keeps preview ticks separate from zero-based drawing coordinates", () => {
    const pattern = createBlankPattern(2, 2);
    pattern.cells[0] = "H7";
    const preview = renderBoardPreview(pattern, new Map(defaultPalette.map((color) => [color.code, color])));
    expect(preview.pixels[16 * preview.width + 16]).toEqual({
      red: 0,
      green: 0,
      blue: 0
    });
  });
});
