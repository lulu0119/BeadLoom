import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nextProvider } from "react-i18next";
import { fetchProviders } from "@xsai-ext/providers/fetch";
import { opencodeGo } from "@xsai-ext/providers/models/opencode-go";
import { zhipuai } from "@xsai-ext/providers/models/zhipuai";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import i18n, { i18nInitialization } from "@/i18n/config";
import { resetAppStore, useAppStore } from "./app-store";
import { BeadloomApp } from "./beadloom-app";
import { LLM_SETTINGS_STORAGE_KEY } from "./llm-settings";

vi.mock("@xsai-ext/providers/fetch");

beforeAll(async () => {
  await i18nInitialization;
  await i18n.changeLanguage("en");
});

beforeEach(() => {
  localStorage.clear();
  resetAppStore();
  vi.mocked(fetchProviders).mockReset().mockResolvedValue({
    notModified: false,
    providers: { "opencode-go": opencodeGo, zhipuai }
  });
});

async function openSettings(): Promise<ReturnType<typeof userEvent.setup>> {
  const user = userEvent.setup();
  render(<I18nextProvider i18n={i18n}><BeadloomApp /></I18nextProvider>);
  await user.click(await screen.findByRole("button", { name: "Settings" }));
  await waitFor(() => expect(fetchProviders).toHaveBeenCalled());
  return user;
}

describe("model settings", () => {
  it("searches OpenCode Go and its models before an API key is entered", async () => {
    const user = await openSettings();
    expect(screen.getByLabelText("API key")).toHaveValue("");
    await user.click(screen.getByLabelText("Provider", { exact: true }));
    await user.type(await screen.findByPlaceholderText("Search providers…"), "opencode");
    await user.click(await screen.findByRole("option", { name: "OpenCode Go" }));
    await user.click(screen.getByLabelText("Model", { exact: true }));
    await user.type(await screen.findByPlaceholderText("Search models or enter an ID…"), "glm-5.3-flash");
    await user.keyboard("{ArrowDown}{Enter}");
    expect(useAppStore.getState().llm).toMatchObject({
      providerId: "opencode-go", model: "glm-5.3-flash", apiKey: ""
    });
    expect(screen.getByText(/models are hidden because their tools, protocol, or endpoint/i)).toBeInTheDocument();
  });

  it("keeps model choices after an endpoint override and clears keys when switching providers", async () => {
    const user = await openSettings();
    const baseURL = screen.getByLabelText("Base URL");
    const apiKey = screen.getByLabelText("API key");
    const model = screen.getByLabelText("Model", { exact: true });
    expect(baseURL.compareDocumentPosition(apiKey) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(apiKey.compareDocumentPosition(model) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await user.clear(baseURL);
    await user.type(baseURL, "https://proxy.test/v1/");
    await user.type(apiKey, "test-key");
    await user.click(model);
    await user.type(await screen.findByPlaceholderText("Search models or enter an ID…"), "glm-5.3");
    await user.click(await screen.findByRole("option", { name: "GLM-5.3" }));
    expect(useAppStore.getState().llm).toMatchObject({
      providerId: "zhipuai", baseURL: "https://proxy.test/v1/", model: "glm-5.3", apiKey: "test-key"
    });
    await user.click(screen.getByLabelText("Provider", { exact: true }));
    await user.type(await screen.findByPlaceholderText("Search providers…"), "opencode");
    await user.click(await screen.findByRole("option", { name: "OpenCode Go" }));
    expect(screen.getByLabelText("API key")).toHaveValue("");
  });

  it("saves a custom model when the public catalog is unavailable", async () => {
    vi.mocked(fetchProviders).mockRejectedValueOnce(new Error("Offline"));
    const user = await openSettings();
    expect(await screen.findByText(/catalog unavailable/i)).toBeInTheDocument();
    await user.click(screen.getByLabelText("Provider", { exact: true }));
    await user.click(await screen.findByRole("option", { name: "Custom OpenAI-compatible endpoint" }));
    const baseURL = screen.getByLabelText("Base URL");
    await user.clear(baseURL);
    await user.type(baseURL, "https://custom.test/v1/");
    await user.click(screen.getByLabelText("Model", { exact: true }));
    await user.type(await screen.findByPlaceholderText("Search models or enter an ID…"), "my-custom-model");
    await user.click(await screen.findByRole("option", { name: "my-custom-model" }));
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(JSON.parse(localStorage.getItem(LLM_SETTINGS_STORAGE_KEY) ?? "null")).toMatchObject({
      providerId: "", baseURL: "https://custom.test/v1/", model: "my-custom-model"
    });
  });

  it("explains a provider with no compatible models instead of hiding the provider", async () => {
    vi.mocked(fetchProviders).mockResolvedValueOnce({
      notModified: false,
      providers: {
        "messages-only": {
          ...opencodeGo,
          id: "messages-only",
          name: "Messages only",
          models: { "minimax-m3": opencodeGo.models["minimax-m3"] }
        }
      }
    });
    const user = await openSettings();
    await user.click(screen.getByLabelText("Provider", { exact: true }));
    await user.click(await screen.findByRole("option", { name: "Messages only" }));
    expect(screen.getByText(/compatible models: 0/i)).toBeInTheDocument();
    await user.click(screen.getByLabelText("Model", { exact: true }));
    expect(await screen.findByText(/no compatible models in the catalog/i)).toBeInTheDocument();
  });
});
