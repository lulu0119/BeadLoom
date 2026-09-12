"use client";

import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import type { ReactElement, ReactNode } from "react";
import { Layers, MessageCircle, Redo2, Undo2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  applyLineToCells,
  buildLegend,
  bucketFillPattern,
  commitPatternEdit,
  deletePatternColor,
  drawPatternLine,
  redoPatternHistory,
  replacePatternColor,
  undoPatternHistory,
  type PatternDocument,
  type PatternPoint
} from "@beadloom/core";
import { defaultPalette } from "@beadloom/palettes";
import {
  cn,
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "@beadloom/ui";
import { type AppStatusMessage } from "./app-status-message";
import { useAppStore } from "./app-store";
import { EditorSidePanels } from "./editor-side-panels";
import { FloatingChromePanel } from "./floating-chrome-panel";
import {
  CHAT_DEFAULT_HEIGHT,
  CHAT_DEFAULT_WIDTH,
  CHAT_MIN_HEIGHT,
  CHAT_MIN_WIDTH,
  PALETTE_DEFAULT_HEIGHT,
  PALETTE_DEFAULT_WIDTH,
  PALETTE_MIN_HEIGHT,
  PALETTE_MIN_WIDTH
} from "./floating-panel-frame";
import {
  canvasPointToPatternPoint,
  clonePattern,
  createCanvasLayout,
  drawPatternCanvas,
  getCanvasCursorClassName,
  getToolIcon,
  type EditorTool
} from "./pattern-editor-utils";

const editorTools: EditorTool[] = ["hand", "pencil", "eraser", "eyedropper", "paintBucket", "line"];
const desktopMinWidthQuery = "(min-width: 768px)";

function subscribeDesktopMinWidth(onStoreChange: () => void): () => void {
  if (typeof window.matchMedia !== "function") {
    return () => undefined;
  }
  const media = window.matchMedia(desktopMinWidthQuery);
  media.addEventListener("change", onStoreChange);
  return () => media.removeEventListener("change", onStoreChange);
}

function desktopMinWidthMatches(): boolean {
  if (typeof window.matchMedia !== "function") {
    return true;
  }
  return window.matchMedia(desktopMinWidthQuery).matches;
}

function useDesktopLayout(): boolean {
  return useSyncExternalStore(subscribeDesktopMinWidth, desktopMinWidthMatches, () => true);
}

function toolRailButtonClassName(pressed = false): string {
  return cn(
    "flex size-10 shrink-0 items-center justify-center rounded-[var(--chrome-inner-radius)] border border-transparent transition focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
    pressed
      ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:text-primary-foreground"
      : "text-foreground hover:bg-accent hover:text-accent-foreground"
  );
}

export type PatternEditorWorkspaceProps = {
  pattern: PatternDocument;
  onAppStatus: (message: AppStatusMessage) => void;
  overlay?: ReactNode;
};

export function PatternEditorWorkspace({
  pattern,
  onAppStatus,
  overlay
}: PatternEditorWorkspaceProps): ReactElement {
  const { t } = useTranslation();
  const isDesktop = useDesktopLayout();
  const zoom = useAppStore((state) => state.zoom);
  const activeTool = useAppStore((state) => state.activeTool);
  const setActiveTool = useAppStore((state) => state.setActiveTool);
  const activeColor = useAppStore((state) => state.activeColor);
  const setActiveColor = useAppStore((state) => state.setActiveColor);
  const strokeOriginRef = useRef<PatternDocument | null>(null);
  const lineStartPoint = useAppStore((state) => state.lineStartPoint);
  const setLineStartPoint = useAppStore((state) => state.setLineStartPoint);
  const linePreviewPoint = useAppStore((state) => state.linePreviewPoint);
  const setLinePreviewPoint = useAppStore((state) => state.setLinePreviewPoint);
  const desktopSidebarOpen = useAppStore((state) => state.desktopSidebarOpen);
  const toggleDesktopPalette = useAppStore((state) => state.toggleDesktopPalette);
  const chatOpen = useAppStore((state) => state.chatOpen);
  const toggleChatPanel = useAppStore((state) => state.toggleChatPanel);
  const frontPanel = useAppStore((state) => state.frontPanel);
  const setFrontPanel = useAppStore((state) => state.setFrontPanel);
  const mobileDrawerOpen = useAppStore((state) => state.mobileDrawerOpen);
  const setMobileDrawerOpen = useAppStore((state) => state.setMobileDrawerOpen);
  const updateActivePattern = useAppStore((state) => state.updateActivePattern);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartScrollRef = useRef<HTMLDivElement>(null);
  const handPanRef = useRef<{ clientX: number; clientY: number; scrollLeft: number; scrollTop: number } | null>(null);
  const chartDragStrokeActiveRef = useRef(false);
  const chartDragStrokeToolRef = useRef<"pencil" | "eraser" | null>(null);
  const chartDragStrokeLastCellRef = useRef<PatternPoint | null>(null);
  const chartDragStrokeLatestRef = useRef<PatternDocument | null>(null);

  const paletteByCode = useMemo(() => new Map(defaultPalette.map((color) => [color.code, color])), []);
  const legend = pattern.legend ?? buildLegend(pattern.cells);
  const canvasLayout = useMemo(() => createCanvasLayout(pattern, zoom), [pattern, zoom]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) {
      return;
    }
    drawPatternCanvas(canvas, pattern, paletteByCode, canvasLayout, lineStartPoint, linePreviewPoint);
  }, [canvasLayout, linePreviewPoint, lineStartPoint, paletteByCode, pattern]);

  function handleCanvasClick(event: React.MouseEvent<HTMLCanvasElement>): void {
    const point = canvasPointToPatternPoint(event.currentTarget, event.clientX, event.clientY, pattern, canvasLayout);
    if (point === null) {
      return;
    }

    if (activeTool === "eyedropper") {
      const index = point.row * pattern.width + point.column;
      const code = pattern.cells[index];
      if (code === null) {
        onAppStatus({ tone: "accent", key: "status.emptyCellEyedropper" });
        return;
      }
      setActiveColor(code);
      return;
    }

    if (activeTool === "paintBucket") {
      updateActivePattern(bucketFillPattern(pattern, point, activeColor));
    }
  }

  function handleCanvasPointerDown(event: React.PointerEvent<HTMLCanvasElement>): void {
    if (activeTool === "hand") {
      const container = chartScrollRef.current;
      if (container !== null) {
        handPanRef.current = {
          clientX: event.clientX,
          clientY: event.clientY,
          scrollLeft: container.scrollLeft,
          scrollTop: container.scrollTop
        };
        event.currentTarget.setPointerCapture(event.pointerId);
      }
      return;
    }

    if (activeTool === "pencil" || activeTool === "eraser") {
      if (event.button !== 0) {
        return;
      }
      const point = canvasPointToPatternPoint(event.currentTarget, event.clientX, event.clientY, pattern, canvasLayout);
      if (point === null) {
        return;
      }
      const strokeTool = activeTool;
      chartDragStrokeActiveRef.current = true;
      chartDragStrokeToolRef.current = strokeTool;
      chartDragStrokeLastCellRef.current = point;
      event.currentTarget.setPointerCapture(event.pointerId);
      const targetCode = strokeTool === "eraser" ? null : activeColor;
      strokeOriginRef.current = clonePattern(pattern);
      updateActivePattern((currentPattern) => {
        const cells = applyLineToCells(currentPattern, point, point, targetCode);
        const next = { ...currentPattern, cells, legend: buildLegend(cells) };
        chartDragStrokeLatestRef.current = next;
        return next;
      });
      return;
    }

    if (activeTool === "line") {
      const point = canvasPointToPatternPoint(event.currentTarget, event.clientX, event.clientY, pattern, canvasLayout);
      setLineStartPoint(point);
      setLinePreviewPoint(point);
    }
  }

  function handleCanvasPointerMove(event: React.PointerEvent<HTMLCanvasElement>): void {
    if (activeTool === "hand") {
      const panState = handPanRef.current;
      const container = chartScrollRef.current;
      if (panState !== null && container !== null) {
        container.scrollLeft = panState.scrollLeft - (event.clientX - panState.clientX);
        container.scrollTop = panState.scrollTop - (event.clientY - panState.clientY);
      }
      return;
    }

    if (activeTool === "line" && lineStartPoint !== null) {
      setLinePreviewPoint(canvasPointToPatternPoint(event.currentTarget, event.clientX, event.clientY, pattern, canvasLayout));
    }

    const strokeTool = chartDragStrokeToolRef.current;
    if (chartDragStrokeActiveRef.current && (strokeTool === "pencil" || strokeTool === "eraser")) {
      const canvas = event.currentTarget;
      const clientX = event.clientX;
      const clientY = event.clientY;
      const targetCode = strokeTool === "eraser" ? null : activeColor;
      updateActivePattern((currentPattern) => {
        const current = canvasPointToPatternPoint(canvas, clientX, clientY, currentPattern, canvasLayout);
        const last = chartDragStrokeLastCellRef.current;
        if (current === null || last === null) {
          return currentPattern;
        }
        if (current.column === last.column && current.row === last.row) {
          return currentPattern;
        }
        const nextCells = applyLineToCells(currentPattern, last, current, targetCode);
        const next = { ...currentPattern, cells: nextCells, legend: buildLegend(nextCells) };
        chartDragStrokeLastCellRef.current = current;
        chartDragStrokeLatestRef.current = next;
        return next;
      });
    }
  }

  function finishChartDragStrokeIfActive(event: React.PointerEvent<HTMLCanvasElement>): void {
    if (!chartDragStrokeActiveRef.current) {
      return;
    }
    chartDragStrokeActiveRef.current = false;
    chartDragStrokeLastCellRef.current = null;
    chartDragStrokeToolRef.current = null;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* pointer capture may already be released */
    }
    const snapshot = chartDragStrokeLatestRef.current;
    const origin = strokeOriginRef.current;
    chartDragStrokeLatestRef.current = null;
    strokeOriginRef.current = null;
    if (snapshot !== null && origin !== undefined && origin !== null) {
      updateActivePattern(commitPatternEdit(origin, snapshot));
    }
  }

  function handleCanvasPointerUp(event: React.PointerEvent<HTMLCanvasElement>): void {
    finishChartDragStrokeIfActive(event);

    if (activeTool === "hand") {
      handPanRef.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
      return;
    }

    if (activeTool === "line" && lineStartPoint !== null && linePreviewPoint !== null) {
      updateActivePattern(drawPatternLine(pattern, lineStartPoint, linePreviewPoint, activeColor));
    }
    setLineStartPoint(null);
    setLinePreviewPoint(null);
  }

  function handleUndo(): void {
    const history = pattern.history;
    if (history === undefined || history.past.length === 0) {
      onAppStatus({ tone: "muted", key: "status.noUndo" });
      return;
    }
    const undone = undoPatternHistory(history);
    updateActivePattern(undone.pattern);
  }

  function handleRedo(): void {
    const history = pattern.history;
    if (history === undefined || history.future.length === 0) {
      onAppStatus({ tone: "muted", key: "status.noRedo" });
      return;
    }
    const redone = redoPatternHistory(history);
    updateActivePattern(redone.pattern);
  }

  const canvasCursorClassName = getCanvasCursorClassName(activeTool);
  const canUndo = (pattern.history?.past.length ?? 0) > 0;
  const canRedo = (pattern.history?.future.length ?? 0) > 0;

  const drawingToolButtons = editorTools.map((tool) => {
    const Icon = getToolIcon(tool);
    const label = t(`workspace.tools.${tool}`);
    return (
      <Tooltip key={tool}>
        <TooltipTrigger
          aria-current={activeTool === tool ? "true" : undefined}
          aria-label={label}
          className={toolRailButtonClassName(activeTool === tool)}
          type="button"
          onClick={() => setActiveTool(tool)}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </TooltipTrigger>
        <TooltipContent side="right" align="center">
          {label}
        </TooltipContent>
      </Tooltip>
    );
  });

  const sidePanelContent = (
    <EditorSidePanels
      activeColor={activeColor}
      legend={legend}
      paletteByCode={paletteByCode}
      onActiveColorChange={setActiveColor}
      onApplyDelete={(fromCode) => updateActivePattern(deletePatternColor(pattern, fromCode))}
      onApplyReplace={(fromCode) => updateActivePattern(replacePatternColor(pattern, fromCode, activeColor))}
      showPaletteHeading={!isDesktop}
    />
  );

  return (
    <TooltipProvider>
      <div className="absolute inset-0 min-h-0 min-w-0">
        <div
            ref={chartScrollRef}
            className="absolute inset-0 overflow-auto overscroll-contain p-[var(--chrome-inset)] pt-[var(--chrome-below-header)] pb-28 md:pl-[calc(var(--chrome-inset)+2.5rem+var(--chrome-pad)*2+var(--chrome-gap))] md:pb-[var(--chrome-inset)]"
          >
            <div
              className="bg-background overflow-hidden rounded-[var(--chrome-radius)] shadow-sm"
              style={{ width: canvasLayout.width, height: canvasLayout.height }}
            >
              <canvas
                aria-label={t("workspace.editableBeadPattern")}
                className={cn("block max-md:touch-none", canvasCursorClassName)}
                ref={canvasRef}
                style={{ width: canvasLayout.width, height: canvasLayout.height }}
                onClick={handleCanvasClick}
                onPointerDown={handleCanvasPointerDown}
                onPointerMove={handleCanvasPointerMove}
                onPointerCancel={finishChartDragStrokeIfActive}
                onPointerUp={handleCanvasPointerUp}
                onLostPointerCapture={finishChartDragStrokeIfActive}
              />
            </div>
          </div>

          <aside
            aria-label={t("workspace.editorToolsAside")}
            className="glass-panel absolute top-[var(--chrome-below-header)] left-[var(--chrome-inset)] z-10 flex max-h-[calc(100%-var(--chrome-below-header)-var(--chrome-inset))] flex-col items-center gap-1 overflow-y-auto rounded-[var(--chrome-radius)] p-[var(--chrome-pad)]"
          >
            {drawingToolButtons}
            <div className="bg-border/80 my-1 h-px w-8 shrink-0" role="presentation" />
            <Tooltip>
              <TooltipTrigger
                aria-label={t("sidePanels.undo")}
                className={toolRailButtonClassName()}
                disabled={!canUndo}
                type="button"
                onClick={handleUndo}
              >
                <Undo2 className="h-5 w-5" aria-hidden="true" />
              </TooltipTrigger>
              <TooltipContent side="right" align="center">
                {t("sidePanels.undoTooltip")}
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                aria-label={t("sidePanels.redo")}
                className={toolRailButtonClassName()}
                disabled={!canRedo}
                type="button"
                onClick={handleRedo}
              >
                <Redo2 className="h-5 w-5" aria-hidden="true" />
              </TooltipTrigger>
              <TooltipContent side="right" align="center">
                {t("sidePanels.redoTooltip")}
              </TooltipContent>
            </Tooltip>
            <div className="bg-border/80 my-1 h-px w-8 shrink-0" role="presentation" />
            <Tooltip>
              <TooltipTrigger
                aria-expanded={isDesktop ? desktopSidebarOpen : mobileDrawerOpen}
                aria-haspopup={isDesktop ? undefined : "dialog"}
                aria-label={isDesktop && desktopSidebarOpen ? t("workspace.dismissPalette") : t("workspace.openPalette")}
                className={toolRailButtonClassName(isDesktop ? desktopSidebarOpen : mobileDrawerOpen)}
                type="button"
                onClick={() => {
                  if (isDesktop) {
                    toggleDesktopPalette();
                    return;
                  }
                  setMobileDrawerOpen(true);
                }}
              >
                <Layers className="h-5 w-5" aria-hidden="true" />
              </TooltipTrigger>
              <TooltipContent side="right" align="center">
                {isDesktop && desktopSidebarOpen ? t("workspace.dismissPalette") : t("workspace.openPaletteTooltip")}
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                aria-expanded={chatOpen}
                aria-label={chatOpen ? t("chat.hidePanel") : t("chat.showPanel")}
                className={toolRailButtonClassName(chatOpen)}
                type="button"
                onClick={toggleChatPanel}
              >
                <MessageCircle className="h-5 w-5" aria-hidden="true" />
              </TooltipTrigger>
              <TooltipContent side="right" align="center">
                {chatOpen ? t("chat.hidePanel") : t("chat.showPanel")}
              </TooltipContent>
            </Tooltip>
          </aside>
          <div className="pointer-events-none absolute inset-0 z-20">
            {isDesktop && desktopSidebarOpen ? (
              <FloatingChromePanel
                ariaLabel={t("workspace.paletteAside")}
                className={frontPanel === "palette" ? "z-20" : "z-10"}
                defaultAnchor="top-right"
                defaultHeight={PALETTE_DEFAULT_HEIGHT}
                defaultWidth={PALETTE_DEFAULT_WIDTH}
                minHeight={PALETTE_MIN_HEIGHT}
                minWidth={PALETTE_MIN_WIDTH}
                title={t("workspace.paletteAside")}
                onActivate={() => setFrontPanel("palette")}
              >
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-[var(--chrome-gap)] pt-0">
                  {sidePanelContent}
                </div>
              </FloatingChromePanel>
            ) : null}
            {chatOpen && overlay !== undefined ? (
              <FloatingChromePanel
                ariaLabel={t("chat.messages")}
                className={frontPanel === "chat" ? "z-20" : "z-10"}
                defaultAnchor="bottom-right"
                defaultHeight={CHAT_DEFAULT_HEIGHT}
                defaultWidth={CHAT_DEFAULT_WIDTH}
                minHeight={CHAT_MIN_HEIGHT}
                minWidth={CHAT_MIN_WIDTH}
                title={t("chat.emptyHint")}
                onActivate={() => setFrontPanel("chat")}
              >
                {overlay}
              </FloatingChromePanel>
            ) : null}
          </div>

        <Drawer open={mobileDrawerOpen} onOpenChange={setMobileDrawerOpen} repositionInputs={false}>
          <DrawerContent className="glass-panel gap-0 border-0 p-0 md:hidden">
            <DrawerTitle className="sr-only">{t("workspace.paletteDialog")}</DrawerTitle>
            <DrawerDescription className="sr-only">{t("workspace.openPaletteTooltip")}</DrawerDescription>
            <div className="flex min-h-0 max-h-[min(78dvh,calc(100dvh-4rem))] flex-1 flex-col overflow-y-auto overscroll-contain p-[var(--chrome-gap)] pb-[max(0.5rem,env(safe-area-inset-bottom,0px))]">
              {sidePanelContent}
            </div>
          </DrawerContent>
        </Drawer>
      </div>
    </TooltipProvider>
  );
}
