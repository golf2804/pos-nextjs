import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { applyFrontendSecurityHeaders } from "@/lib/security/content-security-policy";

const publicRoutes = ["/login", "/forgot-password", "/reset-password"];
const guestOnlyRoutes = ["/login", "/forgot-password"];

export async function updateSession(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  let response = NextResponse.next({ request: { headers: requestHeaders } });
  const pathname = request.nextUrl.pathname;
  const isPublicRoute = publicRoutes.includes(pathname);
  const isCallback = pathname.startsWith("/auth/callback");
  const supabaseConfig = getSupabaseProxyConfig();

  if (isServerAuthProxyDisabled()) {
    return applyFrontendSecurityHeaders(response, nonce);
  }

  if (!supabaseConfig) {
    if (!isPublicRoute && !isCallback) {
      return applyFrontendSecurityHeaders(redirectToLogin(request), nonce);
    }
    return applyFrontendSecurityHeaders(response, nonce);
  }

  const supabase = createServerClient(
    supabaseConfig.url,
    supabaseConfig.key,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (values) => {
          values.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request: { headers: requestHeaders } });
          values.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );
  let user = null;
  try {
    const result = await supabase.auth.getUser();
    user = result.data.user;
  } catch {
    if (!isPublicRoute && !isCallback) {
      return applyFrontendSecurityHeaders(redirectToLogin(request), nonce);
    }
    return applyFrontendSecurityHeaders(response, nonce);
  }

  const isGuestOnlyRoute = guestOnlyRoutes.includes(pathname);

  if (!user && !isPublicRoute && !isCallback) {
    return applyFrontendSecurityHeaders(redirectToLogin(request), nonce);
  }
  if (user && isGuestOnlyRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return applyFrontendSecurityHeaders(NextResponse.redirect(url), nonce);
  }
  return applyFrontendSecurityHeaders(response, nonce);
}

function redirectToLogin(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(url);
}

function getSupabaseProxyConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
      ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )?.trim();
  if (!url || !key) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return null;
    return { url: parsed.origin, key };
  } catch {
    return null;
  }
}

function isServerAuthProxyDisabled() {
  return process.env.NODE_ENV !== "production" && process.env.DISABLE_SERVER_AUTH_PROXY === "true";
}
