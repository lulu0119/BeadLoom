import type { PatternDocument } from "@beadloom/core";
import i18n from "@/i18n/config";
import {
  createPatternRecordId,
  type PatternLibraryDocument,
  type PatternRecord
} from "@/lib/pattern-storage";
import type { StateCreator } from "zustand";
import type { AppStoreState } from "./app-store";
import { clonePattern } from "./pattern-editor-utils";

export type LibrarySlice = {
  library: PatternLibraryDocument;
  persistPattern: (next: PatternDocument) => void;
  updateActivePattern: (
    next: PatternDocument | ((previous: PatternDocument) => PatternDocument)
  ) => void;
  addChart: (pattern: PatternDocument) => void;
  openPattern: (patternId: string) => void;
  deletePattern: (patternId: string) => void;
  duplicatePattern: (patternId: string) => void;
  renamePattern: (patternId: string, title: string) => void;
  addImportedRecord: (record: PatternRecord) => void;
};

export function emptyLibrary(): PatternLibraryDocument {
  return {
    version: 1,
    activePatternId: null,
    patterns: []
  };
}

export function initialLibraryState(): { library: PatternLibraryDocument } {
  return { library: emptyLibrary() };
}

function createRecord(pattern: PatternDocument, title: string, id = createPatternRecordId()): PatternRecord {
  const now = new Date().toISOString();
  return {
    id,
    title,
    createdAt: now,
    updatedAt: now,
    pattern
  };
}

export function selectActiveRecord(state: { library: PatternLibraryDocument }): PatternRecord | null {
  return (
    state.library.patterns.find((record) => record.id === state.library.activePatternId) ??
    state.library.patterns[0] ??
    null
  );
}

export function selectActivePattern(state: { library: PatternLibraryDocument }): PatternDocument | null {
  return selectActiveRecord(state)?.pattern ?? null;
}

export const createLibrarySlice: StateCreator<
  AppStoreState,
  [],
  [["zustand/subscribeWithSelector", never]],
  LibrarySlice
> = (set, get) => ({
  ...initialLibraryState(),
  persistPattern: (next) => {
    const active = selectActiveRecord(get());
    if (active === null) {
      return;
    }
    const { library } = get();
    set({
      library: {
        ...library,
        patterns: library.patterns.map((record) =>
          record.id === active.id ? { ...record, pattern: next, updatedAt: new Date().toISOString() } : record
        )
      }
    });
  },
  updateActivePattern: (next) => {
    const pattern = selectActivePattern(get());
    if (pattern === null) {
      return;
    }
    get().persistPattern(typeof next === "function" ? next(pattern) : next);
  },
  addChart: (pattern) => {
    const record = createRecord(pattern, i18n.t("library.defaultTitle"));
    get().resetChat();
    set((state) => ({
      library: {
        version: 1,
        activePatternId: record.id,
        patterns: [...state.library.patterns, record]
      },
      welcomeOpen: false
    }));
  },
  openPattern: (patternId) => {
    get().resetChat();
    set((state) => ({
      library: { ...state.library, activePatternId: patternId },
      welcomeOpen: false,
      libraryOpen: false
    }));
  },
  deletePattern: (patternId) => {
    const { library } = get();
    const patterns = library.patterns.filter((record) => record.id !== patternId);
    if (patterns.length === 0) {
      set({ library: emptyLibrary(), welcomeOpen: true });
      return;
    }
    set({
      library: {
        version: 1,
        activePatternId:
          library.activePatternId === patternId ? (patterns[0]?.id ?? null) : library.activePatternId,
        patterns
      }
    });
  },
  duplicatePattern: (patternId) => {
    const { library } = get();
    const source = library.patterns.find((record) => record.id === patternId);
    if (source === undefined) {
      return;
    }
    const copy = createRecord(
      clonePattern(source.pattern),
      `${source.title} ${i18n.t("library.duplicatedTitleSuffix")}`
    );
    set((state) => ({
      library: {
        ...state.library,
        activePatternId: copy.id,
        patterns: [...state.library.patterns, copy]
      },
      welcomeOpen: false
    }));
  },
  renamePattern: (patternId, title) => {
    set((state) => ({
      library: {
        ...state.library,
        patterns: state.library.patterns.map((record) =>
          record.id === patternId ? { ...record, title } : record
        )
      }
    }));
  },
  addImportedRecord: (record) => {
    set((state) => ({
      library: {
        version: 1,
        activePatternId: record.id,
        patterns: [...state.library.patterns, record]
      },
      welcomeOpen: false
    }));
  }
});
