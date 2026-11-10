"use client";

import { useEffect, useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { Field, FieldLabel, Input, SearchableSelect } from "@beadloom/ui";
import { route, type Model, type Provider } from "@xsai-ext/providers";
import { fetchProviders } from "@xsai-ext/providers/fetch";
import { useAppStore } from "./app-store";

function chatModels(provider?: Provider): Model[] {
  return Object.values(provider?.models ?? {}).filter(
    (model) =>
      model.capabilities.tools.supported &&
      model.routes.chat !== undefined &&
      !model.routes.chat.variables?.length &&
      model.routes.chat.path === undefined
  );
}

export function LlmSettingsForm(): ReactElement {
  const { t } = useTranslation();
  const llm = useAppStore((state) => state.llm);
  const update = useAppStore((state) => state.updateLlmField);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  useEffect(() => {
    const controller = new AbortController();
    void fetchProviders({ signal: controller.signal })
      .then((result) => {
        if (controller.signal.aborted) return;
        if (!result.notModified)
          setProviders(Object.values(result.providers).sort((a, b) => a.name.localeCompare(b.name)));
        setStatus("ready");
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatus("error");
      });
    return () => controller.abort();
  }, []);
  const selected = providers.find((provider) => provider.id === llm.providerId);
  const models = chatModels(selected);
  const hiddenModels = Object.keys(selected?.models ?? {}).length - models.length;
  return (
    <div className="grid gap-3">
      <Field>
        <FieldLabel htmlFor="llm-provider">{t("settings.provider")}</FieldLabel>
        <SearchableSelect
          id="llm-provider"
          options={[
            { value: "", label: t("settings.customProvider") },
            ...providers.map((provider) => ({ value: provider.id, label: provider.name }))
          ]}
          value={llm.providerId ?? ""}
          placeholder={t("settings.customProvider")}
          searchPlaceholder={t("settings.searchProviders")}
          emptyText={t("settings.noProviders")}
          onValueChange={(providerId) => {
            if (providerId === llm.providerId) return;
            const provider = providers.find((entry) => entry.id === providerId);
            const model = chatModels(provider)[0];
            if (provider === undefined) {
              update({ providerId: "", apiKey: "" });
              return;
            }
            update({
              providerId: provider.id,
              baseURL: model ? route(provider, model.id, ["chat"]).baseURL : "",
              model: model?.id ?? "",
              apiKey: ""
            });
          }}
        />
      </Field>
      <p role="status" className="text-muted-foreground text-xs">
        {status === "loading" && t("settings.catalogLoading")}
        {status === "error" && t("settings.catalogFailed")}
        {status === "ready" && t("settings.catalogHint")}{" "}
        <a className="underline" href="https://models.dev" target="_blank" rel="noreferrer">
          Models.dev
        </a>
      </p>
      <Field>
        <FieldLabel htmlFor="llm-base">{t("settings.baseURL")}</FieldLabel>
        <Input
          id="llm-base"
          value={llm.baseURL}
          onChange={(event) => update({ baseURL: event.currentTarget.value })}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="llm-key">{t("settings.apiKey")}</FieldLabel>
        <Input
          id="llm-key"
          type="password"
          value={llm.apiKey}
          onChange={(event) => update({ apiKey: event.currentTarget.value })}
        />
        <p className="text-muted-foreground text-xs">{t("settings.apiKeyHint")}</p>
      </Field>
      <Field>
        <FieldLabel htmlFor="llm-model">{t("settings.model")}</FieldLabel>
        <SearchableSelect
          id="llm-model"
          options={models.map((model) => ({ value: model.id, label: model.name }))}
          value={llm.model}
          placeholder={t("settings.selectModel")}
          searchPlaceholder={t("settings.searchModels")}
          emptyText={t("settings.noModels")}
          allowCustomValue
          onValueChange={(model) => {
            const currentBaseURL = selected?.models[llm.model]?.routes.chat?.baseURL;
            const followsCatalog = currentBaseURL !== undefined &&
              llm.baseURL.replace(/\/+$/, "") === currentBaseURL.replace(/\/+$/, "");
            const nextModel = models.find((entry) => entry.id === model);
            update({
              model,
              ...(followsCatalog && selected && nextModel
                ? { baseURL: route(selected, model, ["chat"]).baseURL }
                : {})
            });
          }}
        />
        {status === "ready" && selected && (
          <p className="text-muted-foreground text-xs">
            {t("settings.modelCount", { count: models.length })}{" "}
            {hiddenModels > 0 && t("settings.catalogLimited", { count: hiddenModels })}
          </p>
        )}
      </Field>
    </div>
  );
}
