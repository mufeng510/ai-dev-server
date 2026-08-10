export const locales = ["en", "zh"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";

export function isLocale(value: string | undefined): value is Locale {
  return value === "en" || value === "zh";
}

export function localePath(locale: Locale, path = "/"): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (locale === defaultLocale) return normalized === "" ? "/" : normalized;
  if (normalized === "/") return `/${locale}/`;
  return `/${locale}${normalized}`;
}

/** Map a path from one locale to another, preserving docs slug when possible. */
export function switchLocalePath(currentPath: string, target: Locale): string {
  const clean = currentPath.replace(/\/$/, "") || "/";
  let rest = clean;
  if (clean === "/zh" || clean.startsWith("/zh/")) {
    rest = clean.slice(3) || "/";
  }
  if (!rest.startsWith("/")) rest = `/${rest}`;
  return localePath(target, rest === "" ? "/" : rest);
}

export function getLocaleFromUrl(url: URL): Locale {
  const [, maybe] = url.pathname.split("/");
  return isLocale(maybe) ? maybe : defaultLocale;
}