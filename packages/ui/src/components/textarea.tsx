/**
 * UI derived from shadcn/ui (https://ui.shadcn.com/) generator output (MIT).
 * Project license: GNU Affero General Public License v3.0 or later (see LICENSE).
 */

import * as React from "react";
import { cn } from "../utils";
import { controlStyles } from "./control-styles";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        controlStyles,
        "flex field-sizing-content h-auto min-h-16 w-full text-base md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
