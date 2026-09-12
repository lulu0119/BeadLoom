import { createBlankPattern } from "@beadloom/core";
import { describe, expect, it } from "vitest";
import {
  importPatternRecordFromExportJson,
  parsePatternLibraryDocument,
  serializePatternLibraryDocument,
  validatePatternLibraryDocument,
  type PatternLibraryDocument,
  type PatternRecord
} from "./pattern-storage";

describe("pattern library document", () => {
  const baseRecord: PatternRecord = {
    id: "pat-1",
    title: "Test",
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-02T00:00:00.000Z",
    pattern: createBlankPattern(2, 2)
  };

  const validLibrary: PatternLibraryDocument = {
    version: 1,
    activePatternId: "pat-1",
    patterns: [baseRecord]
  };

  it("accepts a complete pattern library document", () => {
    expect(validatePatternLibraryDocument(validLibrary)).toEqual(validLibrary);
  });

  it("rejects unknown library version", () => {
    expect(() => validatePatternLibraryDocument({ ...validLibrary, version: 99 as unknown as 1 })).toThrow(/version/i);
  });

  it("rejects patterns whose cells do not match dimensions", () => {
    const blank = createBlankPattern(2, 2);
    const badPattern = { ...blank, cells: blank.cells.slice(0, 2) };
    expect(() =>
      validatePatternLibraryDocument({
        ...validLibrary,
        patterns: [{ ...baseRecord, pattern: badPattern }]
      })
    ).toThrow(/cells/i);
  });

  it("round-trips through JSON parse and serialize", () => {
    const json = serializePatternLibraryDocument(validLibrary);
    expect(parsePatternLibraryDocument(json)).toEqual(validLibrary);
  });

  it("import assigns a new id and preserves pattern data", () => {
    const exported = {
      format: "beadloom.patternRecord" as const,
      version: 1 as const,
      exportedAt: "2025-03-01T12:00:00.000Z",
      record: baseRecord
    };
    const imported = importPatternRecordFromExportJson(JSON.stringify(exported), () => "new-local-id");
    expect(imported.id).toBe("new-local-id");
    expect(imported.pattern.width).toBe(2);
    expect(imported.pattern.height).toBe(2);
    expect(imported.title).toBe("Test");
  });
});
