import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nextProvider } from "react-i18next";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AppToaster } from "@/app/app-toaster";
import i18n, { i18nInitialization, LANGUAGE_STORAGE_KEY } from "@/i18n/config";
import { PATTERN_LIBRARY_STORAGE_KEY } from "@/lib/pattern-storage";
import { resetAppStore } from "./app-store";
import { BeadloomApp } from "./beadloom-app";

const patternCanvasMockContexts: Array<{ font: string }> = [];

function renderApp(): ReturnType<typeof render> {
  return render(
    <I18nextProvider i18n={i18n}>
      <>
        <BeadloomApp />
        <AppToaster />
      </>
    </I18nextProvider>
  );
}

async function enterBlankChart(): Promise<void> {
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: /create blank chart/i }));
  expect(await screen.findByLabelText(/editable bead pattern/i)).toBeInTheDocument();
}

function stubDesktopViewport(matches: boolean): void {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: matches && query.includes("768"),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn()
    })
  });
}

describe("BeadLoom editor shell", () => {
  beforeAll(async () => {
    await i18nInitialization;
  });

  beforeEach(async () => {
    localStorage.removeItem(LANGUAGE_STORAGE_KEY);
    localStorage.removeItem(PATTERN_LIBRARY_STORAGE_KEY);
    resetAppStore();
    await i18n.changeLanguage("en");
    patternCanvasMockContexts.length = 0;
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      value: vi.fn(getCanvasContext)
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("opens on a blank-chart welcome instead of an empty board", async () => {
    renderApp();

    expect(await screen.findByRole("heading", { name: /new chart/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create blank chart/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/editable bead pattern/i)).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/what should we draw/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /choose a photo/i })).not.toBeInTheDocument();
  });

  it("creates a blank chart and shows separate width and height fields without apply", async () => {
    renderApp();
    await enterBlankChart();

    expect(screen.getByRole("textbox", { name: /^width$/i })).toHaveValue("32");
    expect(screen.getByRole("textbox", { name: /^height$/i })).toHaveValue("32");
    expect(screen.queryByRole("button", { name: /^apply$/i })).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText(/what should we draw/i)).toBeInTheDocument();
    expect(screen.queryByText(/drop a photo here/i)).not.toBeInTheDocument();
  });

  it("creates a non-square chart from independent width and height", async () => {
    const user = userEvent.setup();
    renderApp();
    await screen.findByRole("heading", { name: /new chart/i });

    const width = screen.getByRole("textbox", { name: /^width$/i });
    const height = screen.getByRole("textbox", { name: /^height$/i });
    await user.clear(width);
    await user.type(width, "48");
    await user.clear(height);
    await user.type(height, "16");
    await user.click(screen.getByRole("button", { name: /create blank chart/i }));

    expect(await screen.findByLabelText(/editable bead pattern/i)).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /^width$/i })).toHaveValue("48");
    expect(screen.getByRole("textbox", { name: /^height$/i })).toHaveValue("16");
  });

  it("attaches a reference photo in chat without changing chart size", async () => {
    const user = userEvent.setup();
    renderApp();
    await enterBlankChart();

    const fileInput = document.querySelector('input[type="file"][accept="image/*"]');
    expect(fileInput).not.toBeNull();
    await user.upload(fileInput as HTMLInputElement, new File(["demo"], "octopus.png", { type: "image/png" }));

    expect(screen.getByText("octopus.png")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /^width$/i })).toHaveValue("32");
    expect(screen.getByRole("textbox", { name: /^height$/i })).toHaveValue("32");
    expect(screen.queryByRole("dialog", { name: /create chart from photo/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /generate pattern/i })).not.toBeInTheDocument();
  });

  it("changes the active toolbar tool", async () => {
    const user = userEvent.setup();
    renderApp();
    await enterBlankChart();
    await user.click(screen.getByRole("button", { name: /paint bucket/i }));

    expect(screen.getByRole("button", { name: /paint bucket/i })).toHaveAttribute("aria-current", "true");
    expect(screen.queryByTestId("chart-tool-hud")).not.toBeInTheDocument();
    expect(screen.queryByTestId("chart-drawing-color-select")).not.toBeInTheDocument();
  });

  it("includes the eyedropper tool in the rail", async () => {
    const user = userEvent.setup();
    renderApp();
    await enterBlankChart();
    await user.click(screen.getByRole("button", { name: /^eyedropper$/i }));

    expect(screen.getByRole("button", { name: /^eyedropper$/i })).toHaveAttribute("aria-current", "true");
  });

  it("uses a tool-specific chart cursor", async () => {
    renderApp();
    await enterBlankChart();
    expect(screen.getByLabelText(/editable bead pattern/i)).toHaveClass("cursor-grab");
  });

  it("paints with the palette and shows a legend badge", async () => {
    const user = userEvent.setup();
    renderApp();
    await enterBlankChart();

    await user.click(screen.getByRole("button", { name: /paint bucket/i }));
    fireEvent.click(screen.getByLabelText(/editable bead pattern/i), { clientX: 85, clientY: 50 });

    expect(await screen.findAllByLabelText(/legend badges/i)).not.toHaveLength(0);
    expect(screen.queryByText(/drop a photo here/i)).not.toBeInTheDocument();
  });

  it("steps chart zoom when zoom out and zoom in buttons are clicked", async () => {
    const user = userEvent.setup();
    renderApp();
    await enterBlankChart();
    await waitFor(() => expect(patternCanvasMockContexts.length).toBeGreaterThan(0));
    const fontAt100 = patternCanvasMockContexts.at(-1)!.font;

    await user.click(screen.getByRole("button", { name: /^zoom out$/i }));
    await waitFor(() => {
      expect(patternCanvasMockContexts.at(-1)!.font).not.toEqual(fontAt100);
    });
  });

  it("opens the library from the header and can start a new chart there", async () => {
    const user = userEvent.setup();
    renderApp();
    await enterBlankChart();

    await user.click(screen.getByRole("button", { name: /saved charts/i }));
    expect(await screen.findByRole("dialog", { name: /pattern library/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /import chart file/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^new chart$/i }));
    expect(await screen.findByRole("heading", { name: /new chart/i })).toBeInTheDocument();
  });

  it("persists the pattern library after first paint", async () => {
    renderApp();
    await waitFor(() => {
      const raw = localStorage.getItem(PATTERN_LIBRARY_STORAGE_KEY);
      expect(raw).not.toBeNull();
      expect(raw!).toContain('"patterns"');
      expect(raw!).toContain('"activePatternId"');
    });
  });

  it("stores selected language in localStorage", async () => {
    const user = userEvent.setup();
    renderApp();
    await screen.findByRole("heading", { name: /new chart/i });
    await user.click(screen.getByRole("button", { name: /settings/i }));
    await user.click(screen.getByRole("combobox", { name: /language/i }));
    await user.click(await screen.findByRole("option", { name: /中文/i }));
    await waitFor(() => expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("zh"));
  });

  it("shows the Chinese product name when language is Chinese", async () => {
    await i18n.changeLanguage("zh");
    renderApp();
    expect(await screen.findByRole("heading", { level: 1, name: "豆织工坊" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /新建图纸/ })).toBeInTheDocument();
  });

  it("keeps the initial browser render in English when Chinese is stored", () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, "zh-CN");
    renderApp();
    expect(screen.getByRole("heading", { level: 1, name: "BeadLoom" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "BeadLoom logo" })).toBeInTheDocument();
  });

  it("shows the palette as a desktop sidebar instead of a drawer", async () => {
    stubDesktopViewport(true);
    renderApp();
    await enterBlankChart();

    expect(screen.getByRole("complementary", { name: /^palette$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^palette$/i })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: /^palette$/i })).not.toBeInTheDocument();
  });

  it("folds the desktop palette sidebar from the tool rail", async () => {
    stubDesktopViewport(true);
    const user = userEvent.setup();
    renderApp();
    await enterBlankChart();

    await user.click(screen.getByRole("button", { name: /dismiss palette/i }));
    expect(screen.queryByRole("complementary", { name: /^palette$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: /^palette$/i })).not.toBeInTheDocument();
  });

  it("folds chat from the tool rail", async () => {
    stubDesktopViewport(true);
    const user = userEvent.setup();
    renderApp();
    await enterBlankChart();

    expect(screen.getByPlaceholderText(/what should we draw/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /hide chat/i }));
    expect(screen.queryByPlaceholderText(/what should we draw/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /show chat/i }));
    expect(screen.getByPlaceholderText(/what should we draw/i)).toBeInTheDocument();
  });

  it("accepts an API key typed into settings", async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(await screen.findByRole("button", { name: /settings/i }));
    const apiKey = screen.getByLabelText(/api key/i);
    await user.type(apiKey, "sk-test");
    expect(apiKey).toHaveValue("sk-test");
  });
});

function getCanvasContext(contextId: "2d"): CanvasRenderingContext2D | null;
function getCanvasContext(contextId: string): CanvasRenderingContext2D | null {
  if (contextId !== "2d") {
    return null;
  }
  const context = {
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    fillText: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    setLineDash: vi.fn(),
    setTransform: vi.fn(),
    drawImage: vi.fn(),
    getImageData: vi.fn(),
    imageSmoothingEnabled: false,
    fillStyle: "",
    font: "",
    globalAlpha: 1,
    lineWidth: 1,
    strokeStyle: "",
    textAlign: "start",
    textBaseline: "alphabetic"
  } as unknown as CanvasRenderingContext2D;
  patternCanvasMockContexts.push(context as unknown as { font: string });
  return context;
}
