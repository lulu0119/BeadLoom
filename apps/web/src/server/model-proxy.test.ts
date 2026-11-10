// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";
import { relayModelRequest } from "../features/pattern-editor/model-transport";
import { createModelProxy } from "./model-proxy";

const upstreamURL = "https://opencode.ai/inference/go/openai/v1/chat/completions";

function request(target = upstreamURL, signal?: AbortSignal): Request {
  return new Request("http://localhost:3105/api/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer test-key",
      "x-beadloom-upstream": target,
      "x-opencode-session": "test-session",
      cookie: "private=browser-cookie"
    },
    body: JSON.stringify({ model: "deepseek-v4.1-flash", messages: [], stream: true }),
    signal
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("model relay", () => {
  it("sends the browser request through the same-origin route and streams before completion", async () => {
    let stream: ReadableStreamDefaultController<Uint8Array> | undefined;
    const fetchUpstream = vi.fn<typeof fetch>().mockResolvedValue(new Response(new ReadableStream({
      start(controller) { stream = controller; }
    }), { headers: { "content-type": "text/event-stream", "set-cookie": "upstream=private" } }));
    const relay = createModelProxy({ fetch: fetchUpstream });
    const browserFetch = vi.fn<typeof fetch>().mockImplementation(async (input, init) =>
      relay(new Request(new URL(String(input), "http://localhost:3105"), init)));
    vi.stubGlobal("fetch", browserFetch);
    const response = await relayModelRequest(new Request(upstreamURL, request()));
    expect(browserFetch.mock.calls[0][0]).toBe("/api/chat/completions");
    expect(fetchUpstream).toHaveBeenCalledOnce();
    const [url, init] = fetchUpstream.mock.calls[0];
    expect(url).toBe(upstreamURL);
    const headers = new Headers(init?.headers);
    expect(headers.get("authorization")).toBe("Bearer test-key");
    expect(headers.get("x-opencode-session")).toBe("test-session");
    expect(headers.has("cookie")).toBe(false);
    expect(headers.has("x-beadloom-upstream")).toBe(false);
    expect(JSON.parse(String(init?.body))).toMatchObject({ model: "deepseek-v4.1-flash", stream: true });
    expect(init?.redirect).toBe("manual");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.has("set-cookie")).toBe(false);
    const reader = response.body!.getReader();
    stream!.enqueue(new TextEncoder().encode("data: first\n\n"));
    expect(new TextDecoder().decode((await reader.read()).value)).toBe("data: first\n\n");
    stream!.close();
    expect((await reader.read()).done).toBe(true);
  });

  it("keeps upstream errors and retry information intact", async () => {
    const fetchUpstream = vi.fn<typeof fetch>().mockResolvedValue(Response.json(
      { error: { message: "Invalid API key" } },
      { status: 401, headers: { "retry-after": "10" } }
    ));
    const response = await createModelProxy({ fetch: fetchUpstream })(request());
    expect(response.status).toBe(401);
    expect(response.headers.get("retry-after")).toBe("10");
    expect(await response.json()).toEqual({ error: { message: "Invalid API key" } });
  });

  it("propagates cancellation to the provider", async () => {
    const controller = new AbortController();
    const fetchUpstream = vi.fn<typeof fetch>().mockResolvedValue(new Response(""));
    await createModelProxy({ fetch: fetchUpstream })(request(upstreamURL, controller.signal));
    const signal = fetchUpstream.mock.calls[0][1]?.signal;
    expect(signal?.aborted).toBe(false);
    controller.abort();
    expect(signal?.aborted).toBe(true);
  });

  it.each([
    "http://127.0.0.1:8000/chat/completions",
    "http://169.254.169.254/chat/completions",
    "https://opencode.ai.evil.test/inference/go/openai/v1/chat/completions",
    "https://key:secret@opencode.ai/inference/go/openai/v1/chat/completions",
    "https://opencode.ai/inference/go/openai/v1/chat/completions?target=private",
    "https://opencode.ai/account"
  ])("refuses an unapproved destination: %s", async (target) => {
    const fetchUpstream = vi.fn<typeof fetch>();
    const response = await createModelProxy({ fetch: fetchUpstream })(request(target));
    expect(response.status).toBe(403);
    expect(fetchUpstream).not.toHaveBeenCalled();
  });

  it("supports an operator-configured custom base URL", async () => {
    const fetchUpstream = vi.fn<typeof fetch>().mockResolvedValue(new Response("ok"));
    const relay = createModelProxy({ fetch: fetchUpstream, baseURLs: ["https://gateway.example/v1"] });
    expect((await relay(request("https://gateway.example/v1/chat/completions"))).status).toBe(200);
  });

  it.each([
    { name: "missing target", target: null },
    { name: "invalid URL", target: "not-a-url" },
    { name: "oversized URL", target: "https://model.test/" + "a".repeat(4096) }
  ])("rejects $name without exposing credentials", async ({ target }) => {
    const fetchUpstream = vi.fn<typeof fetch>();
    const invalid = request();
    if (target === null) invalid.headers.delete("x-beadloom-upstream");
    else invalid.headers.set("x-beadloom-upstream", target);
    const response = await createModelProxy({ fetch: fetchUpstream })(invalid);
    expect(response.status).toBe(400);
    expect(await response.text()).not.toContain("test-key");
    expect(fetchUpstream).not.toHaveBeenCalled();
  });

  it("does not follow upstream redirects with the API key", async () => {
    const fetchUpstream = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, {
      status: 307, headers: { location: "http://127.0.0.1/private" }
    }));
    const response = await createModelProxy({ fetch: fetchUpstream })(request());
    expect(response.status).toBe(502);
    expect(response.headers.has("location")).toBe(false);
    expect(fetchUpstream).toHaveBeenCalledOnce();
  });

  it("returns a useful error without exposing internal network details", async () => {
    const fetchUpstream = vi.fn<typeof fetch>().mockRejectedValue(new Error("secret internal detail"));
    const response = await createModelProxy({ fetch: fetchUpstream })(request());
    expect(response.status).toBe(502);
    expect(await response.text()).toContain("Could not connect to the model API");
  });
});
