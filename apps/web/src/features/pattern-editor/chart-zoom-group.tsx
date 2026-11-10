"use client";

import type { ReactElement } from "react";
import { ZoomIn, ZoomOut } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from "@beadloom/ui";
import { CHART_ZOOM_STEPS, snapZoomToChartStep, stepChartZoom } from "./pattern-editor-utils";

type ChartZoomGroupProps = {
  zoom: number;
  onZoomChange: (zoom: number) => void;
};

export function ChartZoomGroup({ zoom, onZoomChange }: ChartZoomGroupProps): ReactElement {
  const { t } = useTranslation();

  return (
    <div
      aria-label={t("workspace.magnificationControls")}
      className="bg-secondary inline-flex h-8 shrink-0 items-center overflow-hidden rounded-full px-0.5 text-xs font-semibold tabular-nums backdrop-blur-md"
      role="group"
    >
      <Tooltip>
        <TooltipTrigger
          aria-label={t("workspace.zoomOut")}
          className="text-muted-foreground hover:bg-accent hover:text-accent-foreground inline-flex size-7 shrink-0 items-center justify-center rounded-full p-0 transition focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-40"
          disabled={snapZoomToChartStep(zoom) <= CHART_ZOOM_STEPS[0]!}
          type="button"
          onClick={() => onZoomChange(stepChartZoom(zoom, -1))}
        >
          <ZoomOut className="size-3.5 shrink-0" aria-hidden="true" />
        </TooltipTrigger>
        <TooltipContent side="bottom">{t("workspace.zoomOutTooltip")}</TooltipContent>
      </Tooltip>
      <Select
        value={zoom}
        onValueChange={(value) => {
          if (value !== null) onZoomChange(value);
        }}
      >
        <SelectTrigger
          aria-label={t("workspace.chartZoom")}
          size="sm"
          className="min-w-12 shrink-0 bg-transparent px-1 text-xs font-semibold inset-ring-0"
        >
          <SelectValue>{Math.round(zoom * 100)}%</SelectValue>
        </SelectTrigger>
        <SelectContent className="w-max min-w-(--anchor-width)" alignItemWithTrigger={false}>
          {CHART_ZOOM_STEPS.map((step) => (
            <SelectItem key={step} value={step}>
              {Math.round(step * 100)}%
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Tooltip>
        <TooltipTrigger
          aria-label={t("workspace.zoomIn")}
          className="text-muted-foreground hover:bg-accent hover:text-accent-foreground inline-flex size-7 shrink-0 items-center justify-center rounded-full p-0 transition focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-40"
          disabled={snapZoomToChartStep(zoom) >= CHART_ZOOM_STEPS[CHART_ZOOM_STEPS.length - 1]!}
          type="button"
          onClick={() => onZoomChange(stepChartZoom(zoom, 1))}
        >
          <ZoomIn className="size-3.5 shrink-0" aria-hidden="true" />
        </TooltipTrigger>
        <TooltipContent side="bottom">{t("workspace.zoomInTooltip")}</TooltipContent>
      </Tooltip>
    </div>
  );
}
