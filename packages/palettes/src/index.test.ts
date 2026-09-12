import { describe, expect, it } from "vitest";
import { defaultPalette, normalizePaletteRows, validatePalette } from "./index";

describe("default palette", () => {
  it("normalizes source rows with RGB, HEX, HSL, and Lab values", () => {
    const palette = normalizePaletteRows(["A1,A1,250,244,200,Asher"]);

    expect(palette).toHaveLength(1);
    expect(palette[0]).toMatchObject({
      code: "A1",
      name: "A1",
      hex: "#FAF4C8",
      rgb: { red: 250, green: 244, blue: 200 }
    });
    expect(palette[0].hsl.hue).toBeGreaterThanOrEqual(0);
    expect(palette[0].lab.lightness).toBeGreaterThan(0);
  });

  it("rejects duplicate color codes", () => {
    expect(() =>
      validatePalette([
        normalizePaletteRows(["A1,A1,250,244,200,Asher"])[0],
        normalizePaletteRows(["A1,A1 duplicate,255,255,255,Asher"])[0]
      ])
    ).toThrow(/duplicate/i);
  });

  it("rejects invalid RGB channel values", () => {
    expect(() => normalizePaletteRows(["BAD,BAD,300,0,0,Asher"])).toThrow(/rgb/i);
  });

  it("preserves known source samples", () => {
    const samples = new Map(defaultPalette.map((color) => [color.code, color.hex]));

    expect(samples.get("A1")).toBe("#FAF4C8");
    expect(samples.get("H7")).toBe("#000000");
    expect(samples.get("T1")).toBe("#FFFFFF");
  });

  it("contains one validated entry per source row", () => {
    expect(defaultPalette).toHaveLength(291);
    expect(validatePalette(defaultPalette)).toHaveLength(291);
  });
});
