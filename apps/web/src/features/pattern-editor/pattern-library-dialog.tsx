"use client";

import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { Copy, Download, ImageDown, Trash2, Upload } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { PatternDocument } from "@beadloom/core";
import { defaultPalette } from "@beadloom/palettes";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldLabel,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  cn
} from "@beadloom/ui";
import { createCanvasLayout, drawPatternCanvas } from "@/features/pattern-editor/pattern-editor-utils";
import type { PatternRecord } from "@/lib/pattern-storage";

/** Library thumbnail max edge length (px). */
const THUMBNAIL_MAX_EDGE_PX = 80;

function computeThumbnailZoom(pattern: PatternDocument): number {
  let low = 0.015;
  let high = 0.55;
  let best = low;
  for (let i = 0; i < 48; i += 1) {
    const mid = (low + high) / 2;
    const layout = createCanvasLayout(pattern, mid);
    if (layout.width <= THUMBNAIL_MAX_EDGE_PX && layout.height <= THUMBNAIL_MAX_EDGE_PX) {
      best = mid;
      low = mid;
    } else {
      high = mid;
    }
  }
  return best;
}

export type PatternLibrarySort = "updatedDesc" | "createdDesc" | "titleAsc";

export type PatternLibraryDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patterns: PatternRecord[];
  activePatternId: string | null;
  onOpenPattern: (patternId: string) => void;
  onRenamePattern: (patternId: string, title: string) => void;
  onDuplicatePattern: (patternId: string) => void;
  onDeletePattern: (patternId: string) => void;
  onImportJsonFile: (file: File) => void | Promise<void>;
  onExportJson: (patternId: string) => void;
  onExportPng: (patternId: string) => void;
  onNewChart: () => void;
};

function PatternThumbnail({ pattern }: { pattern: PatternDocument }): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const paletteByCode = useMemo(() => new Map(defaultPalette.map((color) => [color.code, color])), []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) {
      return;
    }
    const zoom = computeThumbnailZoom(pattern);
    const layout = createCanvasLayout(pattern, zoom);
    canvas.width = layout.width;
    canvas.height = layout.height;
    drawPatternCanvas(canvas, pattern, paletteByCode, layout, null, null);
    const fitScale = Math.min(
      1,
      THUMBNAIL_MAX_EDGE_PX / layout.width,
      THUMBNAIL_MAX_EDGE_PX / layout.height
    );
    canvas.style.width = `${Math.round(layout.width * fitScale)}px`;
    canvas.style.height = `${Math.round(layout.height * fitScale)}px`;
  }, [paletteByCode, pattern]);

  return <canvas className="border-primary/20 bg-card block shrink-0 rounded-lg border shadow-sm" ref={canvasRef} />;
}

export function PatternLibraryDialog({
  open,
  onOpenChange,
  patterns,
  activePatternId,
  onOpenPattern,
  onRenamePattern,
  onDuplicatePattern,
  onDeletePattern,
  onImportJsonFile,
  onExportJson,
  onExportPng,
  onNewChart
}: PatternLibraryDialogProps): ReactElement {
  const { t } = useTranslation();
  const importInputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<PatternLibrarySort>("updatedDesc");

  const filteredSorted = useMemo(() => {
    const needle = search.trim().toLowerCase();
    let list = needle.length === 0 ? [...patterns] : patterns.filter((record) => record.title.toLowerCase().includes(needle));
    list = [...list].sort((left, right) => {
      if (sort === "titleAsc") {
        return left.title.localeCompare(right.title, undefined, { sensitivity: "base" });
      }
      if (sort === "createdDesc") {
        return right.createdAt.localeCompare(left.createdAt);
      }
      return right.updatedAt.localeCompare(left.updatedAt);
    });
    return list;
  }, [patterns, search, sort]);

  const sortDisplayLabel = useMemo(() => {
    if (sort === "createdDesc") {
      return t("library.sortCreated");
    }
    if (sort === "titleAsc") {
      return t("library.sortTitle");
    }
    return t("library.sortUpdated");
  }, [sort, t]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(720px,90vh)] flex-col sm:max-w-2xl" closeLabel={t("dialog.close")}>
        <DialogHeader>
          <DialogTitle>{t("library.dialogTitle")}</DialogTitle>
          <DialogDescription>{t("library.dialogDescription")}</DialogDescription>
        </DialogHeader>

        <input
          accept="application/json,.json"
          className="hidden"
          ref={importInputRef}
          type="file"
          onChange={async () => {
            const input = importInputRef.current;
            const file = input?.files?.[0];
            if (file !== undefined) {
              await Promise.resolve(onImportJsonFile(file));
            }
            if (input !== null) {
              input.value = "";
            }
          }}
        />

        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <Field className="min-w-0 flex-1">
            <FieldLabel>{t("library.searchLabel")}</FieldLabel>
            <Input placeholder={t("library.searchPlaceholder")} value={search} onChange={(event) => setSearch(event.currentTarget.value)} />
          </Field>
          <Field className="w-full sm:w-48">
            <FieldLabel id="pattern-library-sort-label">{t("library.sortLabel")}</FieldLabel>
            <Select value={sort} onValueChange={(value) => setSort(value as PatternLibrarySort)}>
              <SelectTrigger
                aria-labelledby="pattern-library-sort-label"
                className="w-full max-w-full min-w-0"
                id="pattern-library-sort-trigger"
              >
                <SelectValue>{sortDisplayLabel}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="updatedDesc">{t("library.sortUpdated")}</SelectItem>
                <SelectItem value="createdDesc">{t("library.sortCreated")}</SelectItem>
                <SelectItem value="titleAsc">{t("library.sortTitle")}</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {filteredSorted.length === 0 ? (
            <p className="text-muted-foreground px-2 py-6 text-center text-sm">{t("library.emptyFiltered")}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {filteredSorted.map((record) => (
                <li
                  className={cn(
                    "flex flex-col gap-3 rounded-[var(--dialog-inner-radius)] border p-3 shadow-sm",
                    record.id === activePatternId
                      ? "border-primary/40 bg-primary/10"
                      : "border-primary/15 bg-card/55 backdrop-blur-md"
                  )}
                  key={record.id}
                >
                  <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start">
                    <div className="shrink-0">
                      <PatternThumbnail pattern={record.pattern} />
                    </div>
                    <div className="min-w-0 flex-1 space-y-2">
                      <Input
                        aria-label={t("library.renameAria", { title: record.title })}
                        className="font-medium"
                        value={record.title}
                        onChange={(event) => onRenamePattern(record.id, event.currentTarget.value)}
                      />
                      <p className="text-muted-foreground text-xs break-words">
                        {t("library.metaLine", {
                          updated: new Date(record.updatedAt).toLocaleString(),
                          created: new Date(record.createdAt).toLocaleString()
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="border-border flex flex-wrap gap-2 border-t pt-3">
                    <Button size="sm" type="button" variant="default" onClick={() => onOpenPattern(record.id)}>
                      {t("library.open")}
                    </Button>
                    <Button size="sm" type="button" variant="outline" onClick={() => onDuplicatePattern(record.id)}>
                      <Copy className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                      {t("library.duplicate")}
                    </Button>
                    <Button
                      size="sm"
                      type="button"
                      variant="outline"
                      aria-label={t("library.exportImageHint")}
                      title={t("library.exportImageHint")}
                      onClick={() => onExportPng(record.id)}
                    >
                      <ImageDown className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                      {t("library.exportPng")}
                    </Button>
                    <Button
                      size="sm"
                      type="button"
                      variant="outline"
                      aria-label={t("library.exportFileHint")}
                      title={t("library.exportFileHint")}
                      onClick={() => onExportJson(record.id)}
                    >
                      <Download className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                      {t("library.exportJson")}
                    </Button>
                    <Button
                      size="sm"
                      type="button"
                      variant="destructive"
                      onClick={() => {
                        if (window.confirm(t("library.confirmDelete"))) {
                          onDeletePattern(record.id);
                        }
                      }}
                    >
                      <Trash2 className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                      {t("library.delete")}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                onNewChart();
              }}
            >
              {t("library.newChart")}
            </Button>
            <Button
              type="button"
              variant="outline"
              title={t("library.importSavedHint")}
              onClick={() => {
                importInputRef.current?.click();
              }}
            >
              <Upload className="mr-2 h-4 w-4" aria-hidden="true" />
              {t("library.importJson")}
            </Button>
          </div>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            {t("library.done")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
