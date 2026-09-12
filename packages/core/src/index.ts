import { rgbToHex as paletteRgbToHex, rgbToHsl, rgbToLab, type BeadColor, type RgbColor } from "@beadloom/palettes";

import { buildLegend, type PatternLegendItem } from "./build-legend";

export type { PatternLegendItem };
export { buildLegend };

export const MAX_PATTERN_SIZE = 256;

export type MatchingSpace = "rgb" | "lab" | "hsl";

export type PatternCell = string | null;

export type PatternDocument = {
  version: 1;
  width: number;
  height: number;
  cells: PatternCell[];
  legend?: PatternLegendItem[];
  history?: PatternHistory;
};

export type PatternPoint = {
  column: number;
  row: number;
};

export type PatternSnapshot = Omit<PatternDocument, "history">;

export type PatternHistory = {
  past: PatternSnapshot[];
  present: PatternSnapshot;
  future: PatternSnapshot[];
};

export type PatternCellWrite = {
  column: number;
  row: number;
  code: PatternCell;
};

export function createBlankPattern(width: number, height: number): PatternDocument {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new Error("Pattern dimensions must be positive integers.");
  }
  if (width > MAX_PATTERN_SIZE || height > MAX_PATTERN_SIZE) {
    throw new Error(`Pattern dimensions must not exceed ${MAX_PATTERN_SIZE} by ${MAX_PATTERN_SIZE}.`);
  }
  const cells: PatternCell[] = Array.from({ length: width * height }, () => null);
  return {
    version: 1,
    width,
    height,
    cells,
    legend: buildLegend(cells)
  };
}

export function hexToRgb(hex: string): RgbColor {
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) {
    throw new Error(`Invalid HEX color ${hex}.`);
  }

  return {
    red: Number.parseInt(hex.slice(1, 3), 16),
    green: Number.parseInt(hex.slice(3, 5), 16),
    blue: Number.parseInt(hex.slice(5, 7), 16)
  };
}

export function rgbToHex(rgb: RgbColor): string {
  return paletteRgbToHex(rgb);
}

function linearizeSrgbChannel(channel0To255: number): number {
  const normalized = channel0To255 / 255;
  return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

/** WCAG 2.x relative luminance in the 0–1 range (higher means visually lighter). */
export function relativeLuminanceFromRgb(rgb: RgbColor): number {
  const red = linearizeSrgbChannel(rgb.red);
  const green = linearizeSrgbChannel(rgb.green);
  const blue = linearizeSrgbChannel(rgb.blue);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

const readableTextLuminanceThreshold = 0.55;

/**
 * Solid text color for labels on a uniform sRGB `backgroundHex` (#RRGGBB).
 * Light backgrounds use near-black; dark backgrounds use near-white.
 */
export function readableTextHexOnBackgroundHex(backgroundHex: string): string {
  const rgb = hexToRgb(backgroundHex);
  return relativeLuminanceFromRgb(rgb) >= readableTextLuminanceThreshold ? "#171717" : "#f4f4f5";
}

export function findNearestPaletteColor(source: RgbColor, palette: BeadColor[], matchingSpace: MatchingSpace): BeadColor {
  if (palette.length === 0) {
    throw new Error("Palette must contain at least one color.");
  }

  let nearestColor = palette[0];
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const color of palette) {
    const distance = colorDistance(source, color, matchingSpace);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestColor = color;
    }
  }

  return nearestColor;
}

export function replacePatternColor(
  pattern: PatternDocument,
  sourceCode: string,
  targetCode: string,
  existingHistory?: PatternHistory
): PatternDocument {
  const nextPattern = withLegend({
    ...snapshotOf(pattern),
    cells: pattern.cells.map((cell) => (cell === sourceCode ? targetCode : cell))
  });

  return withHistory(pattern, nextPattern, existingHistory);
}

export function deletePatternColor(pattern: PatternDocument, sourceCode: string, existingHistory?: PatternHistory): PatternDocument {
  const nextPattern = withLegend({
    ...snapshotOf(pattern),
    cells: pattern.cells.map((cell) => (cell === sourceCode ? null : cell))
  });

  return withHistory(pattern, nextPattern, existingHistory);
}

export function bucketFillPattern(
  pattern: PatternDocument,
  startPoint: PatternPoint,
  targetCode: string,
  existingHistory?: PatternHistory
): PatternDocument {
  const startIndex = pointToIndex(pattern, startPoint);
  const sourceCode = pattern.cells[startIndex];
  if (sourceCode === targetCode) {
    return pattern;
  }

  const cells = [...pattern.cells];
  const queue: PatternPoint[] = [startPoint];
  const visited = new Set<number>();

  while (queue.length > 0) {
    const point = queue.shift();
    if (point === undefined || !isPointInside(pattern, point)) {
      continue;
    }

    const index = pointToIndex(pattern, point);
    if (visited.has(index) || cells[index] !== sourceCode) {
      continue;
    }

    visited.add(index);
    cells[index] = targetCode;
    queue.push(
      { column: point.column + 1, row: point.row },
      { column: point.column - 1, row: point.row },
      { column: point.column, row: point.row + 1 },
      { column: point.column, row: point.row - 1 }
    );
  }

  return withHistory(pattern, withLegend({ ...snapshotOf(pattern), cells }), existingHistory);
}

export function applyLineToCells(
  pattern: PatternDocument,
  startPoint: PatternPoint,
  endPoint: PatternPoint,
  targetCode: PatternCell
): PatternCell[] {
  const cells = [...pattern.cells];
  const columnDelta = Math.abs(endPoint.column - startPoint.column);
  const rowDelta = Math.abs(endPoint.row - startPoint.row);
  const columnStep = startPoint.column < endPoint.column ? 1 : -1;
  const rowStep = startPoint.row < endPoint.row ? 1 : -1;
  let error = columnDelta - rowDelta;
  let column = startPoint.column;
  let row = startPoint.row;

  while (true) {
    const point = { column, row };
    if (isPointInside(pattern, point)) {
      cells[pointToIndex(pattern, point)] = targetCode;
    }
    if (column === endPoint.column && row === endPoint.row) {
      break;
    }
    const doubledError = error * 2;
    if (doubledError > -rowDelta) {
      error -= rowDelta;
      column += columnStep;
    }
    if (doubledError < columnDelta) {
      error += columnDelta;
      row += rowStep;
    }
  }

  return cells;
}

export function commitPatternEdit(
  previous: PatternDocument,
  nextPattern: PatternSnapshot,
  existingHistory?: PatternHistory
): PatternDocument {
  return withHistory(previous, withLegend(nextPattern), existingHistory);
}

export function drawPatternLine(
  pattern: PatternDocument,
  startPoint: PatternPoint,
  endPoint: PatternPoint,
  targetCode: PatternCell,
  existingHistory?: PatternHistory
): PatternDocument {
  const cells = applyLineToCells(pattern, startPoint, endPoint, targetCode);
  return withHistory(pattern, withLegend({ ...snapshotOf(pattern), cells }), existingHistory);
}

export function setPatternCells(
  pattern: PatternDocument,
  writes: PatternCellWrite[],
  existingHistory?: PatternHistory
): PatternDocument {
  const cells = [...pattern.cells];
  for (const write of writes) {
    const point = { column: write.column, row: write.row };
    if (!isPointInside(pattern, point)) {
      continue;
    }
    cells[pointToIndex(pattern, point)] = write.code;
  }
  return withHistory(pattern, withLegend({ ...snapshotOf(pattern), cells }), existingHistory);
}

export function resizePattern(pattern: PatternDocument, width: number, height: number, existingHistory?: PatternHistory): PatternDocument {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new Error("Pattern dimensions must be positive integers.");
  }
  if (width > MAX_PATTERN_SIZE || height > MAX_PATTERN_SIZE) {
    throw new Error(`Pattern dimensions must not exceed ${MAX_PATTERN_SIZE} by ${MAX_PATTERN_SIZE}.`);
  }
  if (width === pattern.width && height === pattern.height) {
    return pattern;
  }

  const cells: PatternCell[] = Array.from({ length: width * height }, () => null);
  const copyWidth = Math.min(width, pattern.width);
  const copyHeight = Math.min(height, pattern.height);
  for (let row = 0; row < copyHeight; row += 1) {
    for (let column = 0; column < copyWidth; column += 1) {
      cells[row * width + column] = pattern.cells[row * pattern.width + column];
    }
  }

  return withHistory(pattern, withLegend({ version: 1, width, height, cells }), existingHistory);
}

export function undoPatternHistory(history: PatternHistory): { pattern: PatternDocument; history: PatternHistory } {
  const previous = history.past.at(-1);
  if (previous === undefined) {
    return { pattern: { ...history.present, history }, history };
  }

  const nextHistory = {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future]
  };

  return { pattern: { ...previous, history: nextHistory }, history: nextHistory };
}

export function redoPatternHistory(history: PatternHistory): { pattern: PatternDocument; history: PatternHistory } {
  const next = history.future[0];
  if (next === undefined) {
    return { pattern: { ...history.present, history }, history };
  }

  const nextHistory = {
    past: [...history.past, history.present],
    present: next,
    future: history.future.slice(1)
  };

  return { pattern: { ...next, history: nextHistory }, history: nextHistory };
}

function colorDistance(source: RgbColor, color: BeadColor, matchingSpace: MatchingSpace): number {
  if (matchingSpace === "lab") {
    const sourceLab = rgbToLab(source);
    return squaredDistance(
      [sourceLab.lightness, sourceLab.greenRed, sourceLab.blueYellow],
      [color.lab.lightness, color.lab.greenRed, color.lab.blueYellow]
    );
  }
  if (matchingSpace === "hsl") {
    const sourceHsl = rgbToHsl(source);
    return squaredDistance(
      [sourceHsl.hue, sourceHsl.saturation, sourceHsl.lightness],
      [color.hsl.hue, color.hsl.saturation, color.hsl.lightness]
    );
  }
  return squaredDistance([source.red, source.green, source.blue], [color.rgb.red, color.rgb.green, color.rgb.blue]);
}

function squaredDistance(left: number[], right: number[]): number {
  return left.reduce((total, value, index) => total + (value - right[index]) ** 2, 0);
}

function withLegend(pattern: PatternSnapshot): PatternSnapshot {
  return {
    ...pattern,
    legend: buildLegend(pattern.cells)
  };
}

function withHistory(pattern: PatternDocument, nextPattern: PatternSnapshot, existingHistory?: PatternHistory): PatternDocument {
  const currentHistory = existingHistory ?? pattern.history;
  const previousSnapshot = snapshotOf(pattern);
  const past = currentHistory ? [...currentHistory.past, currentHistory.present] : [previousSnapshot];
  const nextHistory = {
    past,
    present: nextPattern,
    future: []
  };

  return {
    ...nextPattern,
    history: nextHistory
  };
}

function snapshotOf(pattern: PatternDocument): PatternSnapshot {
  return {
    version: pattern.version,
    width: pattern.width,
    height: pattern.height,
    cells: [...pattern.cells],
    legend: buildLegend(pattern.cells)
  };
}

function pointToIndex(pattern: Pick<PatternDocument, "width">, point: PatternPoint): number {
  return point.row * pattern.width + point.column;
}

function isPointInside(pattern: Pick<PatternDocument, "width" | "height">, point: PatternPoint): boolean {
  return point.column >= 0 && point.column < pattern.width && point.row >= 0 && point.row < pattern.height;
}
