import { createBlankPattern } from "@beadloom/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createCanvasLayout, drawPatternCanvas } from "./pattern-editor-utils";

describe("drawPatternCanvas", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("paints the board from the theme background token, not kraft paper", () => {
    const { canvas, fillStyles } = makeCanvas();
    const pattern = createBlankPattern(2, 2);
    drawPatternCanvas(canvas, pattern, new Map(), createCanvasLayout(pattern, 1), null, null);

    expect(fillStyles[0]).toMatch(/^(oklch\(|var\(--background\))/);
    expect(fillStyles).not.toContain("#fffaf2");
  });

  it("backs the bitmap with the device pixel ratio so cells stay sharp", () => {
    vi.stubGlobal("devicePixelRatio", 2);
    const { canvas } = makeCanvas();
    const pattern = createBlankPattern(2, 2);
    const layout = createCanvasLayout(pattern, 1);
    drawPatternCanvas(canvas, pattern, new Map(), layout, null, null);

    expect(canvas.width).toBe(layout.width * 2);
    expect(canvas.height).toBe(layout.height * 2);
    expect(canvas.style.width).toBe(`${layout.width}px`);
    expect(canvas.style.height).toBe(`${layout.height}px`);
  });
});

function makeCanvas(): { canvas: HTMLCanvasElement; fillStyles: string[] } {
  const canvas = document.createElement("canvas");
  const fillStyles: string[] = [];
  let fillStyle = "";
  const context = {
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    fillText: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    setLineDash: vi.fn(),
    setTransform: vi.fn(),
    get fillStyle() {
      return fillStyle;
    },
    set fillStyle(value: string) {
      fillStyle = value;
      fillStyles.push(value);
    },
    strokeStyle: "",
    font: "",
    globalAlpha: 1,
    lineWidth: 1,
    imageSmoothingEnabled: true,
    textAlign: "start",
    textBaseline: "alphabetic"
  };
  Object.defineProperty(canvas, "getContext", {
    configurable: true,
    value: vi.fn((id: string) => (id === "2d" ? context : null))
  });
  return { canvas, fillStyles };
}
