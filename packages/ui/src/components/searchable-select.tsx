"use client";

import { useState, type ReactElement } from "react";
import { Combobox } from "@base-ui/react/combobox";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "../utils";
import { controlStyles } from "./control-styles";
import { Input } from "./input";

export type SearchableSelectOption = { value: string; label: string };

type SearchableSelectProps = {
  id: string;
  options: SearchableSelectOption[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  searchPlaceholder: string;
  emptyText: string;
  allowCustomValue?: boolean;
  "aria-label"?: string;
  className?: string;
};

export function SearchableSelect({
  id,
  options,
  value,
  onValueChange,
  placeholder,
  searchPlaceholder,
  emptyText,
  allowCustomValue = false,
  "aria-label": ariaLabel,
  className
}: SearchableSelectProps): ReactElement {
  const [search, setSearch] = useState("");
  const { contains } = Combobox.useFilter();
  const customValue = search.trim();
  const items = allowCustomValue && customValue && !options.some((item) => item.value === customValue)
    ? [...options, { value: customValue, label: customValue }]
    : options;
  const selected = options.find((item) => item.value === value) ?? (value ? { value, label: value } : null);

  return (
    <Combobox.Root
      items={items}
      value={selected}
      inputValue={search}
      onInputValueChange={setSearch}
      onOpenChange={() => setSearch("")}
      onValueChange={(item) => {
        if (item !== null) onValueChange(item.value);
      }}
      isItemEqualToValue={(item, current) => item.value === current.value}
      filter={(item, query) => contains(item.label, query) || contains(item.value, query)}
    >
      <Combobox.Trigger
        id={id}
        aria-label={ariaLabel}
        className={cn(controlStyles, "flex w-full items-center justify-between gap-2 font-normal", className)}
      >
        <span className="truncate">{selected?.label ?? placeholder}</span>
        <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
      </Combobox.Trigger>
      <Combobox.Portal>
        <Combobox.Positioner sideOffset={4} className="z-50">
          <Combobox.Popup className="w-(--anchor-width) max-h-(--available-height) overflow-hidden rounded-[var(--control-popup-radius)] bg-popover p-[var(--control-popup-pad)] text-popover-foreground shadow-md">
            <Combobox.Input
              render={<Input />}
              aria-label={searchPlaceholder}
              placeholder={searchPlaceholder}
              className="mb-2"
            />
            <Combobox.Empty>
              <div className="px-3 py-2 text-sm text-muted-foreground">{emptyText}</div>
            </Combobox.Empty>
            <Combobox.List className="max-h-[min(14rem,calc(var(--available-height)-4rem))] overflow-y-auto overscroll-contain">
              {(item: SearchableSelectOption) => (
                <Combobox.Item
                  key={item.value}
                  value={item}
                  className="flex min-h-9 cursor-default items-center gap-2 rounded-[var(--control-radius)] px-3 py-2 text-sm leading-5 outline-none data-highlighted:bg-accent data-highlighted:text-accent-foreground"
                >
                  <span className="min-w-0 flex-1 break-words">{item.label}</span>
                  <Combobox.ItemIndicator><Check className="size-4" /></Combobox.ItemIndicator>
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}
