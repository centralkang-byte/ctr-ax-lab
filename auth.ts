import NextAuth from "next-auth";
import authConfig from "@/auth.config";

// Full Node-runtime auth entry point. Upstream extended the base config here
// with a database adapter + Resend magic-link provider; CTR AX Lab is
// Entra-SSO-only (decision D3), so the base config is the whole config. The
// file remains so route handlers / server components keep importing "@/auth".
export const { handlers, signIn, signOut, auth } = NextAuth(authConfig);
