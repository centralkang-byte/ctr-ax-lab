import type { NextAuthConfig } from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import Credentials from "next-auth/providers/credentials";
import { ALLOWED_DOMAINS, isAllowedEmail } from "@/lib/identity";
import { isAllowedSignIn, type EntraClaims } from "@/lib/auth-gate";

// Edge-safe base auth config, shared by `middleware.ts` (Edge runtime) and the
// full Node config in `auth.ts`.
//
// CRITICAL: this file MUST NOT import Node-only modules (database adapters,
// pools) — middleware pulls it into the Edge bundle. The Entra provider config
// is plain OIDC metadata and is Edge-safe.
//
// Sign-in is Microsoft Entra ID ONLY (decision D3 / outside-voice finding #1):
// a magic-link or any second provider would bypass the tenant gate and Entra
// conditional-access/MFA policy, so none is offered or wired.
//
// The ONE exception is the dev-only login below, double-gated so it cannot
// exist in production: `next build` compiles with NODE_ENV=production, which
// makes DEV_LOGIN_ENABLED constant-false regardless of env vars, AND the
// DEV_LOGIN flag is only set in gitignored .env.local. It exists solely to
// test the product locally before CTR IT delivers the Entra app registration.

const TENANT_ID = (process.env.AUTH_MICROSOFT_ENTRA_TENANT_ID ?? "").trim();

export const DEV_LOGIN_ENABLED =
  process.env.NODE_ENV !== "production" && process.env.DEV_LOGIN === "true";

const providers: NextAuthConfig["providers"] = [
  MicrosoftEntraID({
    clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
    clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
    // Layer 1: issuer pinned to CTR's tenant — tokens from any other tenant
    // fail OIDC validation outright. The app registration itself must also
    // be single-tenant (spec §3.2).
    issuer: TENANT_ID
      ? `https://login.microsoftonline.com/${TENANT_ID}/v2.0`
      : undefined,
  }),
];

if (DEV_LOGIN_ENABLED) {
  providers.push(
    Credentials({
      id: "dev-login",
      name: "Dev login",
      credentials: { email: {} },
      // Local-only identity assumption: no password, but still domain-gated so
      // the app behaves exactly like a real @ctr.co.kr session.
      authorize(credentials) {
        const email = String(credentials?.email ?? "").trim().toLowerCase();
        if (!isAllowedEmail(email)) return null;
        return { id: email, email, name: email.split("@")[0] };
      },
    })
  );
}

export default {
  providers,
  session: { strategy: "jwt" },
  // error: AccessDenied (rejected by the signIn gate) and config errors land
  // back on our login page instead of Auth.js's unstyled English error page.
  pages: { signIn: "/login", error: "/login" },
  callbacks: {
    // Layer 2 — SECURITY BOUNDARY: re-verify tenant id + email domain server-
    // side. `profile` is the decoded, signature-verified id_token for OIDC
    // providers, so `tid` is trustworthy here. Fails closed on anything missing.
    async signIn({ profile, account, user }) {
      if (account?.provider === "dev-login") {
        // Dev-only path: both gates re-checked here so a stray provider could
        // never slip through even if the list above were misassembled.
        return DEV_LOGIN_ENABLED && isAllowedEmail(user?.email);
      }
      return isAllowedSignIn((profile ?? {}) as EntraClaims, TENANT_ID, ALLOWED_DOMAINS);
    },
  },
} satisfies NextAuthConfig;
