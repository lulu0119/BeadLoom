import type { NextConfig } from "next";
import { computePublicBasePath } from "./base-path";

const basePath = computePublicBasePath();

const nextConfig: NextConfig = {
  transpilePackages: ["@beadloom/assistant-xsai", "@beadloom/core", "@beadloom/palettes", "@beadloom/ui", "@shadcn/react"],
  output: "export",
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
