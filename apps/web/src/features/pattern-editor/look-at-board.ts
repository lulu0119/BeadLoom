import { buildLegend, type PatternDocument } from "@beadloom/core";
import type { RgbColor } from "@beadloom/palettes";

export type BoardCrop = {
  column: number;
  row: number;
  width: number;
  height: number;
};

export type BoardPreview = {
  pixels: RgbColor[];
  width: number;
  height: number;
  originColumn: number;
  originRow: number;
  legend: { code: string; count: number }[];
};

const CELL_SIZE = 12;
const GUTTER = 16;
const TICK: RgbColor = { red: 40, green: 40, blue: 40 };
const EMPTY: RgbColor = { red: 255, green: 255, blue: 255 };
const PAPER: RgbColor = { red: 245, green: 242, blue: 236 };

function hexToRgb(hex: string): RgbColor {
  return {
    red: Number.parseInt(hex.slice(1, 3), 16),
    green: Number.parseInt(hex.slice(3, 5), 16),
    blue: Number.parseInt(hex.slice(5, 7), 16)
  };
}

function resolveCrop(pattern: PatternDocument, crop?: BoardCrop): BoardCrop {
  if (crop === undefined) {
    return { column: 0, row: 0, width: pattern.width, height: pattern.height };
  }
  const column = Math.max(0, crop.column);
  const row = Math.max(0, crop.row);
  const width = Math.max(1, Math.min(crop.width, pattern.width - column));
  const height = Math.max(1, Math.min(crop.height, pattern.height - row));
  return { column, row, width, height };
}

export function renderBoardPreview(
  pattern: PatternDocument,
  paletteByCode: Map<string, { hex: string }>,
  crop?: BoardCrop
): BoardPreview {
  const region = resolveCrop(pattern, crop);
  const width = GUTTER * 2 + region.width * CELL_SIZE;
  const height = GUTTER * 2 + region.height * CELL_SIZE;
  const pixels: RgbColor[] = Array.from({ length: width * height }, () => PAPER);

  function setPixel(x: number, y: number, color: RgbColor): void {
    if (x < 0 || y < 0 || x >= width || y >= height) {
      return;
    }
    pixels[y * width + x] = color;
  }

  for (let row = 0; row < region.height; row += 1) {
    for (let column = 0; column < region.width; column += 1) {
      const code = pattern.cells[(region.row + row) * pattern.width + (region.column + column)];
      const fill = code === null ? EMPTY : hexToRgb(paletteByCode.get(code)?.hex ?? "#ffffff");
      const originX = GUTTER + column * CELL_SIZE;
      const originY = GUTTER + row * CELL_SIZE;
      for (let y = 0; y < CELL_SIZE; y += 1) {
        for (let x = 0; x < CELL_SIZE; x += 1) {
          setPixel(originX + x, originY + y, fill);
        }
      }
    }
  }

  for (let column = 0; column <= region.width; column += 1) {
    const x = GUTTER + column * CELL_SIZE;
    for (let y = GUTTER - 4; y < GUTTER; y += 1) {
      setPixel(x, y, TICK);
    }
    for (let y = height - GUTTER; y < height - GUTTER + 4; y += 1) {
      setPixel(x, y, TICK);
    }
  }
  for (let row = 0; row <= region.height; row += 1) {
    const y = GUTTER + row * CELL_SIZE;
    for (let x = GUTTER - 4; x < GUTTER; x += 1) {
      setPixel(x, y, TICK);
    }
    for (let x = width - GUTTER; x < width - GUTTER + 4; x += 1) {
      setPixel(x, y, TICK);
    }
  }

  return {
    pixels,
    width,
    height,
    originColumn: region.column,
    originRow: region.row,
    legend: buildLegend(pattern.cells)
  };
}

export function previewToDataUrl(preview: BoardPreview): string | null {
  if (typeof document === "undefined") {
    return null;
  }
  const canvas = document.createElement("canvas");
  canvas.width = preview.width;
  canvas.height = preview.height;
  const context = canvas.getContext("2d");
  if (context === null) {
    return null;
  }
  const image = context.createImageData(preview.width, preview.height);
  for (let index = 0; index < preview.pixels.length; index += 1) {
    const pixel = preview.pixels[index];
    const offset = index * 4;
    image.data[offset] = pixel.red;
    image.data[offset + 1] = pixel.green;
    image.data[offset + 2] = pixel.blue;
    image.data[offset + 3] = 255;
  }
  context.putImageData(image, 0, 0);
  return canvas.toDataURL("image/png");
}
