import paletteData from "./palette.json";

export type RgbColor = {
  red: number;
  green: number;
  blue: number;
};

export type HslColor = {
  hue: number;
  saturation: number;
  lightness: number;
};

export type LabColor = {
  lightness: number;
  greenRed: number;
  blueYellow: number;
};

export type BeadColor = {
  code: string;
  name: string;
  hex: string;
  rgb: RgbColor;
  hsl: HslColor;
  lab: LabColor;
};

type PaletteJson = BeadColor[];

export const defaultPalette: BeadColor[] = validatePalette(paletteData as PaletteJson);

export function normalizePaletteRows(rows: string[]): BeadColor[] {
  const palette = rows.map((row, rowIndex) => {
    const columns = row.split(",");
    if (columns.length < 5) {
      throw new Error(`Palette row ${rowIndex + 1} is missing required columns.`);
    }

    const [code, name, redRaw, greenRaw, blueRaw] = columns;
    const rgb = {
      red: parseRgbChannel(redRaw, rowIndex),
      green: parseRgbChannel(greenRaw, rowIndex),
      blue: parseRgbChannel(blueRaw, rowIndex)
    };

    return {
      code,
      name,
      hex: rgbToHex(rgb),
      rgb,
      hsl: rgbToHsl(rgb),
      lab: rgbToLab(rgb)
    };
  });

  return validatePalette(palette);
}

export function validatePalette(palette: BeadColor[]): BeadColor[] {
  const seenCodes = new Set<string>();

  for (const color of palette) {
    if (seenCodes.has(color.code)) {
      throw new Error(`Palette contains duplicate code ${color.code}.`);
    }
    seenCodes.add(color.code);

    const expectedHex = rgbToHex(color.rgb);
    if (!/^#[0-9A-F]{6}$/.test(color.hex)) {
      throw new Error(`Palette color ${color.code} has invalid HEX ${color.hex}.`);
    }
    if (color.hex !== expectedHex) {
      throw new Error(`Palette color ${color.code} has inconsistent RGB and HEX values.`);
    }
  }

  return palette;
}

export function rgbToHex(rgb: RgbColor): string {
  return `#${toHexChannel(rgb.red)}${toHexChannel(rgb.green)}${toHexChannel(rgb.blue)}`;
}

export function rgbToHsl(rgb: RgbColor): HslColor {
  const red = rgb.red / 255;
  const green = rgb.green / 255;
  const blue = rgb.blue / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  const lightness = (max + min) / 2;

  if (delta === 0) {
    return { hue: 0, saturation: 0, lightness: round(lightness * 100) };
  }

  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  let hue: number;

  if (max === red) {
    hue = 60 * (((green - blue) / delta) % 6);
  } else if (max === green) {
    hue = 60 * ((blue - red) / delta + 2);
  } else {
    hue = 60 * ((red - green) / delta + 4);
  }

  return {
    hue: round(hue < 0 ? hue + 360 : hue),
    saturation: round(saturation * 100),
    lightness: round(lightness * 100)
  };
}

export function rgbToLab(rgb: RgbColor): LabColor {
  const red = pivotRgb(rgb.red / 255);
  const green = pivotRgb(rgb.green / 255);
  const blue = pivotRgb(rgb.blue / 255);

  const x = pivotXyz((red * 0.4124 + green * 0.3576 + blue * 0.1805) / 0.95047);
  const y = pivotXyz((red * 0.2126 + green * 0.7152 + blue * 0.0722) / 1);
  const z = pivotXyz((red * 0.0193 + green * 0.1192 + blue * 0.9505) / 1.08883);

  return {
    lightness: round(116 * y - 16),
    greenRed: round(500 * (x - y)),
    blueYellow: round(200 * (y - z))
  };
}

function parseRgbChannel(rawValue: string, rowIndex: number): number {
  const channel = Number(rawValue);
  if (!Number.isInteger(channel) || channel < 0 || channel > 255) {
    throw new Error(`Palette row ${rowIndex + 1} contains invalid RGB channel ${rawValue}.`);
  }
  return channel;
}

function toHexChannel(channel: number): string {
  if (!Number.isInteger(channel) || channel < 0 || channel > 255) {
    throw new Error(`Invalid RGB channel ${channel}.`);
  }
  return channel.toString(16).padStart(2, "0").toUpperCase();
}

function pivotRgb(value: number): number {
  return value > 0.04045 ? ((value + 0.055) / 1.055) ** 2.4 : value / 12.92;
}

function pivotXyz(value: number): number {
  return value > 0.008856 ? Math.cbrt(value) : 7.787 * value + 16 / 116;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
