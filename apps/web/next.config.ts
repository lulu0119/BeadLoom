import type { NextConfig } from "next";
import { computePublicBasePath } from "./base-path";

const basePath = computePublicBasePath();
const optionalSchemaStub = "./src/lib/optional-schema-stub.ts";

const nextConfig: NextConfig = {
  transpilePackages: ["@apeira/core", "@beadloom/core", "@beadloom/palettes", "@beadloom/ui", "@shadcn/react"],
  output: "export",
  images: {
    unoptimized: true
  },
  turbopack: {
    resolveAlias: {
      "@valibot/to-json-schema": optionalSchemaStub,
      effect: optionalSchemaStub,
      sury: optionalSchemaStub
    }
  },
  webpack: (config) => {
    config.resolve = config.resolve ?? {};
    config.resolve.alias = {
      ...config.resolve.alias,
      "@valibot/to-json-schema": optionalSchemaStub,
      effect: optionalSchemaStub,
      sury: optionalSchemaStub
    };
    return config;
  },
  ...(basePath !== ""
    ? {
        basePath,
        assetPrefix: basePath
      }
    : {})
};

export default nextConfig;
