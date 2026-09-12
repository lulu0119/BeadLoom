import { beforeEach, describe, expect, it, vi } from "vitest";

describe("i18n config", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it("initializes with English before applying stored browser language", async () => {
    localStorage.setItem("beadloom.language", "zh-CN");

    const { default: i18n, i18nInitialization } = await import("./config");
    await i18nInitialization;

    expect(i18n.resolvedLanguage).toBe("en");
    expect(i18n.t("meta.title")).toBe("BeadLoom");
  });
});
