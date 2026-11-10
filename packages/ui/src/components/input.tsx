/**
 * UI derived from shadcn/ui (https://ui.shadcn.com/) generator output (MIT).
 * Project license: GNU Affero General Public License v3.0 or later (see LICENSE).
 */

import * as React from "react";
import { Input as InputPrimitive } from "@base-ui/react/input";

import { cn } from "../utils";
import { controlStyles } from "./control-styles";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        controlStyles,
        "w-full min-w-0 text-base file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground disabled:pointer-events-none md:text-sm",
        className
      )}
      {...props}
    />
  );
}

export { Input };
