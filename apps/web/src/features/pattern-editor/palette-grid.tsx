"use client";

import { useId, useMemo, useState } from "react";
import type { ReactElement } from "react";
import { ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { defaultPalette, type BeadColor } from "@beadloom/palettes";
import { readableTextHexOnBackgroundHex } from "@beadloom/core";
import { cn } from "@beadloom/ui";
import {
  drawingColorChromeBorderColorWhenActiveClass,
  drawingColorChromeBorderColorWhenIdleClass,
  drawingColorChromeBorderWidthClass
} from "./active-drawing-color-chrome";

function beadCodeLetterPrefix(code: string): string {
  const match = /^([A-Za-z]+)/.exec(code);
  return match !== null ? match[1] : "";
}

/** Digits after the letter prefix, e.g. `A10` → 10, `ZG1` → 1. Missing / invalid → 0 for sort stability. */
function beadCodeTrailingNumber(code: string): number {
  const match = /^[A-Za-z]+(\d+)$/.exec(code);
  if (match === null) {
    return 0;
  }
  return Number(match[1]);
}

function sortBeadColorsByCodeNumber(colors: readonly BeadColor[]): BeadColor[] {
  return [...colors].sort((left, right) => {
    const numberDelta = beadCodeTrailingNumber(left.code) - beadCodeTrailingNumber(right.code);
    if (numberDelta !== 0) {
      return numberDelta;
    }
    return left.code.localeCompare(right.code, undefined, { sensitivity: "base", numeric: true });
  });
}

function buildPaletteLetterGroups(palette: readonly BeadColor[]): { prefix: string; colors: BeadColor[] }[] {
  const bucket = new Map<string, BeadColor[]>();
  const prefixOrder: string[] = [];

  for (const color of palette) {
    const prefix = beadCodeLetterPrefix(color.code);
    if (!bucket.has(prefix)) {
      bucket.set(prefix, []);
      prefixOrder.push(prefix);
    }
    bucket.get(prefix)!.push(color);
  }

  return [...prefixOrder]
    .sort((left, right) => left.localeCompare(right, undefined, { sensitivity: "base" }))
    .map((prefix) => ({
      prefix,
      colors: sortBeadColorsByCodeNumber(bucket.get(prefix) ?? [])
    }));
}

type PaletteGridProps = {
  activeColor: string;
  onSelectColor: (code: string) => void;
  className?: string;
  showHeading?: boolean;
};

export function PaletteGrid({
  activeColor,
  onSelectColor,
  className,
  showHeading = true
}: PaletteGridProps): ReactElement {
  const { t } = useTranslation();
  const panelIdPrefix = useId().replaceAll(":", "");
  const letterGroups = useMemo(() => buildPaletteLetterGroups(defaultPalette), []);
  const [expandedPrefixes, setExpandedPrefixes] = useState<Set<string>>(() => new Set());

  function togglePrefix(prefix: string): void {
    setExpandedPrefixes((previous) => {
      const next = new Set(previous);
      if (next.has(prefix)) {
        next.delete(prefix);
      } else {
        next.add(prefix);
      }
      return next;
    });
  }

  const groupsList = (
    <div className="flex flex-col">
      {letterGroups.map(({ prefix, colors }) => {
        const isExpanded = expandedPrefixes.has(prefix);
        const firstColor = colors[0];
        const panelId = `${panelIdPrefix}-palette-group-${prefix}`;

        return (
          <div className="min-w-0" key={prefix}>
            <button
              aria-controls={panelId}
              aria-expanded={isExpanded}
              className="hover:bg-muted flex w-full items-center gap-2 py-1.5 pl-0.5 pr-1 text-left leading-snug transition focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
              type="button"
              onClick={() => togglePrefix(prefix)}
            >
              <ChevronRight
                aria-hidden="true"
                className={cn("text-muted-foreground h-4 w-4 shrink-0 transition-transform", isExpanded && "rotate-90")}
              />
              <span className="text-foreground font-mono text-sm font-bold tracking-wide">{prefix}</span>
              <span className="text-muted-foreground text-[10px] font-medium tabular-nums">{colors.length}</span>
              {firstColor !== undefined ? (
                <span
                  aria-hidden="true"
                  className="border-border ml-auto h-5 w-5 shrink-0 rounded-sm border"
                  style={{ backgroundColor: firstColor.hex }}
                  title={t("defaultPalette.firstInGroup", { code: firstColor.code })}
                />
              ) : null}
            </button>

            {isExpanded ? (
              <div className="pb-1.5 pl-0.5 pt-0.5" id={panelId}>
                <div
                  className="grid auto-rows-max gap-1"
                  style={{
                    gridTemplateColumns: "repeat(auto-fill, minmax(2.25rem, 1fr))"
                  }}
                >
                  {colors.map((color) => {
                    const isActive = activeColor === color.code;
                    const labelColor = readableTextHexOnBackgroundHex(color.hex);
                    return (
                      <button
                        aria-label={t("defaultPalette.selectColor", { code: color.code })}
                        aria-pressed={isActive}
                        className={cn(
                          "flex aspect-square min-h-0 min-w-0 flex-col items-center justify-center overflow-hidden rounded-md px-1 py-0.5 text-center font-mono text-xs font-bold tracking-wide transition hover:brightness-[0.96] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-ring",
                          drawingColorChromeBorderWidthClass,
                          isActive ? drawingColorChromeBorderColorWhenActiveClass : drawingColorChromeBorderColorWhenIdleClass
                        )}
                        key={color.code}
                        style={{
                          backgroundColor: color.hex,
                          color: labelColor
                        }}
                        type="button"
                        onClick={() => onSelectColor(color.code)}
                      >
                        <span className="block min-w-0 max-w-full truncate">{color.code}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );

  return (
    <section aria-label={t("defaultPalette.sectionLabel")} className={cn("flex w-full shrink-0 flex-col", className)}>
      {showHeading ? (
        <h2 className="text-muted-foreground mb-1.5 shrink-0 text-xs font-semibold uppercase tracking-wide">{t("defaultPalette.heading")}</h2>
      ) : null}
      {groupsList}
    </section>
  );
}
