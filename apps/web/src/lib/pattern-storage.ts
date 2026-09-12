import { MAX_PATTERN_SIZE, type PatternCell, type PatternDocument } from "@beadloom/core";

export type PatternRecord = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  pattern: PatternDocument;
};

export type PatternLibraryDocument = {
  version: 1;
  activePatternId: string | null;
  patterns: PatternRecord[];
};

export type PatternRecordExportFile = {
  format: "beadloom.patternRecord";
  version: 1;
  exportedAt: string;
  record: PatternRecord;
};

export const PATTERN_LIBRARY_STORAGE_KEY = "beadloom.patternLibrary";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validatePatternDocument(pattern: unknown): PatternDocument {
  if (!isPlainObject(pattern)) {
    throw new Error("Pattern document must be an object.");
  }
  if (pattern.version !== 1) {
    throw new Error("Pattern document has an unsupported version.");
  }
  const width = pattern.width;
  const height = pattern.height;
  if (
    typeof width !== "number" ||
    typeof height !== "number" ||
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    width > MAX_PATTERN_SIZE ||
    height > MAX_PATTERN_SIZE
  ) {
    throw new Error("Pattern dimensions must be integers between 1 and 256.");
  }
  const cells = pattern.cells;
  if (!Array.isArray(cells) || cells.length !== width * height) {
    throw new Error("Pattern cells length does not match dimensions.");
  }
  for (const cell of cells) {
    if (cell !== null && typeof cell !== "string") {
      throw new Error("Pattern cells must be strings or null.");
    }
  }

  const normalized: PatternDocument = {
    version: 1,
    width,
    height,
    cells: [...cells] as PatternCell[]
  };

  if (pattern.legend !== undefined) {
    if (!Array.isArray(pattern.legend)) {
      throw new Error("Pattern legend is invalid.");
    }
    normalized.legend = pattern.legend.map((item: unknown) => {
      if (!isPlainObject(item)) {
        throw new Error("Pattern legend entry is invalid.");
      }
      const code = item.code;
      const count = item.count;
      if (typeof code !== "string" || typeof count !== "number" || !Number.isInteger(count) || count < 0) {
        throw new Error("Pattern legend entry fields are invalid.");
      }
      return { code, count };
    });
  }

  return normalized;
}

export function validatePatternRecord(record: unknown): PatternRecord {
  if (!isPlainObject(record)) {
    throw new Error("Pattern record must be an object.");
  }
  const id = record.id;
  const title = record.title;
  const createdAt = record.createdAt;
  const updatedAt = record.updatedAt;
  if (typeof id !== "string" || id.length === 0) {
    throw new Error("Pattern record id is invalid.");
  }
  if (typeof title !== "string") {
    throw new Error("Pattern record title is invalid.");
  }
  if (typeof createdAt !== "string" || typeof updatedAt !== "string") {
    throw new Error("Pattern record timestamps are invalid.");
  }

  return {
    id,
    title,
    createdAt,
    updatedAt,
    pattern: validatePatternDocument(record.pattern)
  };
}

export function validatePatternLibraryDocument(doc: unknown): PatternLibraryDocument {
  if (!isPlainObject(doc)) {
    throw new Error("Pattern library document must be an object.");
  }
  if (doc.version !== 1) {
    throw new Error("Pattern library has an unsupported version.");
  }
  const patternsRaw = doc.patterns;
  if (!Array.isArray(patternsRaw)) {
    throw new Error("Pattern library patterns must be an array.");
  }
  const patterns = patternsRaw.map((record) => validatePatternRecord(record));
  const ids = new Set<string>();
  for (const record of patterns) {
    if (ids.has(record.id)) {
      throw new Error("Pattern library contains duplicate pattern ids.");
    }
    ids.add(record.id);
  }
  const activePatternId = doc.activePatternId;
  if (activePatternId !== null) {
    if (typeof activePatternId !== "string") {
      throw new Error("Pattern library active pattern id is invalid.");
    }
    if (!ids.has(activePatternId)) {
      throw new Error("Pattern library active pattern id is missing from patterns.");
    }
  }

  return {
    version: 1,
    activePatternId,
    patterns
  };
}

export function serializePatternLibraryDocument(doc: PatternLibraryDocument): string {
  validatePatternLibraryDocument(doc);
  return JSON.stringify(doc);
}

export function parsePatternLibraryDocument(json: string): PatternLibraryDocument {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json) as unknown;
  } catch {
    throw new Error("Pattern library JSON could not be parsed.");
  }
  return validatePatternLibraryDocument(parsed);
}

export function loadPatternLibraryFromLocalStorage(): PatternLibraryDocument | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(PATTERN_LIBRARY_STORAGE_KEY);
    if (raw === null) {
      return null;
    }
    return parsePatternLibraryDocument(raw);
  } catch {
    return null;
  }
}

export function savePatternLibraryToLocalStorage(doc: PatternLibraryDocument): void {
  if (typeof window === "undefined") {
    return;
  }
  const normalized = validatePatternLibraryDocument(doc);
  window.localStorage.setItem(PATTERN_LIBRARY_STORAGE_KEY, serializePatternLibraryDocument(normalized));
}

export function createPatternRecordId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function exportPatternRecordToJson(record: PatternRecord): string {
  const payload: PatternRecordExportFile = {
    format: "beadloom.patternRecord",
    version: 1,
    exportedAt: new Date().toISOString(),
    record: validatePatternRecord(record)
  };
  return JSON.stringify(payload, null, 2);
}

export function importPatternRecordFromExportJson(json: string, createId: () => string): PatternRecord {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json) as unknown;
  } catch {
    throw new Error("Pattern export JSON could not be parsed.");
  }
  if (!isPlainObject(parsed)) {
    throw new Error("Pattern export payload must be an object.");
  }
  if (parsed.format !== "beadloom.patternRecord") {
    throw new Error("Pattern export format is not recognized.");
  }
  if (parsed.version !== 1) {
    throw new Error("Pattern export has an unsupported version.");
  }
  const record = validatePatternRecord(parsed.record);
  const now = new Date().toISOString();
  return {
    ...record,
    id: createId(),
    createdAt: now,
    updatedAt: now
  };
}

export function patternDownloadBasename(title: string): string {
  const trimmed = title.trim();
  const slug = trimmed
    .replace(/[\\/:*?"<>|]+/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 96);
  return slug.length > 0 ? slug : "pattern";
}

export function triggerBrowserDownload(blob: Blob, filename: string): void {
  if (typeof window === "undefined") {
    return;
  }
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
