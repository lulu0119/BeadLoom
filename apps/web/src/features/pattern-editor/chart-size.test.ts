import { MAX_PATTERN_SIZE } from "@beadloom/core";
import { describe, expect, it } from "vitest";
import { parseChartDimension } from "./chart-size";

describe("parseChartDimension", () => {
  it("accepts integers inside the pattern size limits", () => {
    expect(parseChartDimension("32")).toBe(32);
    expect(parseChartDimension("0")).toBeNull();
    expect(parseChartDimension("12.5")).toBeNull();
    expect(parseChartDimension("abc")).toBeNull();
    expect(parseChartDimension(String(MAX_PATTERN_SIZE))).toBe(MAX_PATTERN_SIZE);
    expect(parseChartDimension(String(MAX_PATTERN_SIZE + 1))).toBeNull();
  });
});
