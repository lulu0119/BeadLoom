"use client";

import type { FocusEvent, KeyboardEvent, ReactElement } from "react";
import { Input } from "@beadloom/ui";

type ChartSizeGroupProps = {
  widthValue: string;
  heightValue: string;
  widthLabel: string;
  heightLabel: string;
  groupLabel: string;
  onWidthChange: (value: string) => void;
  onHeightChange: (value: string) => void;
  onCommit?: () => void;
};

export function ChartSizeGroup({
  widthValue,
  heightValue,
  widthLabel,
  heightLabel,
  groupLabel,
  onWidthChange,
  onHeightChange,
  onCommit
}: ChartSizeGroupProps): ReactElement {
  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === "Enter" && onCommit !== undefined) {
      event.currentTarget.blur();
    }
  }

  function handleGroupBlur(event: FocusEvent<HTMLDivElement>): void {
    if (onCommit === undefined) {
      return;
    }
    const next = event.relatedTarget;
    if (next instanceof Node && event.currentTarget.contains(next)) {
      return;
    }
    onCommit();
  }

  return (
    <div className="flex h-8 items-center" onBlur={handleGroupBlur}>
      <div
        aria-label={groupLabel}
        className="bg-secondary flex h-8 items-stretch overflow-hidden rounded-full px-1 tabular-nums backdrop-blur-md"
        role="group"
      >
        <Input
          aria-label={widthLabel}
          className="h-8 w-10 rounded-none border-0 bg-transparent px-0.5 text-center text-xs font-semibold shadow-none focus-visible:ring-0 md:text-xs"
          inputMode="numeric"
          value={widthValue}
          onChange={(event) => onWidthChange(event.currentTarget.value)}
          onKeyDown={handleKeyDown}
        />
        <span aria-hidden className="text-muted-foreground flex h-8 items-center px-0.5 text-xs">
          ×
        </span>
        <Input
          aria-label={heightLabel}
          className="h-8 w-10 rounded-none border-0 bg-transparent px-0.5 text-center text-xs font-semibold shadow-none focus-visible:ring-0 md:text-xs"
          inputMode="numeric"
          value={heightValue}
          onChange={(event) => onHeightChange(event.currentTarget.value)}
          onKeyDown={handleKeyDown}
        />
      </div>
    </div>
  );
}
