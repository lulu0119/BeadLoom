import { createBlankPattern } from "@beadloom/core";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import i18n, { i18nInitialization } from "@/i18n/config";
import { PATTERN_LIBRARY_STORAGE_KEY, type PatternLibraryDocument } from "@/lib/pattern-storage";
import { resetAppStore, useAppStore } from "./app-store";
import { LLM_SETTINGS_STORAGE_KEY } from "./llm-settings";

function storedLibrary(patterns: number): PatternLibraryDocument {
  return {
    version: 1,
    activePatternId: patterns > 0 ? "stored-1" : null,
    patterns:
      patterns > 0
        ? [
            {
              id: "stored-1",
              title: "Stored",
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-01T00:00:00.000Z",
              pattern: createBlankPattern(8, 8)
            }
          ]
        : []
  };
}

beforeAll(async () => {
  await i18nInitialization;
  await i18n.changeLanguage("en");
});

beforeEach(() => {
  resetAppStore();
  localStorage.removeItem(PATTERN_LIBRARY_STORAGE_KEY);
  localStorage.removeItem(LLM_SETTINGS_STORAGE_KEY);
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("hydrateApp", () => {
  it("seeds and saves an empty library when storage is missing", () => {
    useAppStore.getState().hydrateApp();

    const state = useAppStore.getState();
    expect(state.hydrated).toBe(true);
    expect(state.library.patterns).toHaveLength(0);
    expect(state.welcomeOpen).toBe(true);
    const raw = localStorage.getItem(PATTERN_LIBRARY_STORAGE_KEY);
    expect(raw).not.toBeNull();
    expect(raw!).toContain('"patterns"');
  });

  it("opens the editor directly when stored patterns exist", () => {
    localStorage.setItem(PATTERN_LIBRARY_STORAGE_KEY, JSON.stringify(storedLibrary(1)));
    useAppStore.getState().hydrateApp();

    const state = useAppStore.getState();
    expect(state.library.patterns).toHaveLength(1);
    expect(state.library.activePatternId).toBe("stored-1");
    expect(state.welcomeOpen).toBe(false);
  });

  it("shows welcome when the stored library is empty", () => {
    localStorage.setItem(PATTERN_LIBRARY_STORAGE_KEY, JSON.stringify(storedLibrary(0)));
    useAppStore.getState().hydrateApp();

    expect(useAppStore.getState().welcomeOpen).toBe(true);
  });

  it("loads stored llm settings", () => {
    localStorage.setItem(
      LLM_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        apiKey: "sk-test",
        baseURL: "https://example.test/",
        model: "test-model"
      })
    );
    useAppStore.getState().hydrateApp();

    expect(useAppStore.getState().llm).toMatchObject({
      apiKey: "sk-test",
      model: "test-model"
    });
  });
});

describe("library actions", () => {
  beforeEach(() => {
    useAppStore.getState().addChart(createBlankPattern(4, 4));
  });

  it("persists pattern edits to the active record", () => {
    const before = useAppStore.getState().library.patterns[0].updatedAt;
    useAppStore.getState().persistPattern(createBlankPattern(6, 6));

    const record = useAppStore.getState().library.patterns[0];
    expect(record.pattern.width).toBe(6);
    expect(record.updatedAt >= before).toBe(true);
  });

  it("ignores pattern edits when the library is empty", () => {
    const activeId = useAppStore.getState().library.activePatternId!;
    useAppStore.getState().deletePattern(activeId);
    const library = useAppStore.getState().library;

    useAppStore.getState().persistPattern(createBlankPattern(6, 6));

    expect(useAppStore.getState().library).toBe(library);
  });

  it("updates the active pattern through updater functions", () => {
    useAppStore.getState().updateActivePattern((previous) => ({ ...previous, width: 10 }));

    expect(useAppStore.getState().library.patterns[0].pattern.width).toBe(10);
  });

  it("opens another pattern and resets chat", () => {
    useAppStore.getState().addChart(createBlankPattern(2, 2));
    const secondId = useAppStore.getState().library.activePatternId!;
    useAppStore.getState().addChart(createBlankPattern(3, 3));
    const cancel = vi.fn();
    useAppStore.setState({ cancelChat: cancel });

    useAppStore.getState().openPattern(secondId);

    const state = useAppStore.getState();
    expect(state.library.activePatternId).toBe(secondId);
    expect(state.library.patterns).toHaveLength(3);
    expect(cancel).toHaveBeenCalledOnce();
    expect(state.welcomeOpen).toBe(false);
    expect(state.libraryOpen).toBe(false);
  });

  it("deletes the last pattern back to an empty library with welcome", () => {
    const activeId = useAppStore.getState().library.activePatternId!;

    useAppStore.getState().deletePattern(activeId);

    const state = useAppStore.getState();
    expect(state.library.patterns).toHaveLength(0);
    expect(state.library.activePatternId).toBeNull();
    expect(state.welcomeOpen).toBe(true);
  });

  it("moves activation to the first pattern when deleting the active one", () => {
    useAppStore.getState().addChart(createBlankPattern(2, 2));
    const firstId = useAppStore.getState().library.patterns[0].id;
    const secondId = useAppStore.getState().library.patterns[1].id;

    useAppStore.getState().deletePattern(secondId);

    const state = useAppStore.getState();
    expect(state.library.activePatternId).toBe(firstId);
    expect(state.welcomeOpen).toBe(false);
  });

  it("duplicates a pattern with a suffixed title", () => {
    const sourceId = useAppStore.getState().library.patterns[0].id;

    useAppStore.getState().duplicatePattern(sourceId);

    const state = useAppStore.getState();
    expect(state.library.patterns).toHaveLength(2);
    const copy = state.library.patterns[1];
    expect(state.library.activePatternId).toBe(copy.id);
    expect(copy.title).toContain(state.library.patterns[0].title);
    expect(copy.pattern).toEqual(state.library.patterns[0].pattern);
    expect(copy.pattern).not.toBe(state.library.patterns[0].pattern);
  });

  it("ignores duplicating an unknown pattern", () => {
    useAppStore.getState().duplicatePattern("missing");

    expect(useAppStore.getState().library.patterns).toHaveLength(1);
  });

  it("renames a pattern", () => {
    const sourceId = useAppStore.getState().library.patterns[0].id;

    useAppStore.getState().renamePattern(sourceId, "New name");

    expect(useAppStore.getState().library.patterns[0].title).toBe("New name");
  });

  it("saves library changes to localStorage", () => {
    useAppStore.getState().renamePattern(useAppStore.getState().library.patterns[0].id, "Persisted");

    const raw = localStorage.getItem(PATTERN_LIBRARY_STORAGE_KEY);
    expect(raw).not.toBeNull();
    expect(raw!).toContain("Persisted");
  });
});

describe("settings actions", () => {
  it("merges llm field patches without saving", () => {
    useAppStore.getState().updateLlmField({ apiKey: "sk-draft" });

    expect(useAppStore.getState().llm.apiKey).toBe("sk-draft");
    expect(localStorage.getItem(LLM_SETTINGS_STORAGE_KEY)).toBeNull();
  });

  it("saves llm settings and closes the dialog", () => {
    useAppStore.setState({ settingsOpen: true });
    useAppStore.getState().updateLlmField({ apiKey: "sk-saved" });

    useAppStore.getState().saveLlm();

    expect(localStorage.getItem(LLM_SETTINGS_STORAGE_KEY)).toContain("sk-saved");
    expect(useAppStore.getState().settingsOpen).toBe(false);
  });
});

describe("editor actions", () => {
  it("brings the palette forward when unfolding it", () => {
    useAppStore.getState().toggleDesktopPalette();
    expect(useAppStore.getState().desktopSidebarOpen).toBe(false);

    useAppStore.getState().toggleDesktopPalette();
    const state = useAppStore.getState();
    expect(state.desktopSidebarOpen).toBe(true);
    expect(state.frontPanel).toBe("palette");
  });

  it("brings chat forward when unfolding it", () => {
    useAppStore.setState({ frontPanel: "palette" });
    useAppStore.getState().toggleChatPanel();
    expect(useAppStore.getState().chatOpen).toBe(false);

    useAppStore.getState().toggleChatPanel();
    const state = useAppStore.getState();
    expect(state.chatOpen).toBe(true);
    expect(state.frontPanel).toBe("chat");
  });
});

describe("resetAppStore", () => {
  it("restores pristine defaults", () => {
    useAppStore.getState().addChart(createBlankPattern(4, 4));
    const cancel = vi.fn();
    useAppStore.setState({ cancelChat: cancel, zoom: 2, settingsOpen: true });

    resetAppStore();

    const state = useAppStore.getState();
    expect(state.library.patterns).toHaveLength(0);
    expect(cancel).toHaveBeenCalledOnce();
    expect(state.cancelChat).toBeNull();
    expect(state.zoom).toBe(1);
    expect(state.settingsOpen).toBe(false);
    expect(state.welcomeOpen).toBe(true);
    expect(state.hydrated).toBe(false);
  });
});
