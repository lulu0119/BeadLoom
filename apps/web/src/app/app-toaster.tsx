"use client";

import type { ReactElement } from "react";
import { Toaster } from "@beadloom/ui";

export function AppToaster(): ReactElement {
  return <Toaster richColors closeButton position="top-center" />;
}
