"use client";

import { useCallback, useEffect, useMemo, useState, type ReactElement } from "react";
import { createBlankPattern, resizePattern } from "@beadloom/core";
import { defaultPalette } from "@beadloom/palettes";
import { FolderOpen, Settings } from "lucide-react";
import Image from "next/image";
import { useTranslation } from "react-i18next";
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
  patternDownloadBasename,
  triggerBrowserDownload,
  type PatternRecord
} from "@/lib/pattern-storage";
import type { AppStatusMessage } from "./app-status-message";
import { showAppStatusToast } from "./app-status-toast";
import { useAppStore } from "./app-store";
import { ChartChatPanel } from "./chart-chat-panel";
import { ChartSizeGroup } from "./chart-size-group";
import { ChartZoomGroup } from "./chart-zoom-group";
import { DEFAULT_CHART_SIZE, parseChartDimension } from "./chart-size";
import { ChartWelcome } from "./chart-welcome";
import { LanguageSwitcher } from "./language-switcher";
import { selectActivePattern, selectActiveRecord } from "./library-slice";
import { PatternEditorWorkspace } from "./pattern-editor-workspace";
import { PatternLibraryDialog } from "./pattern-library-dialog";

export function BeadloomApp(): ReactElement {
  const { t } = useTranslation();
  const library = useAppStore((state) => state.library);
  const libraryOpen = useAppStore((state) => state.libraryOpen);
  const setLibraryOpen = useAppStore((state) => state.setLibraryOpen);
  const settingsOpen = useAppStore((state) => state.settingsOpen);
  const setSettingsOpen = useAppStore((state) => state.setSettingsOpen);
  const welcomeOpen = useAppStore((state) => state.welcomeOpen);
  const setWelcomeOpen = useAppStore((state) => state.setWelcomeOpen);
  const hydrated = useAppStore((state) => state.hydrated);
  const llm = useAppStore((state) => state.llm);
  const updateLlmField = useAppStore((state) => state.updateLlmField);
  const saveLlm = useAppStore((state) => state.saveLlm);
  const zoom = useAppStore((state) => state.zoom);
  const setZoom = useAppStore((state) => state.setZoom);
  const persistPattern = useAppStore((state) => state.persistPattern);
  const addChart = useAppStore((state) => state.addChart);
  const openPattern = useAppStore((state) => state.openPattern);
  const deletePattern = useAppStore((state) => state.deletePattern);
  const duplicatePattern = useAppStore((state) => state.duplicatePattern);
  const renamePattern = useAppStore((state) => state.renamePattern);
  const addImportedRecord = useAppStore((state) => state.addImportedRecord);
  const activeRecord = useAppStore(selectActiveRecord);
  const pattern = useAppStore(selectActivePattern);
  const [widthDraft, setWidthDraft] = useState(String(DEFAULT_CHART_SIZE));
  const [heightDraft, setHeightDraft] = useState(String(DEFAULT_CHART_SIZE));

  const showWelcome = hydrated && (welcomeOpen || activeRecord === null);
  const showEditor = hydrated && !showWelcome && activeRecord !== null && pattern !== null;

  useEffect(() => {
    useAppStore.getState().hydrateApp();
  }, []);

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

  function handleStartBlank(width: number, height: number): void {
    setZoom(1);
    addChart(createBlankPattern(width, height));
  }

  function handleNewChart(): void {
    setLibraryOpen(false);
    setWelcomeOpen(true);
  }

  function commitSize(): void {
    if (pattern === null) {
      return;
    }
    const width = parseChartDimension(widthDraft);
    const height = parseChartDimension(heightDraft);
    if (width === null || height === null) {
      setWidthDraft(String(pattern.width));
      setHeightDraft(String(pattern.height));
      return;
    }
    if (width === pattern.width && height === pattern.height) {
      return;
    }
    persistPattern(resizePattern(pattern, width, height));
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
          onAppStatus={onAppStatus}
          overlay={<ChartChatPanel />}
        />
      ) : null}
      <PatternLibraryDialog
        activePatternId={library.activePatternId}
        open={libraryOpen}
        patterns={library.patterns}
        onNewChart={handleNewChart}
        onDeletePattern={deletePattern}
        onDuplicatePattern={duplicatePattern}
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
            addImportedRecord(record);
            onAppStatus({ tone: "muted", key: "status.patternImported" });
          } catch {
            onAppStatus({ tone: "accent", key: "status.patternImportInvalid" });
          }
        }}
        onOpenChange={setLibraryOpen}
        onOpenPattern={openPattern}
        onRenamePattern={renamePattern}
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
            <Button type="button" onClick={saveLlm}>
              {t("settings.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </TooltipProvider>
  );
}
