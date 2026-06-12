import NextAuth from "next-auth";
import authConfig from "@/auth.config";

// Middleware runs on the Edge runtime, so it builds its NextAuth instance from
// the Edge-safe base config ONLY (auth.config.ts) — never from @/auth, which
// pulls in the Node-only database adapter and would crash the middleware
// (MIDDLEWARE_INVOCATION_FAILED). Session validation here is pure JWT; no DB or
// provider sign-in is needed.
const { auth } = NextAuth(authConfig);

// Protect every route except the login page, auth API, and static assets.
export default auth((req) => {
  const { pathname } = req.nextUrl;
  if (!req.auth && pathname !== "/login") {
    const url = new URL("/login", req.nextUrl.origin);
    return Response.redirect(url);
  }
});

export const config = {
  matcher: ["/((?!api/auth|login|_next/static|_next/image|favicon.ico).*)"]
};
