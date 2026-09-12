import { describe, expect, it } from "vitest";
import { defaultPalette } from "@beadloom/palettes";
import {
  bucketFillPattern,
  createBlankPattern,
  deletePatternColor,
  drawPatternLine,
  findNearestPaletteColor,
  hexToRgb,
  readableTextHexOnBackgroundHex,
  redoPatternHistory,
  replacePatternColor,
  resizePattern,
  rgbToHex,
  setPatternCells,
  undoPatternHistory,
  type PatternDocument,
  type PatternHistory
} from "./index";

describe("color helpers", () => {
  it("round-trips RGB and HEX values", () => {
    expect(hexToRgb("#FAF4C8")).toEqual({ red: 250, green: 244, blue: 200 });
    expect(rgbToHex({ red: 250, green: 244, blue: 200 })).toBe("#FAF4C8");
  });

  it("matches exact palette colors by RGB and Lab", () => {
    const source = { red: 250, green: 244, blue: 200 };

    expect(findNearestPaletteColor(source, defaultPalette, "rgb").code).toBe("A1");
    expect(findNearestPaletteColor(source, defaultPalette, "lab").code).toBe("A1");
  });

  it("picks dark text on light backgrounds and light text on dark backgrounds", () => {
    expect(readableTextHexOnBackgroundHex("#ffffff")).toBe("#171717");
    expect(readableTextHexOnBackgroundHex("#000000")).toBe("#f4f4f5");
  });
});

describe("pattern editing and history", () => {
  const pattern: PatternDocument = {
    version: 1,
    width: 3,
    height: 3,
    cells: ["H7", "H7", "T1", "H7", "T1", "T1", "H7", "H7", "T1"]
  };

  it("creates a blank grid", () => {
    const blank = createBlankPattern(2, 3);
    expect(blank.cells).toEqual([null, null, null, null, null, null]);
    expect(blank.width).toBe(2);
    expect(blank.height).toBe(3);
  });

  it("replaces and deletes colors while updating legend counts", () => {
    const replaced = replacePatternColor(pattern, "H7", "A1");
    expect(replaced.cells.filter((cell) => cell === "A1")).toHaveLength(5);
    expect(requireLegend(replaced).find((item) => item.code === "A1")?.count).toBe(5);

    const deleted = deletePatternColor(replaced, "A1");
    expect(deleted.cells.filter((cell) => cell === null)).toHaveLength(5);
  });

  it("fills only a contiguous bucket region", () => {
    const filled = bucketFillPattern(pattern, { column: 0, row: 0 }, "A1");

    expect(filled.cells).toEqual(["A1", "A1", "T1", "A1", "T1", "T1", "A1", "A1", "T1"]);
  });

  it("draws horizontal, vertical, and diagonal lines", () => {
    expect(drawPatternLine(pattern, { column: 0, row: 0 }, { column: 2, row: 0 }, "A1").cells.slice(0, 3)).toEqual([
      "A1",
      "A1",
      "A1"
    ]);
    expect(drawPatternLine(pattern, { column: 0, row: 0 }, { column: 0, row: 2 }, "A1").cells[6]).toBe("A1");
    expect(drawPatternLine(pattern, { column: 0, row: 0 }, { column: 2, row: 2 }, "A1").cells[8]).toBe("A1");
  });

  it("clears cells along a line when target is null", () => {
    const erased = drawPatternLine(pattern, { column: 0, row: 0 }, { column: 2, row: 0 }, null);
    expect(erased.cells.slice(0, 3)).toEqual([null, null, null]);
    expect(requireLegend(erased).find((item) => item.code === "H7")?.count).toBe(3);
  });

  it("writes a batch of cells", () => {
    const written = setPatternCells(pattern, [
      { column: 0, row: 0, code: "A1" },
      { column: 2, row: 2, code: null }
    ]);
    expect(written.cells[0]).toBe("A1");
    expect(written.cells[8]).toBe(null);
  });

  it("resizes by cropping and padding empty cells", () => {
    const grown = resizePattern(pattern, 4, 2);
    expect(grown.width).toBe(4);
    expect(grown.height).toBe(2);
    expect(grown.cells).toEqual(["H7", "H7", "T1", null, "H7", "T1", "T1", null]);
  });

  it("undoes, redoes, and clears redo after a new edit", () => {
    const first = replacePatternColor(pattern, "H7", "A1");
    const undone = undoPatternHistory(requireHistory(first));
    const redone = redoPatternHistory(undone.history);
    const editedAfterUndo = replacePatternColor(undone.pattern, "T1", "A1", undone.history);

    expect(undone.pattern.cells).toEqual(pattern.cells);
    expect(redone.pattern.cells).toEqual(first.cells);
    expect(requireHistory(editedAfterUndo).future).toHaveLength(0);
  });
});

function requireLegend(pattern: PatternDocument) {
  if (pattern.legend === undefined) {
    throw new Error("Expected pattern legend.");
  }
  return pattern.legend;
}

function requireHistory(pattern: PatternDocument): PatternHistory {
  if (pattern.history === undefined) {
    throw new Error("Expected pattern history.");
  }
  return pattern.history;
}
