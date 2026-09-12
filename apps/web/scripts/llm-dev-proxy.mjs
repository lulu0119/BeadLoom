import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { createRequire } from "node:module";

const PROXY_PORT = 8787;
const PROXY_HOST = "127.0.0.1";

function sendCors(res, origin) {
  res.setHeader("Access-Control-Allow-Origin", origin ?? "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "authorization, content-type, x-llm-target, x-opencode-session");
}

function startProxy() {
  const server = createServer((req, res) => {
    const origin = typeof req.headers.origin === "string" ? req.headers.origin : "*";
    sendCors(res, origin);
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }
    if (req.method !== "POST") {
      res.writeHead(405);
      res.end();
      return;
    }
    void (async () => {
      const target = req.headers["x-llm-target"];
      if (typeof target !== "string") {
        res.writeHead(400);
        res.end();
        return;
      }
      let parsed;
      try {
        parsed = new URL(target);
      } catch {
        res.writeHead(400);
        res.end();
        return;
      }
      if (parsed.protocol !== "https:") {
        res.writeHead(400);
        res.end();
        return;
      }
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      const headers = {};
      if (typeof req.headers.authorization === "string") {
        headers.authorization = req.headers.authorization;
      }
      if (typeof req.headers["content-type"] === "string") {
        headers["content-type"] = req.headers["content-type"];
      }
      if (typeof req.headers["x-opencode-session"] === "string") {
        headers["x-opencode-session"] = req.headers["x-opencode-session"];
      }
      const upstream = await fetch(parsed, {
        method: "POST",
        headers,
        body: Buffer.concat(chunks),
        signal: AbortSignal.timeout(120_000)
      });
      const responseHeaders = {
        "Access-Control-Allow-Origin": origin,
        "Cache-Control": "no-cache"
      };
      const contentType = upstream.headers.get("content-type");
      if (contentType !== null) {
        responseHeaders["Content-Type"] = contentType;
      }
      res.writeHead(upstream.status, responseHeaders);
      if (upstream.body === null) {
        res.end();
        return;
      }
      for await (const chunk of upstream.body) {
        res.write(chunk);
      }
      res.end();
    })().catch((error) => {
      if (!res.headersSent) {
        res.writeHead(502);
      }
      res.end(error instanceof Error ? error.message : "proxy failed");
    });
  });
  server.listen(PROXY_PORT, PROXY_HOST);
  return server;
}

const proxyOnly = process.argv.includes("--proxy-only");
const server = startProxy();
if (proxyOnly) {
  server.on("listening", () => {
    process.stdout.write(`LLM dev proxy http://${PROXY_HOST}:${PROXY_PORT}/\n`);
  });
} else {
  const require = createRequire(import.meta.url);
  const nextBin = require.resolve("next/dist/bin/next");
  const child = spawn(process.execPath, [nextBin, "dev", ...process.argv.slice(2).filter((arg) => arg !== "--proxy-only")], {
    stdio: "inherit"
  });
  const stop = () => {
    child.kill("SIGINT");
    server.close();
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  child.on("exit", (code) => {
    server.close();
    process.exit(code ?? 0);
  });
}
