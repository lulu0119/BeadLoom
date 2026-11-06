"use client";

import { useEffect, useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { Field, FieldLabel } from "@beadloom/ui";
import { z } from "zod";
import { useAppStore } from "./app-store";

const modelSchema = z.object({ id: z.string(), name: z.string(), tool_call: z.boolean().optional() });
const providerSchema = z.object({
  id: z.string(),
  name: z.string(),
  api: z.string().optional(),
  npm: z.string().optional(),
  models: z.record(z.string(), modelSchema)
});
const catalogSchema = z.record(z.string(), providerSchema);
type CatalogProvider = z.infer<typeof providerSchema>;
const chatProtocols = new Set(["@ai-sdk/openai", "@ai-sdk/openai-compatible", "@openrouter/ai-sdk-provider"]);

export function ModelCatalog(): ReactElement {
  const { t } = useTranslation();
  const llm = useAppStore((state) => state.llm);
  const update = useAppStore((state) => state.updateLlmField);
  const [providers, setProviders] = useState<CatalogProvider[]>([]);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch("https://models.dev/api.json", {
          signal: controller.signal,
          credentials: "omit"
        });
        if (!response.ok) throw new Error("Catalog unavailable");
        const catalog = catalogSchema.parse(await response.json());
        if (!controller.signal.aborted)
          setProviders(
            Object.values(catalog)
              .filter((provider) => provider.npm !== undefined && chatProtocols.has(provider.npm))
              .sort((a, b) => a.name.localeCompare(b.name))
          );
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      }
    })();
    return () => controller.abort();
  }, []);
  const selected = providers.find((provider) => provider.id === llm.providerId);
  return (
    <div className="grid gap-2">
      <Field>
        <FieldLabel htmlFor="llm-provider">{t("settings.provider")}</FieldLabel>
        <select
          id="llm-provider"
          className="border-input bg-background h-9 rounded-md border px-3 text-sm"
          value={llm.providerId ?? ""}
          onChange={(event) => {
            const provider = providers.find((entry) => entry.id === event.currentTarget.value);
            if (provider === undefined) {
              update({ providerId: "" });
              return;
            }
            const model = Object.values(provider.models).find((entry) => entry.tool_call === true);
            update({
              providerId: provider.id,
              baseURL: provider.api ?? "",
              model: model?.id ?? Object.keys(provider.models)[0] ?? "",
              apiKey: provider.id === llm.providerId ? llm.apiKey : ""
            });
          }}
        >
          <option value="">{t("settings.customProvider")}</option>
          {providers.map((provider) => (
            <option key={provider.id} value={provider.id}>
              {provider.name}
            </option>
          ))}
        </select>
      </Field>
      <p className="text-muted-foreground text-xs">
        {t(failed ? "settings.catalogFailed" : "settings.catalogHint")}{" "}
        <a className="underline" href="https://models.dev" target="_blank" rel="noreferrer">
          Models.dev
        </a>
      </p>
      <datalist id="llm-model-catalog">
        {Object.values(selected?.models ?? {})
          .filter((model) => model.tool_call !== false)
          .map((model) => (
            <option key={model.id} value={model.id}>
              {model.name}
            </option>
          ))}
      </datalist>
    </div>
  );
}
