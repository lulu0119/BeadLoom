import { publicPath } from "../../../base-path";

export async function relayModelRequest(request: Request): Promise<Response> {
  const headers = new Headers(request.headers);
  headers.set("x-beadloom-upstream", request.url);
  return fetch(publicPath("/api/chat/completions"), {
    method: "POST",
    headers,
    body: await request.text(),
    signal: request.signal,
    credentials: "omit",
    redirect: "error"
  });
}
