"use client";

import { useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@beadloom/ui";
import { DEFAULT_CHART_SIZE, parseChartDimension } from "./chart-size";
import { ChartSizeGroup } from "./chart-size-group";

type ChartWelcomeProps = {
  canCancel: boolean;
  onCancel: () => void;
  onStartBlank: (width: number, height: number) => void;
};

export function ChartWelcome({ canCancel, onCancel, onStartBlank }: ChartWelcomeProps): ReactElement {
  const { t } = useTranslation();
  const [widthDraft, setWidthDraft] = useState(String(DEFAULT_CHART_SIZE));
  const [heightDraft, setHeightDraft] = useState(String(DEFAULT_CHART_SIZE));

  function resolvedSize(): { width: number; height: number } | null {
    const width = parseChartDimension(widthDraft);
    const height = parseChartDimension(heightDraft);
    if (width === null || height === null) {
      return null;
    }
    return { width, height };
  }

  function handleCreate(): void {
    const size = resolvedSize();
    if (size === null) {
      return;
    }
    onStartBlank(size.width, size.height);
  }

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center px-[var(--chrome-inset)] pt-[var(--chrome-below-header)] pb-[var(--chrome-inset)]">
      <div className="glass-panel w-full max-w-lg rounded-[var(--chrome-radius)] p-6">
        <h2 className="text-xl font-semibold tracking-tight">{t("welcome.title")}</h2>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{t("welcome.description")}</p>
        <div className="mt-5">
          <ChartSizeGroup
            groupLabel={t("sizeChip.aria")}
            heightLabel={t("sizeChip.height")}
            heightValue={heightDraft}
            widthLabel={t("sizeChip.width")}
            widthValue={widthDraft}
            onHeightChange={setHeightDraft}
            onWidthChange={setWidthDraft}
          />
        </div>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Button type="button" onClick={handleCreate}>
            {t("welcome.createBlank")}
          </Button>
          {canCancel ? (
            <Button type="button" variant="ghost" onClick={onCancel}>
              {t("welcome.cancel")}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
