import { MAX_PATTERN_SIZE } from "@beadloom/core";

export const DEFAULT_CHART_SIZE = 32;

export function parseChartDimension(raw: string): number | null {
  if (!/^\d+$/.test(raw)) {
    return null;
  }
  const value = Number(raw);
  if (value < 1 || value > MAX_PATTERN_SIZE) {
    return null;
  }
  return value;
}
