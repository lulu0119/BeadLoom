import type { NextConfig } from "next";
import path from "node:path";
import { computePublicBasePath } from "./base-path";

const basePath = computePublicBasePath();

const nextConfig: NextConfig = {
  transpilePackages: ["@beadloom/assistant-xsai", "@beadloom/core", "@beadloom/palettes", "@beadloom/ui", "@shadcn/react"],
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../.."),
  serverExternalPackages: ["@xsai-ext/providers"],
  images: {
    unoptimized: true
  },
  ...(basePath !== ""
    ? {
        basePath,
        assetPrefix: basePath
      }
    : {})
};

export default nextConfig;
