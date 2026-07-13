const C0_AND_DEL_RE = /[\x00-\x1F\x7F]/;

const PCT_ENCODED_C0_OR_DEL_RE = /%(?:[0-1][0-9A-Fa-f]|7F)/i;

/**
 * Builds an absolute URL for a route-handler redirect.
 *
 * `req.url` in a Next.js route handler reflects the address the server is
 * bound to (e.g. `http://0.0.0.0:3000/...`), not the public origin the browser
 * hit, because `X-Forwarded-Host`/`X-Forwarded-Proto` are not trusted by
 * default. Using `req.url` as the base therefore leaks the internal host to the
 * client on redirects behind a reverse proxy.
 *
 * Prefer `APP_URL` (the canonical public origin) when set, falling back to
 * `req.url` only in local dev where it is authoritative.
 *
 * @param relativePath A server-relative path (must start with "/").
 * @param reqUrl The incoming request URL, used as a fallback base.
 */
export function absoluteRedirectUrl(
  relativePath: string,
  reqUrl: string | URL,
): URL {
  const base = process.env.APP_URL ?? reqUrl;
  return new URL(relativePath, base);
}

/**
 * Returns a safe relative path, defaulting to "/".
 *
 * Validation rules:
 * - Missing/empty/non-string → "/"
 * - Literal C0 control characters and DEL (0x00–0x1F, 0x7F) are rejected → "/"
 *   (browsers strip these when parsing URLs, so leaving them in can enable
 *   `//`-prefix or backslash bypasses such as `/\tevil.com`).
 * - Percent-encoded C0 controls / DEL (e.g. `%09`, `%00`, `%7F`) are rejected → "/"
 * - Length greater than 1024 characters after cleaning → "/"
 * - Must start with "/"; otherwise "/" (rejects absolute http://... and mailto:)
 * - Must NOT start with "//" or "/\\" (blocks protocol-relative + backslash tricks) → "/"
 * - Pathname must NOT be "/login", "/logout", "/login/verify", or start with
 *   "/login/" or "/logout/" (prevents loops; query strings and fragments are
 *   ignored when making this decision) → "/"
 * - Comparison is case-insensitive for the loop check
 * - Otherwise return the path as-is (query string preserved, e.g. "/members?filter=active")
 *
 * @security Callers MUST pass the URL-decoded value from `URLSearchParams` /
 * `nextUrl.searchParams`, NOT a raw query string, so that `%2F` is decoded and
 * re-checked.
 *
 * @security The `login.redirect_path` value MUST be sanitized again on every read
 * from the database before using it in a redirect. Write-time sanitization alone
 * is not sufficient (defense in depth).
 *
 * @security Input is rejected if it exceeds 1024 characters, to limit the abuse
 * surface for stored-XSS / header-overflow scenarios.
 */
export function sanitizeRedirect(raw: string | null | undefined): string {
  if (typeof raw !== "string" || raw.length === 0) {
    return "/";
  }

  // Reject literal C0 controls / DEL outright.
  if (C0_AND_DEL_RE.test(raw)) {
    return "/";
  }

  const cleaned = raw.replace(C0_AND_DEL_RE, "");

  if (cleaned.length > 1024) {
    return "/";
  }

  // Reject percent-encoded C0 controls / DEL (caller may not have decoded first).
  if (PCT_ENCODED_C0_OR_DEL_RE.test(cleaned)) {
    return "/";
  }

  if (!cleaned.startsWith("/")) {
    return "/";
  }

  if (cleaned.startsWith("//") || cleaned.startsWith("/\\")) {
    return "/";
  }

  const pathOnly = cleaned.split(/[?#]/)[0];
  const lower = pathOnly.toLowerCase();

  if (
    lower === "/login" ||
    lower === "/logout" ||
    lower === "/login/verify" ||
    lower.startsWith("/login/") ||
    lower.startsWith("/logout/")
  ) {
    return "/";
  }

  return cleaned;
}

/**
 * Returns "/login?redirect=<encodeURIComponent(sanitized)>".
 * If sanitized === "/", returns "/login" (no redundant param).
 */
export function buildLoginUrl(originalPathAndSearch: string): string {
  const sanitized = sanitizeRedirect(originalPathAndSearch);

  if (sanitized === "/") {
    return "/login";
  }

  return `/login?redirect=${encodeURIComponent(sanitized)}`;
}

/**
 * Returns a sanitized redirect target for the login verify route.
 */
export function verifyRouteTarget(login: { redirect_path: string | null } | null | undefined): string {
  return sanitizeRedirect(login?.redirect_path ?? null);
}

/**
 * Returns the post-login redirect target from the `redirect` query parameter.
 * Defaults to "/" when the parameter is missing or unsafe.
 */
export function getPostLoginRedirect(searchParams: URLSearchParams): string {
  return sanitizeRedirect(searchParams.get("redirect"));
}
