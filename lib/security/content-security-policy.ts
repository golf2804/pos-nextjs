import type { NextResponse } from "next/server";

export function applyFrontendSecurityHeaders(response: NextResponse, nonce: string) {
  const supabaseOrigin = originOf(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const apiOrigin = originOf(process.env.NEXT_PUBLIC_API_URL);
  const connectSources = ["'self'", supabaseOrigin, apiOrigin]
    .filter((value): value is string => Boolean(value));
  if (supabaseOrigin) connectSources.push(supabaseOrigin.replace(/^https:/, "wss:"));

  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${supabaseOrigin ?? ""}`.trim(),
    `connect-src ${[...new Set(connectSources)].join(" ")}`,
    "font-src 'self' data:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    process.env.NODE_ENV === "production" ? "upgrade-insecure-requests" : "",
  ].filter(Boolean);

  response.headers.set("Content-Security-Policy", directives.join("; "));
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Permissions-Policy", "camera=(self), microphone=(), geolocation=()");
  return response;
}

function originOf(value: string | undefined) {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}
