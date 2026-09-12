import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import type { PatternPoint } from "@beadloom/core";
import {
  loadPatternLibraryFromLocalStorage,
  savePatternLibraryToLocalStorage
} from "@/lib/pattern-storage";
import { clearPendingPrompt } from "./agent-debug-log";
import { createChatSlice, initialChatState, type ChatSlice } from "./chat-slice";
import {
  createLibrarySlice,
  emptyLibrary,
  initialLibraryState,
  type LibrarySlice
} from "./library-slice";
import {
  defaultLlmSettings,
  loadLlmSettings,
  saveLlmSettings,
  type LlmSettings
} from "./llm-settings";
import type { EditorTool } from "./pattern-editor-utils";

export type AppStoreState = LibrarySlice &
  ChatSlice & {
    zoom: number;
    activeTool: EditorTool;
    activeColor: string;
    lineStartPoint: PatternPoint | null;
    linePreviewPoint: PatternPoint | null;
    desktopSidebarOpen: boolean;
    chatOpen: boolean;
    frontPanel: "chat" | "palette";
    mobileDrawerOpen: boolean;
    llm: LlmSettings;
    libraryOpen: boolean;
    settingsOpen: boolean;
    welcomeOpen: boolean;
    hydrated: boolean;
    setZoom: (zoom: number) => void;
    setActiveTool: (tool: EditorTool) => void;
    setActiveColor: (color: string) => void;
    setLineStartPoint: (point: PatternPoint | null) => void;
    setLinePreviewPoint: (point: PatternPoint | null) => void;
    toggleDesktopPalette: () => void;
    setMobileDrawerOpen: (open: boolean) => void;
    toggleChatPanel: () => void;
    setFrontPanel: (panel: "chat" | "palette") => void;
    updateLlmField: (patch: Partial<LlmSettings>) => void;
    saveLlm: () => void;
    setLibraryOpen: (open: boolean) => void;
    setSettingsOpen: (open: boolean) => void;
    setWelcomeOpen: (open: boolean) => void;
    hydrateApp: () => void;
  };

function initialChromeState(): Pick<
  AppStoreState,
  | "zoom"
  | "activeTool"
  | "activeColor"
  | "lineStartPoint"
  | "linePreviewPoint"
  | "desktopSidebarOpen"
  | "chatOpen"
  | "frontPanel"
  | "mobileDrawerOpen"
  | "llm"
  | "libraryOpen"
  | "settingsOpen"
  | "welcomeOpen"
  | "hydrated"
> {
  return {
    zoom: 1,
    activeTool: "hand",
    activeColor: "H7",
    lineStartPoint: null,
    linePreviewPoint: null,
    desktopSidebarOpen: true,
    chatOpen: true,
    frontPanel: "chat",
    mobileDrawerOpen: false,
    llm: { ...defaultLlmSettings },
    libraryOpen: false,
    settingsOpen: false,
    welcomeOpen: true,
    hydrated: false
  };
}

export const useAppStore = create<AppStoreState>()(
  subscribeWithSelector((set, get, api) => ({
    ...createLibrarySlice(set, get, api),
    ...createChatSlice(set, get, api),
    ...initialChromeState(),
    setZoom: (zoom) => {
      set({ zoom });
    },
    setActiveTool: (tool) => {
      set({ activeTool: tool });
    },
    setActiveColor: (color) => {
      set({ activeColor: color });
    },
    setLineStartPoint: (point) => {
      set({ lineStartPoint: point });
    },
    setLinePreviewPoint: (point) => {
      set({ linePreviewPoint: point });
    },
    toggleDesktopPalette: () => {
      if (get().desktopSidebarOpen) {
        set({ desktopSidebarOpen: false });
        return;
      }
      set({ desktopSidebarOpen: true, frontPanel: "palette" });
    },
    setMobileDrawerOpen: (open) => {
      set({ mobileDrawerOpen: open });
    },
    toggleChatPanel: () => {
      if (get().chatOpen) {
        set({ chatOpen: false });
        return;
      }
      set({ chatOpen: true, frontPanel: "chat" });
    },
    setFrontPanel: (panel) => {
      set({ frontPanel: panel });
    },
    updateLlmField: (patch) => {
      set((state) => ({ llm: { ...state.llm, ...patch } }));
    },
    saveLlm: () => {
      saveLlmSettings(get().llm);
      get().disposeAgent();
      set({ settingsOpen: false });
    },
    setLibraryOpen: (open) => {
      set({ libraryOpen: open });
    },
    setSettingsOpen: (open) => {
      set({ settingsOpen: open });
    },
    setWelcomeOpen: (open) => {
      set({ welcomeOpen: open });
    },
    hydrateApp: () => {
      const llm = loadLlmSettings();
      const stored = loadPatternLibraryFromLocalStorage();
      if (stored === null) {
        const library = emptyLibrary();
        savePatternLibraryToLocalStorage(library);
        set({ hydrated: true, llm, library, welcomeOpen: true });
        return;
      }
      set({ hydrated: true, llm, library: stored, welcomeOpen: stored.patterns.length === 0 });
    }
  }))
);

if (typeof window !== "undefined") {
  useAppStore.subscribe(
    (state) => state.library,
    (library) => {
      try {
        savePatternLibraryToLocalStorage(library);
      } catch {
        // Storage can fail when unavailable or full; the in-memory library stays usable.
      }
    }
  );
}

export function resetAppStore(): void {
  clearPendingPrompt();
  useAppStore.setState({
    ...initialLibraryState(),
    ...initialChatState(),
    ...initialChromeState()
  });
}
