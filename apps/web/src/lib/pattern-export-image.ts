import {
  buildLegend,
  readableTextHexOnBackgroundHex,
  type PatternDocument
} from "@beadloom/core";
import type { BeadColor } from "@beadloom/palettes";
import { createCanvasLayout, drawPatternCanvas, readThemeColor, type CanvasLayout } from "@/features/pattern-editor/pattern-editor-utils";

const exportMarginPx = 28;
const sectionGapPx = 28;
const headerIconSizePx = 72;
const headerGapAfterIconPx = 14;
const headerTitleLinePx = 24;
const headerUrlLinePx = 20;
const headerGapBeforeDescriptionPx = 10;
const headerCompactTailPx = 8;
const descLineHeightPx = 19;
const gapBeforeChartPx = 28;
const headerTitleFont = '600 17px ui-sans-serif, system-ui, "Segoe UI", sans-serif';
const headerUrlFont = '13px ui-monospace, SFMono-Regular, Menlo, monospace';
const headerDescFont = '13px ui-sans-serif, system-ui, "Segoe UI", sans-serif';
const legendChipHeightPx = 34;
const legendChipRadiusPx = legendChipHeightPx / 2;
const legendRowGapPx = 10;
const legendChipGapPx = 8;
const legendCodeFont = '600 12px ui-monospace, SFMono-Regular, Menlo, monospace';
const legendCountFont = '600 12px ui-sans-serif, system-ui, sans-serif';
const maxChartWidthPx = 980;

/** Max edge length (after pixelRatio) to avoid huge bitmaps / GPU limits. */
const exportCanvasMaxEdgePx = 8192;

function scaleCanvasLayout(layout: CanvasLayout, factor: number): CanvasLayout {
  const cellSize = Math.max(1, Math.round(layout.cellSize * factor));
  const headerSize = Math.max(1, Math.round(layout.headerSize * factor));
  const columns = Math.round((layout.width - 2 * layout.headerSize) / layout.cellSize);
  const rows = Math.round((layout.height - 2 * layout.headerSize) / layout.cellSize);
  return {
    cellSize,
    headerSize,
    width: columns * cellSize + 2 * headerSize,
    height: rows * cellSize + 2 * headerSize
  };
}

/**
 * Higher resolution than on-screen CSS pixels. Canvas has no PNG DPI metadata; larger bitmap = sharper file.
 * Steps down if the final canvas would exceed {@link exportCanvasMaxEdgePx}.
 */
function resolveExportPixelRatio(logicalOutputWidth: number, logicalOutputHeight: number): number {
  const devicePxRatio =
    typeof window !== "undefined" && typeof window.devicePixelRatio === "number" && window.devicePixelRatio > 0
      ? window.devicePixelRatio
      : 1;
  const target = Math.min(3, Math.max(2, devicePxRatio));
  const candidates = [3, 2.5, 2, 1.5, 1];
  for (const step of candidates) {
    if (step > target) {
      continue;
    }
    if (logicalOutputWidth * step <= exportCanvasMaxEdgePx && logicalOutputHeight * step <= exportCanvasMaxEdgePx) {
      return step;
    }
  }
  return 1;
}

/** Branding shown above the chart (localized strings + resolved logo URL). */
export type PatternExportBranding = {
  siteTitle: string;
  siteUrl: string;
  siteDescription: string;
  /** Absolute or root-relative URL to the logo image (e.g. from `publicPath`). */
  logoSrc: string;
};

function paletteMapForDrawing(paletteByCode: Map<string, BeadColor>): Map<string, { hex: string }> {
  return new Map([...paletteByCode.entries()].map(([code, color]) => [code, { hex: color.hex }]));
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    image.src = src;
  });
}

/** Prefer sharp chart; scale down only when the canvas would exceed a comfortable width. */
export function computeExportChartZoom(pattern: PatternDocument): number {
  const candidates: number[] = [1, 0.85, 0.75, 0.65, 0.55, 0.5];
  for (const zoom of candidates) {
    const layout = createCanvasLayout(pattern, zoom);
    if (layout.width <= maxChartWidthPx) {
      return zoom;
    }
  }
  return 0.5;
}

/** Fixed copy uses `\n` in `meta.description`; export splits into canvas lines (no dynamic wrapping). */
function splitExportDescriptionLines(description: string): string[] {
  return description
    .split(/\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function measureLegendChipWidth(
  context: CanvasRenderingContext2D,
  code: string,
  count: number
): { chipWidth: number; leftSectionWidth: number } {
  context.font = legendCodeFont;
  const codeWidth = context.measureText(code).width;
  context.font = legendCountFont;
  const countWidth = context.measureText(`×${String(count)}`).width;
  const leftPadding = 10;
  const rightPadding = 12;
  const gapBetween = 8;
  const leftSectionWidth = Math.max(36, leftPadding + codeWidth + gapBetween / 2);
  const chipWidth = leftSectionWidth + gapBetween / 2 + countWidth + rightPadding;
  return { chipWidth, leftSectionWidth };
}

function drawLegendChip(
  context: CanvasRenderingContext2D,
  originX: number,
  originY: number,
  code: string,
  count: number,
  swatchHex: string,
  chipWidth: number,
  leftSectionWidth: number
): void {
  const textOnSwatch = readableTextHexOnBackgroundHex(swatchHex);
  context.fillStyle = readThemeColor("--card");
  context.beginPath();
  context.roundRect(originX, originY, chipWidth, legendChipHeightPx, legendChipRadiusPx);
  context.fill();

  context.save();
  context.beginPath();
  context.roundRect(originX, originY, chipWidth, legendChipHeightPx, legendChipRadiusPx);
  context.clip();
  context.fillStyle = swatchHex;
  context.fillRect(originX, originY, leftSectionWidth, legendChipHeightPx);
  context.restore();

  context.strokeStyle = readThemeColor("--border");
  context.lineWidth = 1;
  context.beginPath();
  context.roundRect(originX, originY, chipWidth, legendChipHeightPx, legendChipRadiusPx);
  context.stroke();

  context.textBaseline = "middle";
  context.textAlign = "center";
  context.font = legendCodeFont;
  context.fillStyle = textOnSwatch;
  context.fillText(code, originX + leftSectionWidth / 2, originY + legendChipHeightPx / 2);

  context.font = legendCountFont;
  context.fillStyle = readThemeColor("--foreground");
  context.fillText(`×${String(count)}`, originX + leftSectionWidth + (chipWidth - leftSectionWidth) / 2, originY + legendChipHeightPx / 2);
}

/**
 * Renders branding header, bead chart, and a wrapped pill legend into a PNG blob (browser-only).
 */
export async function renderPatternExportToPngBlob(
  pattern: PatternDocument,
  paletteByCode: Map<string, BeadColor>,
  branding: PatternExportBranding
): Promise<Blob> {
  if (typeof document === "undefined") {
    throw new Error("PNG export requires a browser environment.");
  }

  const zoom = computeExportChartZoom(pattern);
  const layout = createCanvasLayout(pattern, zoom);
  const drawingPalette = paletteMapForDrawing(paletteByCode);

  let logoImage: HTMLImageElement | null = null;
  try {
    logoImage = await loadImage(branding.logoSrc);
  } catch {
    logoImage = null;
  }

  const legendItems = pattern.legend ?? buildLegend(pattern.cells);

  const measureCanvas = document.createElement("canvas");
  const measureContext = measureCanvas.getContext("2d");
  if (measureContext === null) {
    throw new Error("Canvas is not available for export.");
  }

  const descriptionLines = splitExportDescriptionLines(branding.siteDescription);

  measureContext.font = headerTitleFont;
  const titleWidth = measureContext.measureText(branding.siteTitle).width;
  measureContext.font = headerUrlFont;
  const urlWidth = measureContext.measureText(branding.siteUrl).width;
  measureContext.font = headerDescFont;
  let maxDescriptionLineWidth = 0;
  for (const line of descriptionLines) {
    maxDescriptionLineWidth = Math.max(maxDescriptionLineWidth, measureContext.measureText(line).width);
  }


  const headerBlockHeight =
    headerIconSizePx +
    headerGapAfterIconPx +
    headerTitleLinePx +
    headerUrlLinePx +
    (descriptionLines.length > 0
      ? headerGapBeforeDescriptionPx + descriptionLines.length * descLineHeightPx
      : headerCompactTailPx);

  const chipMetrics = legendItems.map((item) => ({
    item,
    ...measureLegendChipWidth(measureContext, item.code, item.count)
  }));

  function computeLegendHeightPx(columnLimit: number): number {
    if (chipMetrics.length === 0) {
      return 0;
    }
    let rowWidth = 0;
    let rows = 1;
    for (let i = 0; i < chipMetrics.length; i += 1) {
      const w = chipMetrics[i].chipWidth;
      const nextWidth = rowWidth === 0 ? w : rowWidth + legendChipGapPx + w;
      if (nextWidth > columnLimit && rowWidth > 0) {
        rows += 1;
        rowWidth = w;
      } else {
        rowWidth = nextWidth;
      }
    }
    return rows * legendChipHeightPx + Math.max(0, rows - 1) * legendRowGapPx;
  }

  const contentWidth = Math.ceil(Math.max(layout.width, titleWidth, urlWidth, maxDescriptionLineWidth));

  const legendHeightDraftPx = computeLegendHeightPx(layout.width);
  const logicalCanvasHeightDraft =
    exportMarginPx +
    headerBlockHeight +
    gapBeforeChartPx +
    layout.height +
    (legendHeightDraftPx > 0 ? sectionGapPx + legendHeightDraftPx : 0) +
    exportMarginPx;

  let exportPixelRatio = resolveExportPixelRatio(contentWidth + exportMarginPx * 2, logicalCanvasHeightDraft);

  let scaledChartLayout = scaleCanvasLayout(layout, exportPixelRatio);
  let chartLogicalWidth = scaledChartLayout.width / exportPixelRatio;
  let chartLogicalHeight = scaledChartLayout.height / exportPixelRatio;

  let columnMaxWidth = chartLogicalWidth;
  let legendHeightPx = computeLegendHeightPx(columnMaxWidth);

  let logicalCanvasWidth = Math.ceil(Math.max(contentWidth, chartLogicalWidth)) + exportMarginPx * 2;
  let logicalCanvasHeight =
    exportMarginPx +
    headerBlockHeight +
    gapBeforeChartPx +
    chartLogicalHeight +
    (legendHeightPx > 0 ? sectionGapPx + legendHeightPx : 0) +
    exportMarginPx;

  const exportPixelSteps = [3, 2.5, 2, 1.5, 1] as const;
  let safety = 0;
  while (
    (logicalCanvasWidth * exportPixelRatio > exportCanvasMaxEdgePx ||
      logicalCanvasHeight * exportPixelRatio > exportCanvasMaxEdgePx) &&
    exportPixelRatio > 1 &&
    safety < 12
  ) {
    safety += 1;
    const next = exportPixelSteps.find((step) => step < exportPixelRatio);
    exportPixelRatio = next ?? 1;
    scaledChartLayout = scaleCanvasLayout(layout, exportPixelRatio);
    chartLogicalWidth = scaledChartLayout.width / exportPixelRatio;
    chartLogicalHeight = scaledChartLayout.height / exportPixelRatio;
    columnMaxWidth = chartLogicalWidth;
    legendHeightPx = computeLegendHeightPx(columnMaxWidth);
    logicalCanvasWidth = Math.ceil(Math.max(contentWidth, chartLogicalWidth)) + exportMarginPx * 2;
    logicalCanvasHeight =
      exportMarginPx +
      headerBlockHeight +
      gapBeforeChartPx +
      chartLogicalHeight +
      (legendHeightPx > 0 ? sectionGapPx + legendHeightPx : 0) +
      exportMarginPx;
  }

  const chartCanvas = document.createElement("canvas");
  chartCanvas.width = scaledChartLayout.width;
  chartCanvas.height = scaledChartLayout.height;
  drawPatternCanvas(chartCanvas, pattern, drawingPalette, scaledChartLayout, null, null);

  const outputCanvas = document.createElement("canvas");
  const context = outputCanvas.getContext("2d");
  if (context === null) {
    throw new Error("Canvas is not available for export.");
  }

  outputCanvas.width = Math.ceil(logicalCanvasWidth * exportPixelRatio);
  outputCanvas.height = Math.ceil(logicalCanvasHeight * exportPixelRatio);
  context.scale(exportPixelRatio, exportPixelRatio);

  context.fillStyle = readThemeColor("--background");
  context.fillRect(0, 0, logicalCanvasWidth, logicalCanvasHeight);

  const centerX = logicalCanvasWidth / 2;
  let cursorY = exportMarginPx;

  if (logoImage !== null) {
    const iconX = centerX - headerIconSizePx / 2;
    context.drawImage(logoImage, iconX, cursorY, headerIconSizePx, headerIconSizePx);
  }
  cursorY += headerIconSizePx + headerGapAfterIconPx;

  context.textAlign = "center";
  context.textBaseline = "top";
  context.font = headerTitleFont;
  context.fillStyle = readThemeColor("--foreground");
  context.fillText(branding.siteTitle, centerX, cursorY);
  cursorY += headerTitleLinePx;

  context.font = headerUrlFont;
  context.fillStyle = readThemeColor("--muted-foreground");
  context.fillText(branding.siteUrl, centerX, cursorY);
  cursorY += headerUrlLinePx;

  context.font = headerDescFont;
  context.fillStyle = readThemeColor("--muted-foreground");
  if (descriptionLines.length > 0) {
    cursorY += headerGapBeforeDescriptionPx;
    for (const line of descriptionLines) {
      context.fillText(line, centerX, cursorY);
      cursorY += descLineHeightPx;
    }
  } else {
    cursorY += headerCompactTailPx;
  }

  cursorY += gapBeforeChartPx;

  const chartX = centerX - chartLogicalWidth / 2;
  context.save();
  context.imageSmoothingEnabled = false;
  context.drawImage(
    chartCanvas,
    0,
    0,
    chartCanvas.width,
    chartCanvas.height,
    chartX,
    cursorY,
    chartLogicalWidth,
    chartLogicalHeight
  );
  context.restore();
  cursorY += chartLogicalHeight + sectionGapPx;

  if (chipMetrics.length > 0) {
    let index = 0;
    let rowOriginY = cursorY;
    while (index < chipMetrics.length) {
      let rowWidth = 0;
      const rowItems: typeof chipMetrics = [];
      while (index < chipMetrics.length) {
        const next = chipMetrics[index];
        const candidate =
          rowItems.length === 0 ? next.chipWidth : rowWidth + legendChipGapPx + next.chipWidth;
        if (candidate > columnMaxWidth && rowItems.length > 0) {
          break;
        }
        rowItems.push(next);
        rowWidth = candidate;
        index += 1;
      }
      let rowX = centerX - rowWidth / 2;
      for (const row of rowItems) {
        const beadColor = paletteByCode.get(row.item.code);
        const swatchHex = beadColor?.hex ?? "#ffffff";
        drawLegendChip(
          context,
          rowX,
          rowOriginY,
          row.item.code,
          row.item.count,
          swatchHex,
          row.chipWidth,
          row.leftSectionWidth
        );
        rowX += row.chipWidth + legendChipGapPx;
      }
      rowOriginY += legendChipHeightPx + legendRowGapPx;
    }
  }

  return new Promise((resolve, reject) => {
    outputCanvas.toBlob((blob) => {
      if (blob === null) {
        reject(new Error("PNG export failed."));
        return;
      }
      resolve(blob);
    }, "image/png");
  });
}
