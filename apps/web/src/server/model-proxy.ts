import { providers } from "@xsai-ext/providers/full";

const catalogBaseURLs = Object.values(providers).flatMap((provider) =>
  Object.values(provider.models).flatMap((model) => {
    const route = model.routes.chat;
    return route && !route.path && !route.variables?.length && route.baseURL.startsWith("https://")
      ? [route.baseURL]
      : [];
  })
);

export function createModelProxy({
  fetch: fetchUpstream = fetch,
  baseURLs = (process.env.LLM_ALLOWED_BASE_URLS ?? "").split(",").map((url) => url.trim()).filter(Boolean)
}: { fetch?: typeof fetch; baseURLs?: string[] } = {}): (request: Request) => Promise<Response> {
  const endpoints = new Set([...catalogBaseURLs, ...baseURLs].map((baseURL) =>
    new URL("chat/completions", baseURL.replace(/\/+$/, "") + "/").href
  ));

  return async function proxyModelRequest(request: Request): Promise<Response> {
    const target = request.headers.get("x-beadloom-upstream");
    if (target === null || target.length > 4096 || !URL.canParse(target)) {
      return errorResponse("Invalid model relay request.", 400);
    }
    if (!endpoints.has(target)) {
      return errorResponse("This model endpoint is not enabled on this server. Add its Base URL to LLM_ALLOWED_BASE_URLS.", 403);
    }
    const upstreamHeaders = new Headers();
    for (const name of ["authorization", "content-type", "accept", "x-opencode-session"]) {
      const value = request.headers.get(name);
      if (value) upstreamHeaders.set(name, value);
    }
    try {
      const response = await fetchUpstream(target, {
        method: "POST",
        headers: upstreamHeaders,
        body: await request.text(),
        signal: request.signal,
        redirect: "manual",
        cache: "no-store"
      });
      if (response.status >= 300 && response.status < 400) {
        await response.body?.cancel();
        return errorResponse("The model API redirected the request. Update the Base URL.", 502);
      }
      const responseHeaders = new Headers({ "cache-control": "no-store", "x-accel-buffering": "no" });
      for (const name of ["content-type", "retry-after", "x-request-id"]) {
        const value = response.headers.get(name);
        if (value) responseHeaders.set(name, value);
      }
      return new Response(response.body, { status: response.status, headers: responseHeaders });
    } catch {
      return errorResponse("Could not connect to the model API. Check the Base URL and server connection.", 502);
    }
  };
}

function errorResponse(message: string, status: number): Response {
  return Response.json({ error: { message } }, {
    status,
    headers: { "cache-control": "no-store" }
  });
}
