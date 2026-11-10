/**
 * UI derived from shadcn/ui Sonner (https://ui.shadcn.com/docs/components/radix/sonner) (MIT).
 * Project license: GNU Affero General Public License v3.0 or later (see LICENSE).
 */

"use client";

import type { ComponentProps, ReactElement } from "react";
import { Toaster as Sonner } from "sonner";

import { cn } from "../utils";

type ToasterProps = ComponentProps<typeof Sonner>;

export function Toaster({ className, toastOptions, ...props }: ToasterProps): ReactElement {
  return (
    <Sonner
      className={cn("toaster group", className)}
      toastOptions={{
        ...toastOptions,
        style: { border: 0, ...toastOptions?.style },
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          ...toastOptions?.classNames
        }
      }}
      {...props}
    />
  );
}
