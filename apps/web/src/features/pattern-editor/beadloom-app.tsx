"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { createBlankPattern, resizePattern, type PatternDocument } from "@beadloom/core";
import { defaultPalette } from "@beadloom/palettes";
import { FolderOpen, Settings } from "lucide-react";
import Image from "next/image";
import { useTranslation } from "react-i18next";
import { user, type Agent } from "@apeira/core";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldLabel,
  Input,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "@beadloom/ui";
import { publicPath } from "../../../base-path";
import { renderPatternExportToPngBlob } from "@/lib/pattern-export-image";
import {
  createPatternRecordId,
  exportPatternRecordToJson,
  importPatternRecordFromExportJson,
  loadPatternLibraryFromLocalStorage,
  patternDownloadBasename,
  savePatternLibraryToLocalStorage,
  triggerBrowserDownload,
  type PatternLibraryDocument,
  type PatternRecord
} from "@/lib/pattern-storage";
import type { AppStatusMessage } from "./app-status-message";
import { showAppStatusToast } from "./app-status-toast";
import { createChartAgent, consumeAgentRun } from "./chart-agent";
import { ChartChatPanel, type ChatLine } from "./chart-chat-panel";
import { ChartSizeGroup } from "./chart-size-group";
import { ChartZoomGroup } from "./chart-zoom-group";
import { DEFAULT_CHART_SIZE, parseChartDimension } from "./chart-size";
import { ChartWelcome } from "./chart-welcome";
import { LanguageSwitcher } from "./language-switcher";
import { defaultLlmSettings, loadLlmSettings, saveLlmSettings, type LlmSettings } from "./llm-settings";
import { PatternEditorWorkspace } from "./pattern-editor-workspace";
import { PatternLibraryDialog } from "./pattern-library-dialog";
import { clonePattern } from "./pattern-editor-utils";

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

function emptyLibrary(): PatternLibraryDocument {
  return {
    version: 1,
    activePatternId: null,
    patterns: []
  };
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("Could not read image."));
    };
    reader.onerror = () => reject(new Error("Could not read image."));
    reader.readAsDataURL(file);
  });
}

function isBrowserBlockedFetch(error: Error): boolean {
  return (
    error.name === "TypeError" &&
    (error.message === "Load failed" ||
      error.message === "Failed to fetch" ||
      error.message === "NetworkError when attempting to fetch resource.")
  );
}

function agentFailureText(error: unknown, corsMessage: string, fallback: string): string {
  if (error instanceof Error && isBrowserBlockedFetch(error)) {
    return corsMessage;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return fallback;
}

export function BeadloomApp(): ReactElement {
  const { t } = useTranslation();
  const [library, setLibrary] = useState<PatternLibraryDocument>(emptyLibrary);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [welcomeOpen, setWelcomeOpen] = useState(true);
  const [llm, setLlm] = useState<LlmSettings>(defaultLlmSettings);
  const [widthDraft, setWidthDraft] = useState(String(DEFAULT_CHART_SIZE));
  const [heightDraft, setHeightDraft] = useState(String(DEFAULT_CHART_SIZE));
  const [chatLines, setChatLines] = useState<ChatLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [attached, setAttached] = useState<File | null>(null);
  const [zoom, setZoom] = useState(1);
  const [hydrated, setHydrated] = useState(false);
  const agentRef = useRef<Agent | null>(null);
  const patternRef = useRef<PatternDocument>(createBlankPattern(DEFAULT_CHART_SIZE, DEFAULT_CHART_SIZE));
  const activeIdRef = useRef("");
  const persistPatternRef = useRef<(next: PatternDocument) => void>(() => undefined);
  const llmRef = useRef(llm);

  const activeRecord = library.patterns.find((record) => record.id === library.activePatternId) ?? library.patterns[0] ?? null;
  const pattern = activeRecord?.pattern ?? null;
  const activeChartId = activeRecord?.id;
  llmRef.current = llm;
  const showWelcome = hydrated && (welcomeOpen || activeRecord === null);
  const showEditor = hydrated && !showWelcome && activeRecord !== null && pattern !== null;

  useEffect(() => {
    setHydrated(true);
    setLlm(loadLlmSettings());
    const stored = loadPatternLibraryFromLocalStorage();
    if (stored !== null && stored.patterns.length > 0) {
      setLibrary(stored);
      setWelcomeOpen(false);
      return;
    }
    if (stored !== null) {
      setLibrary(stored);
      setWelcomeOpen(true);
      return;
    }
    const empty = emptyLibrary();
    savePatternLibraryToLocalStorage(empty);
    setLibrary(empty);
    setWelcomeOpen(true);
  }, []);

  useEffect(() => {
    if (activeRecord === null || activeChartId === undefined) {
      return;
    }
    patternRef.current = activeRecord.pattern;
    activeIdRef.current = activeChartId;
  }, [activeChartId]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    savePatternLibraryToLocalStorage(library);
  }, [hydrated, library]);

  const patternWidth = pattern?.width;
  const patternHeight = pattern?.height;

  useEffect(() => {
    if (patternWidth === undefined || patternHeight === undefined) {
      return;
    }
    setWidthDraft(String(patternWidth));
    setHeightDraft(String(patternHeight));
  }, [patternHeight, patternWidth]);

  const paletteMapForExport = useMemo(() => new Map(defaultPalette.map((color) => [color.code, color])), []);

  function persistPattern(next: PatternDocument): void {
    const chartId = activeIdRef.current;
    patternRef.current = next;
    setLibrary((current) => {
      const matchedId =
        chartId !== "" && current.patterns.some((record) => record.id === chartId)
          ? chartId
          : (current.activePatternId ?? current.patterns[0]?.id ?? "");
      const matched = matchedId !== "" && current.patterns.some((record) => record.id === matchedId);
      if (!matched) {
        return current;
      }
      return {
        ...current,
        patterns: current.patterns.map((record) =>
          record.id === matchedId ? { ...record, pattern: next, updatedAt: new Date().toISOString() } : record
        )
      };
    });
  }

  function updateLlmField(patch: Partial<LlmSettings>): void {
    setLlm((current) => ({ ...current, ...patch }));
  }

  function handlePatternChange(next: PatternDocument | ((previous: PatternDocument) => PatternDocument)): void {
    const resolved = typeof next === "function" ? next(patternRef.current) : next;
    persistPattern(resolved);
  }

  persistPatternRef.current = persistPattern;

  async function ensureAgent(): Promise<Agent> {
    if (agentRef.current !== null) {
      return agentRef.current;
    }
    const agent = await createChartAgent({
      getPattern: () => patternRef.current,
      commitPattern: (next) => {
        persistPatternRef.current(next);
      },
      llm: llmRef.current
    });
    await agent.init();
    agentRef.current = agent;
    return agent;
  }

  async function handleSend(text: string, imageFile: File | null = attached): Promise<void> {
    if (llm.apiKey.trim() === "") {
      setSettingsOpen(true);
      return;
    }
    const trimmed = text.trim();
    const prompt = trimmed === "" ? t("chat.drawThis") : trimmed;
    setAttached(null);
    setChatLines((current) => [...current, { id: createPatternRecordId(), role: "user", text: prompt }]);
    setBusy(true);
    const assistantId = createPatternRecordId();
    setChatLines((current) => [...current, { id: assistantId, role: "assistant", text: "" }]);
    try {
      const agent = await ensureAgent();
      const imageUrl = imageFile === null ? null : await fileToDataUrl(imageFile);
      const input =
        imageUrl === null
          ? user(prompt)
          : {
              role: "user" as const,
              type: "message" as const,
              content: [
                { type: "input_text" as const, text: prompt },
                { type: "input_image" as const, image_url: imageUrl }
              ]
            };
      await consumeAgentRun(agent, input, (event) => {
        if (event.type === "text.delta" && "delta" in event && typeof event.delta === "string") {
          setChatLines((current) =>
            current.map((line) => (line.id === assistantId ? { ...line, text: `${line.text}${event.delta}` } : line))
          );
        }
        if (event.type === "tool-call.start" && "toolName" in event && typeof event.toolName === "string") {
          setChatLines((current) => [...current, { id: createPatternRecordId(), role: "tool", text: event.toolName }]);
        }
        if (event.type === "turn.failed") {
          const message = agentFailureText(event.error, t("chat.corsBlocked"), t("chat.turnFailed"));
          setChatLines((current) =>
            current.map((line) => (line.id === assistantId ? { ...line, text: message } : line))
          );
        }
      });
    } catch (error) {
      const message = agentFailureText(error, t("chat.corsBlocked"), t("chat.turnFailed"));
      setChatLines((current) => [...current, { id: createPatternRecordId(), role: "assistant", text: message }]);
    } finally {
      setBusy(false);
    }
  }

  function handleInterrupt(): void {
    void agentRef.current?.interrupt("user interrupted");
    setBusy(false);
  }

  function resetChatSession(): void {
    agentRef.current = null;
    setChatLines([]);
    setAttached(null);
  }

  function addChart(nextPattern: PatternDocument): void {
    const record = createRecord(nextPattern, t("library.defaultTitle"));
    patternRef.current = nextPattern;
    activeIdRef.current = record.id;
    resetChatSession();
    setLibrary((current) => ({
      version: 1,
      activePatternId: record.id,
      patterns: [...current.patterns, record]
    }));
    setWelcomeOpen(false);
  }

  function handleStartBlank(width: number, height: number): void {
    setZoom(1);
    addChart(createBlankPattern(width, height));
  }

  function handleNewChart(): void {
    setLibraryOpen(false);
    setWelcomeOpen(true);
  }

  function commitSize(): void {
    const width = parseChartDimension(widthDraft);
    const height = parseChartDimension(heightDraft);
    if (width === null || height === null) {
      setWidthDraft(String(patternRef.current.width));
      setHeightDraft(String(patternRef.current.height));
      return;
    }
    if (width === patternRef.current.width && height === patternRef.current.height) {
      return;
    }
    persistPattern(resizePattern(patternRef.current, width, height));
  }

  const onAppStatus = useCallback((message: AppStatusMessage) => {
    showAppStatusToast(t, message);
  }, [t]);

  async function handleExportPng(record: PatternRecord): Promise<void> {
    try {
      const blob = await renderPatternExportToPngBlob(record.pattern, paletteMapForExport, {
        siteTitle: t("meta.title"),
        siteUrl: "https://beadloom.app",
        siteDescription: t("meta.description"),
        logoSrc: publicPath("/android-chrome-192x192.png")
      });
      triggerBrowserDownload(blob, `${patternDownloadBasename(record.title)}.png`);
    } catch {
      onAppStatus({ tone: "accent", key: "status.exportPngFailed" });
    }
  }

  return (
    <TooltipProvider>
      <div className="relative min-h-0 flex-1 overflow-hidden">
      <header className="pointer-events-none absolute inset-x-0 top-0 z-30 p-[var(--chrome-inset)]">
        <div className="glass-panel pointer-events-auto flex h-12 items-center justify-between gap-3 rounded-[var(--chrome-radius)] px-3">
          <div className="flex min-w-0 items-center gap-2">
            <Image alt={t("header.logoAlt")} height={28} src={publicPath("/android-chrome-192x192.png")} width={28} />
            <h1 className="shrink-0 text-base font-semibold tracking-tight">{t("meta.title")}</h1>
          </div>
          <div className="flex h-8 min-w-0 shrink-0 items-center gap-1">
            {showEditor ? (
              <>
                <ChartSizeGroup
                  groupLabel={t("sizeChip.aria")}
                  heightLabel={t("sizeChip.height")}
                  heightValue={heightDraft}
                  widthLabel={t("sizeChip.width")}
                  widthValue={widthDraft}
                  onCommit={commitSize}
                  onHeightChange={setHeightDraft}
                  onWidthChange={setWidthDraft}
                />
                <ChartZoomGroup zoom={zoom} onZoomChange={setZoom} />
              </>
            ) : null}
            <Tooltip>
              <TooltipTrigger
                aria-label={t("header.openLibrary")}
                className="hover:bg-accent hover:text-accent-foreground inline-flex size-8 items-center justify-center rounded-lg text-foreground transition focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                type="button"
                onClick={() => setLibraryOpen(true)}
              >
                <FolderOpen className="size-4" />
              </TooltipTrigger>
              <TooltipContent side="bottom">{t("header.openLibrary")}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                aria-label={t("settings.open")}
                className="hover:bg-accent hover:text-accent-foreground inline-flex size-8 items-center justify-center rounded-lg text-foreground transition focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                type="button"
                onClick={() => setSettingsOpen(true)}
              >
                <Settings className="size-4" />
              </TooltipTrigger>
              <TooltipContent side="bottom">{t("settings.open")}</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </header>
      {showWelcome ? (
        <ChartWelcome
          canCancel={activeRecord !== null}
          onCancel={() => setWelcomeOpen(false)}
          onStartBlank={handleStartBlank}
        />
      ) : null}
      {showEditor && pattern !== null && activeRecord !== null ? (
        <PatternEditorWorkspace
          pattern={pattern}
          zoom={zoom}
          onAppStatus={onAppStatus}
          onPatternChange={handlePatternChange}
          overlay={
            <ChartChatPanel
              attachedName={attached?.name ?? null}
              busy={busy}
              hasApiKey={llm.apiKey.trim() !== ""}
              lines={chatLines}
              onAttachFile={setAttached}
              onClearAttach={() => setAttached(null)}
              onInterrupt={handleInterrupt}
              onOpenSettings={() => setSettingsOpen(true)}
              onSend={(text) => {
                void handleSend(text);
              }}
            />
          }
        />
      ) : null}
      <PatternLibraryDialog
        activePatternId={library.activePatternId}
        open={libraryOpen}
        patterns={library.patterns}
        onNewChart={handleNewChart}
        onDeletePattern={(patternId) => {
          setLibrary((current) => {
            const patterns = current.patterns.filter((record) => record.id !== patternId);
            if (patterns.length === 0) {
              setWelcomeOpen(true);
              return emptyLibrary();
            }
            return {
              version: 1,
              activePatternId: current.activePatternId === patternId ? (patterns[0]?.id ?? null) : current.activePatternId,
              patterns
            };
          });
        }}
        onDuplicatePattern={(patternId) => {
          const source = library.patterns.find((record) => record.id === patternId);
          if (source === undefined) {
            return;
          }
          const copy = createRecord(clonePattern(source.pattern), `${source.title} ${t("library.duplicatedTitleSuffix")}`);
          setLibrary((current) => ({
            ...current,
            activePatternId: copy.id,
            patterns: [...current.patterns, copy]
          }));
          setWelcomeOpen(false);
        }}
        onExportJson={(patternId) => {
          const record = library.patterns.find((entry) => entry.id === patternId);
          if (record === undefined) {
            return;
          }
          const json = exportPatternRecordToJson(record);
          triggerBrowserDownload(new Blob([json], { type: "application/json" }), `${patternDownloadBasename(record.title)}.json`);
        }}
        onExportPng={(patternId) => {
          const record = library.patterns.find((entry) => entry.id === patternId);
          if (record !== undefined) {
            void handleExportPng(record);
          }
        }}
        onImportJsonFile={async (file) => {
          try {
            const json = await file.text();
            const record = importPatternRecordFromExportJson(json, createPatternRecordId);
            setLibrary((current) => ({
              version: 1,
              activePatternId: record.id,
              patterns: [...current.patterns, record]
            }));
            setWelcomeOpen(false);
            onAppStatus({ tone: "muted", key: "status.patternImported" });
          } catch {
            onAppStatus({ tone: "accent", key: "status.patternImportInvalid" });
          }
        }}
        onOpenChange={setLibraryOpen}
        onOpenPattern={(patternId) => {
          resetChatSession();
          setLibrary((current) => ({ ...current, activePatternId: patternId }));
          setWelcomeOpen(false);
          setLibraryOpen(false);
        }}
        onRenamePattern={(patternId, title) => {
          setLibrary((current) => ({
            ...current,
            patterns: current.patterns.map((record) => (record.id === patternId ? { ...record, title } : record))
          }));
        }}
      />
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent closeLabel={t("dialog.close")}>
          <DialogHeader>
            <DialogTitle>{t("settings.title")}</DialogTitle>
            <DialogDescription>{t("settings.description")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-5">
            <section className="grid gap-2">
              <h3 className="text-sm font-medium">{t("settings.language")}</h3>
              <LanguageSwitcher />
            </section>
            <section className="grid gap-3 border-t border-primary/10 pt-4">
              <div className="grid gap-1">
                <h3 className="text-sm font-medium">{t("settings.agent")}</h3>
                <p className="text-muted-foreground text-sm">{t("settings.agentDescription")}</p>
              </div>
              <Field>
                <FieldLabel htmlFor="llm-base">{t("settings.baseURL")}</FieldLabel>
                <Input
                  id="llm-base"
                  value={llm.baseURL}
                  onChange={(event) => updateLlmField({ baseURL: event.currentTarget.value })}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="llm-model">{t("settings.model")}</FieldLabel>
                <Input
                  id="llm-model"
                  value={llm.model}
                  onChange={(event) => updateLlmField({ model: event.currentTarget.value })}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="llm-key">{t("settings.apiKey")}</FieldLabel>
                <Input
                  id="llm-key"
                  type="password"
                  value={llm.apiKey}
                  onChange={(event) => updateLlmField({ apiKey: event.currentTarget.value })}
                />
              </Field>
            </section>
          </div>
          <DialogFooter>
            <Button
              type="button"
              onClick={() => {
                saveLlmSettings(llm);
                agentRef.current = null;
                setSettingsOpen(false);
              }}
            >
              {t("settings.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </TooltipProvider>
  );
}
