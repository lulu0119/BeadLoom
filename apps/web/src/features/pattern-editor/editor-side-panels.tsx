"use client";

import type { ReactElement } from "react";
import { ArrowLeftRight, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { readableTextHexOnBackgroundHex, type PatternLegendItem } from "@beadloom/core";
import { cn, Tooltip, TooltipContent, TooltipTrigger } from "@beadloom/ui";
import {
  drawingColorChromeBorderColorWhenActiveClass,
  drawingColorChromeBorderColorWhenIdleClass,
  drawingColorChromeBorderWidthClass
} from "./active-drawing-color-chrome";
import { PaletteGrid } from "./palette-grid";

type EditorSidePanelsProps = {
  activeColor: string;
  onActiveColorChange: (code: string) => void;
  legend: PatternLegendItem[];
  paletteByCode: Map<string, { hex: string }>;
  onApplyReplace: (fromCode: string) => void;
  onApplyDelete: (fromCode: string) => void;
  showPaletteHeading?: boolean;
  className?: string;
};

export function EditorSidePanels({
  activeColor,
  onActiveColorChange,
  legend,
  paletteByCode,
  onApplyReplace,
  onApplyDelete,
  showPaletteHeading = true,
  className
}: EditorSidePanelsProps): ReactElement {
  const { t } = useTranslation();

  return (
    <div className={cn("flex min-h-0 min-w-0 flex-1 flex-col gap-[var(--chrome-gap)]", className)}>
      {legend.length > 0 ? (
        <section aria-label={t("sidePanels.legendAria")} className="shrink-0">
          <h2 className="text-muted-foreground mb-1.5 text-xs font-semibold uppercase tracking-wide">{t("sidePanels.usedInChart")}</h2>
          <div className="flex flex-wrap gap-1.5">
            {legend.map((item) => {
              const color = paletteByCode.get(item.code);
              const isActiveChip = activeColor === item.code;
              const swatchHex = color?.hex ?? "#ffffff";
              const codeOnSwatchColor = readableTextHexOnBackgroundHex(swatchHex);
              return (
                <div
                  className={cn(
                    "bg-card flex min-h-9 min-w-0 items-stretch overflow-hidden rounded-full shadow-sm transition",
                    drawingColorChromeBorderWidthClass,
                    isActiveChip ? drawingColorChromeBorderColorWhenActiveClass : drawingColorChromeBorderColorWhenIdleClass
                  )}
                  key={item.code}
                >
                  <Tooltip>
                    <TooltipTrigger
                      aria-label={t("sidePanels.legendSelect", { code: item.code, count: item.count })}
                      aria-pressed={isActiveChip}
                      className="border-border flex min-h-9 min-w-9 shrink-0 flex-col items-center justify-center gap-0 border-r px-1 py-0.5 text-center font-mono transition hover:brightness-[0.96] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                      style={{ backgroundColor: swatchHex, color: codeOnSwatchColor }}
                      type="button"
                      onClick={() => onActiveColorChange(item.code)}
                    >
                      <span className="text-xs font-bold tabular-nums tracking-wide">{item.code}</span>
                      <span className="text-[10px] font-semibold tabular-nums leading-none">{item.count}</span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      {t("sidePanels.legendSelect", { code: item.code, count: item.count })}
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger
                      aria-label={t("sidePanels.legendReplace", { fromCode: item.code, activeColor })}
                      className="border-border text-primary hover:bg-accent hover:text-accent-foreground inline-flex min-h-9 min-w-9 shrink-0 items-center justify-center border-r bg-card transition focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                      type="button"
                      onClick={() => onApplyReplace(item.code)}
                    >
                      <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      {t("sidePanels.legendReplaceTitle", { fromCode: item.code, activeColor })}
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger
                      aria-label={t("sidePanels.legendDelete", { fromCode: item.code })}
                      className="bg-card hover:bg-destructive/10 inline-flex min-h-9 min-w-9 shrink-0 items-center justify-center text-destructive transition focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                      type="button"
                      onClick={() => onApplyDelete(item.code)}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      {t("sidePanels.legendDeleteTitle", { fromCode: item.code })}
                    </TooltipContent>
                  </Tooltip>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <PaletteGrid
        activeColor={activeColor}
        className="w-full min-h-0"
        showHeading={showPaletteHeading}
        onSelectColor={onActiveColorChange}
      />
    </div>
  );
}
