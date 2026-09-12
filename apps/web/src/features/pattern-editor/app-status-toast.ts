import type { TFunction } from "i18next";
import { toast } from "sonner";

import { hiddenStatusStripMessageKey, type AppStatusMessage } from "./app-status-message";

export function showAppStatusToast(translate: TFunction, message: AppStatusMessage): void {
  if (message.key === hiddenStatusStripMessageKey) {
    return;
  }
  const text = translate(message.key, message.params as Record<string, unknown>);
  if (message.tone === "accent") {
    toast.error(text);
    return;
  }
  toast(text);
}
