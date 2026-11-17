import { NextResponse, type NextRequest } from "next/server";

/** Nonce-based CSP on every HTML route rendered by Next. The share page sets its own stricter CSP. */
export function proxy(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const dev = process.env.NODE_ENV !== "production";
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://lh3.googleusercontent.com",
    "font-src 'self'",
    "connect-src 'self'",
    "worker-src 'self' blob:",
    "media-src 'self' blob:",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "form-action 'self'",
  ].join("; ");
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", csp);
  const res = NextResponse.next({ request: { headers } });
  res.headers.set("Content-Security-Policy", csp);
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.headers.set("X-Content-Type-Options", "nosniff");
  return res;
}

export const config = {
  matcher: [{ source: "/((?!api|v/|_next/static|_next/image|f/|r/|icon.svg|manifest.webmanifest|sw.js).*)", missing: [{ type: "header", key: "next-router-prefetch" }] }],
};
