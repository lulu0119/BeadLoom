import { describe, expect, it } from "vitest";
import {
  clampPanelFrame,
  movePanelFrame,
  resizePanelFrame,
  type PanelSizeLimits
} from "./floating-panel-frame";

const bounds = { width: 800, height: 600 };
const limits: PanelSizeLimits = { minWidth: 280, minHeight: 160 };

describe("clampPanelFrame", () => {
  it("keeps a frame inside the parent", () => {
    expect(clampPanelFrame({ x: -40, y: 900, width: 320, height: 200 }, bounds, limits)).toEqual({
      x: 0,
      y: 400,
      width: 320,
      height: 200
    });
  });

  it("does not shrink below the minimum size", () => {
    const clamped = clampPanelFrame({ x: 0, y: 0, width: 40, height: 40 }, bounds, limits);
    expect(clamped.width).toBe(280);
    expect(clamped.height).toBe(160);
  });
});

describe("movePanelFrame", () => {
  it("shifts the frame and clamps to the parent", () => {
    expect(movePanelFrame({ x: 10, y: 10, width: 300, height: 180 }, 20, -30, bounds, limits)).toEqual({
      x: 30,
      y: 0,
      width: 300,
      height: 180
    });
  });
});

describe("resizePanelFrame", () => {
  it("grows the south-east corner without moving the origin", () => {
    expect(resizePanelFrame({ x: 100, y: 100, width: 300, height: 180 }, "se", 50, 40, bounds, limits)).toEqual({
      x: 100,
      y: 100,
      width: 350,
      height: 220
    });
  });

  it("moves the west edge and keeps the east edge fixed", () => {
    expect(resizePanelFrame({ x: 100, y: 80, width: 300, height: 180 }, "w", -40, 12, bounds, limits)).toEqual({
      x: 60,
      y: 80,
      width: 340,
      height: 180
    });
  });

  it("moves the north edge and keeps the south edge fixed", () => {
    expect(resizePanelFrame({ x: 100, y: 120, width: 300, height: 200 }, "n", 8, -30, bounds, limits)).toEqual({
      x: 100,
      y: 90,
      width: 300,
      height: 230
    });
  });

  it("does not shrink past the minimum from the west", () => {
    expect(resizePanelFrame({ x: 100, y: 80, width: 280, height: 180 }, "w", 80, 0, bounds, limits)).toEqual({
      x: 100,
      y: 80,
      width: 280,
      height: 180
    });
  });
});
