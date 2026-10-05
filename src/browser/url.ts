export function resolveTargetUrl(
  previewUrl: string,
  route?: string | null,
): string {
  if (!route || route.trim() === "" || route === "/") {
    const parsed = new URL(previewUrl);
    if (route === "/") parsed.pathname = "/";
    return parsed.toString();
  }
  try {
    return new URL(route).toString();
  } catch {
    return new URL(
      route.startsWith("/") ? route : `/${route}`,
      previewUrl,
    ).toString();
  }
}
