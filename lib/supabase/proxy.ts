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
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
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
  const { data: { user } } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;
  const isPublicRoute = publicRoutes.includes(pathname);
  const isGuestOnlyRoute = guestOnlyRoutes.includes(pathname);
  const isCallback = pathname.startsWith("/auth/callback");

  if (!user && !isPublicRoute && !isCallback) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return applyFrontendSecurityHeaders(NextResponse.redirect(url), nonce);
  }
  if (user && isGuestOnlyRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return applyFrontendSecurityHeaders(NextResponse.redirect(url), nonce);
  }
  return applyFrontendSecurityHeaders(response, nonce);
}
