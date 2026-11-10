/** Keep asset and API URLs aligned with the configured Next.js base path. */
export function computePublicBasePath(): string {
  const raw = process.env.NEXT_PUBLIC_BASE_PATH?.trim() ?? "";
  if (raw === "") {
    return "";
  }
  return raw.startsWith("/") ? raw : `/${raw}`;
}

export function publicPath(absoluteFromWebRoot: string): string {
  const base = computePublicBasePath();
  const path = absoluteFromWebRoot.startsWith("/") ? absoluteFromWebRoot : `/${absoluteFromWebRoot}`;
  return `${base}${path}`;
}
