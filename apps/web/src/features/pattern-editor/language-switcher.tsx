"use client";

import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { LANGUAGE_STORAGE_KEY } from "@/i18n/config";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@beadloom/ui";

export function LanguageSwitcher(): ReactElement {
  const { i18n, t } = useTranslation();

  const resolvedLanguage = i18n.resolvedLanguage ?? i18n.language ?? "en";

  return (
    <Select
      value={resolvedLanguage.startsWith("zh") ? "zh" : "en"}
      onValueChange={(value) => {
        if (value === "en" || value === "zh") {
          window.localStorage.setItem(LANGUAGE_STORAGE_KEY, value);
          void i18n.changeLanguage(value);
        }
      }}
    >
      <SelectTrigger
        aria-label={t("languageSwitcher.ariaLabel")}
        className="w-full min-w-0"
      >
        <SelectValue>
          {(value: string | null) => {
            if (value === "zh") {
              return t("languageSwitcher.chinese");
            }
            if (value === "en") {
              return t("languageSwitcher.english");
            }
            return "";
          }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent align="end">
        <SelectItem value="en">{t("languageSwitcher.english")}</SelectItem>
        <SelectItem value="zh">{t("languageSwitcher.chinese")}</SelectItem>
      </SelectContent>
    </Select>
  );
}
