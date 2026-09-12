import type { LucideIcon } from "lucide-react";
import { Eraser, Hand, Minus, PaintBucket, Pencil, Pipette } from "lucide-react";
import { readableTextHexOnBackgroundHex, type PatternDocument, type PatternPoint } from "@beadloom/core";
import { majorGridLineCellIndices } from "@/lib/major-grid-line-indices";

export type EditorTool = "pencil" | "eraser" | "eyedropper" | "paintBucket" | "hand" | "line";

export type CanvasLayout = {
  cellSize: number;
  headerSize: number;
  width: number;
  height: number;
};

export const CHART_ZOOM_STEPS: readonly number[] = [0.5, 0.75, 1, 1.25, 1.5, 2];
const baseCellSize = 28;
const baseHeaderSize = 32;

const PATTERN_CANVAS_MONO_FONT_FAMILY = "ui-monospace, SFMono-Regular, Menlo, monospace";
const PATTERN_CANVAS_BEAD_CODE_FONT_CELL_FRACTION = 0.42;
const PATTERN_CANVAS_AXIS_LABEL_FONT_CELL_FRACTION = 0.32;
const PATTERN_CANVAS_HIDE_BEAD_CODES_WHEN_CELL_BELOW_PX = 10;
const PATTERN_CANVAS_MAJOR_GRID_STEP = 5;

export function readThemeColor(cssVariable: `--${string}`): string {
  if (typeof document === "undefined") {
    return `var(${cssVariable})`;
  }
  const value = getComputedStyle(document.documentElement).getPropertyValue(cssVariable).trim();
  return value === "" ? `var(${cssVariable})` : value;
}

export function clonePattern(pattern: PatternDocument): PatternDocument {
  return {
    version: pattern.version,
    width: pattern.width,
    height: pattern.height,
    cells: [...pattern.cells],
    legend: pattern.legend === undefined ? undefined : pattern.legend.map((item) => ({ ...item })),
    history: pattern.history === undefined
      ? undefined
      : {
          past: pattern.history.past.map((snapshot) => ({
            ...snapshot,
            cells: [...snapshot.cells],
            legend: snapshot.legend === undefined ? undefined : snapshot.legend.map((item) => ({ ...item }))
          })),
          present: {
            ...pattern.history.present,
            cells: [...pattern.history.present.cells],
            legend:
              pattern.history.present.legend === undefined
                ? undefined
                : pattern.history.present.legend.map((item) => ({ ...item }))
          },
          future: pattern.history.future.map((snapshot) => ({
            ...snapshot,
            cells: [...snapshot.cells],
            legend: snapshot.legend === undefined ? undefined : snapshot.legend.map((item) => ({ ...item }))
          }))
        }
  };
}

const toolIcons: Record<EditorTool, LucideIcon> = {
  pencil: Pencil,
  eraser: Eraser,
  eyedropper: Pipette,
  paintBucket: PaintBucket,
  hand: Hand,
  line: Minus
};

export function getToolIcon(tool: EditorTool): LucideIcon {
  return toolIcons[tool];
}

export function getCanvasCursorClassName(activeTool: EditorTool): string {
  return activeTool === "hand" ? "cursor-grab" : "cursor-crosshair";
}

export function clampZoom(value: number): number {
  return Math.min(3, Math.max(0.5, Math.round(value * 10) / 10));
}

export function snapZoomToChartStep(value: number): number {
  const clamped = clampZoom(value);
  let closest = CHART_ZOOM_STEPS[0]!;
  let closestAbs = Math.abs(clamped - closest);
  for (const step of CHART_ZOOM_STEPS) {
    const abs = Math.abs(clamped - step);
    if (abs < closestAbs) {
      closestAbs = abs;
      closest = step;
    }
  }
  return closest;
}

export function stepChartZoom(current: number, direction: -1 | 1): number {
  const normalized = snapZoomToChartStep(current);
  const index = CHART_ZOOM_STEPS.indexOf(normalized);
  const safeIndex = index === -1 ? 0 : index;
  const nextIndex = safeIndex + direction;
  if (nextIndex < 0 || nextIndex >= CHART_ZOOM_STEPS.length) {
    return normalized;
  }
  return CHART_ZOOM_STEPS[nextIndex]!;
}

export function createCanvasLayout(pattern: PatternDocument, zoom: number): CanvasLayout {
  const cellSize = Math.max(12, Math.round(baseCellSize * zoom));
  const headerSize = Math.max(24, Math.round(baseHeaderSize * zoom));
  return {
    cellSize,
    headerSize,
    width: pattern.width * cellSize + headerSize * 2,
    height: pattern.height * cellSize + headerSize * 2
  };
}

function pointCenter(point: PatternPoint, layout: CanvasLayout): { x: number; y: number } {
  return {
    x: layout.headerSize + point.column * layout.cellSize + layout.cellSize / 2,
    y: layout.headerSize + point.row * layout.cellSize + layout.cellSize / 2
  };
}

function devicePixelRatioScale(): number {
  if (typeof window === "undefined") {
    return 1;
  }
  const ratio = window.devicePixelRatio;
  if (typeof ratio !== "number" || !Number.isFinite(ratio) || ratio < 1) {
    return 1;
  }
  return ratio;
}

function syncPatternCanvasBitmap(canvas: HTMLCanvasElement, layout: CanvasLayout, ratio: number): void {
  const pixelWidth = Math.round(layout.width * ratio);
  const pixelHeight = Math.round(layout.height * ratio);
  if (canvas.width !== pixelWidth) {
    canvas.width = pixelWidth;
  }
  if (canvas.height !== pixelHeight) {
    canvas.height = pixelHeight;
  }
  canvas.style.width = `${layout.width}px`;
  canvas.style.height = `${layout.height}px`;
}

function drawOuterMajorLines(context: CanvasRenderingContext2D, pattern: PatternDocument, layout: CanvasLayout): void {
  context.strokeStyle = readThemeColor("--primary");
  context.lineWidth = 2;

  function strokeVerticalLine(atColumnIndex: number): void {
    const x = layout.headerSize + atColumnIndex * layout.cellSize;
    context.beginPath();
    context.moveTo(x, layout.headerSize);
    context.lineTo(x, layout.headerSize + pattern.height * layout.cellSize);
    context.stroke();
  }

  function strokeHorizontalLine(atRowIndex: number): void {
    const y = layout.headerSize + atRowIndex * layout.cellSize;
    context.beginPath();
    context.moveTo(layout.headerSize, y);
    context.lineTo(layout.headerSize + pattern.width * layout.cellSize, y);
    context.stroke();
  }

  for (const column of majorGridLineCellIndices(pattern.width, PATTERN_CANVAS_MAJOR_GRID_STEP)) {
    strokeVerticalLine(column);
  }

  for (const row of majorGridLineCellIndices(pattern.height, PATTERN_CANVAS_MAJOR_GRID_STEP)) {
    strokeHorizontalLine(row);
  }
}

export function canvasPointToPatternPoint(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
  pattern: PatternDocument,
  layout: CanvasLayout
): PatternPoint | null {
  const rect = canvas.getBoundingClientRect();
  const column = Math.floor((clientX - rect.left - layout.headerSize) / layout.cellSize);
  const row = Math.floor((clientY - rect.top - layout.headerSize) / layout.cellSize);
  if (column < 0 || row < 0 || column >= pattern.width || row >= pattern.height) {
    return null;
  }
  return { column, row };
}

export function drawPatternCanvas(
  canvas: HTMLCanvasElement,
  pattern: PatternDocument,
  paletteByCode: Map<string, { hex: string }>,
  layout: CanvasLayout,
  lineStartPoint: PatternPoint | null,
  linePreviewPoint: PatternPoint | null
): void {
  const context = canvas.getContext("2d");
  if (context === null) {
    return;
  }

  const ratio = devicePixelRatioScale();
  syncPatternCanvasBitmap(canvas, layout, ratio);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.imageSmoothingEnabled = false;

  context.clearRect(0, 0, layout.width, layout.height);
  context.fillStyle = readThemeColor("--background");
  context.fillRect(0, 0, layout.width, layout.height);
  context.fillStyle = readThemeColor("--muted");
  context.fillRect(0, 0, layout.width, layout.headerSize);
  context.fillRect(0, layout.height - layout.headerSize, layout.width, layout.headerSize);
  context.fillRect(0, 0, layout.headerSize, layout.height);
  context.fillRect(layout.width - layout.headerSize, 0, layout.headerSize, layout.height);
  context.textAlign = "center";
  context.textBaseline = "middle";
  const axisLabelFontPx = Math.round(layout.cellSize * PATTERN_CANVAS_AXIS_LABEL_FONT_CELL_FRACTION);
  context.font = `600 ${axisLabelFontPx}px ${PATTERN_CANVAS_MONO_FONT_FAMILY}`;

  for (let column = 0; column < pattern.width; column += 1) {
    const x = layout.headerSize + column * layout.cellSize + layout.cellSize / 2;
    context.fillStyle = readThemeColor("--foreground");
    context.fillText(String(column + 1), x, layout.headerSize / 2);
    context.fillText(String(column + 1), x, layout.height - layout.headerSize / 2);
  }

  for (let row = 0; row < pattern.height; row += 1) {
    const y = layout.headerSize + row * layout.cellSize + layout.cellSize / 2;
    context.fillStyle = readThemeColor("--foreground");
    context.fillText(String(row + 1), layout.headerSize / 2, y);
    context.fillText(String(row + 1), layout.width - layout.headerSize / 2, y);
  }

  const emptyCellFill = readThemeColor("--card");
  const gridStroke = readThemeColor("--border");
  for (let row = 0; row < pattern.height; row += 1) {
    for (let column = 0; column < pattern.width; column += 1) {
      const index = row * pattern.width + column;
      const code = pattern.cells[index];
      const x = layout.headerSize + column * layout.cellSize;
      const y = layout.headerSize + row * layout.cellSize;
      context.fillStyle = code === null ? emptyCellFill : paletteByCode.get(code)?.hex ?? "#ffffff";
      context.fillRect(x, y, layout.cellSize, layout.cellSize);
      context.strokeStyle = gridStroke;
      context.lineWidth = 1;
      context.strokeRect(x, y, layout.cellSize, layout.cellSize);
    }
  }

  if (layout.cellSize >= PATTERN_CANVAS_HIDE_BEAD_CODES_WHEN_CELL_BELOW_PX) {
    const beadCodeFontPx = Math.round(layout.cellSize * PATTERN_CANVAS_BEAD_CODE_FONT_CELL_FRACTION);
    context.font = `700 ${beadCodeFontPx}px ${PATTERN_CANVAS_MONO_FONT_FAMILY}`;
    for (let row = 0; row < pattern.height; row += 1) {
      for (let column = 0; column < pattern.width; column += 1) {
        const index = row * pattern.width + column;
        const code = pattern.cells[index];
        if (code === null) {
          continue;
        }
        const x = layout.headerSize + column * layout.cellSize;
        const y = layout.headerSize + row * layout.cellSize;
        const backgroundHex = paletteByCode.get(code)?.hex ?? "#ffffff";
        const centerX = x + layout.cellSize / 2;
        const centerY = y + layout.cellSize / 2;
        context.fillStyle = readableTextHexOnBackgroundHex(backgroundHex);
        context.fillText(code, centerX, centerY);
      }
    }
  }

  drawOuterMajorLines(context, pattern, layout);

  if (lineStartPoint !== null && linePreviewPoint !== null) {
    context.strokeStyle = readThemeColor("--foreground");
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(pointCenter(lineStartPoint, layout).x, pointCenter(lineStartPoint, layout).y);
    context.lineTo(pointCenter(linePreviewPoint, layout).x, pointCenter(linePreviewPoint, layout).y);
    context.stroke();
  }
}
