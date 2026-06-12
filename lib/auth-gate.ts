// Server-side sign-in gate for Microsoft Entra ID — layer 2 of the dual check
// (decision D3). Layer 1 is the single-tenant app registration + issuer
// pinning in auth.config.ts; this layer re-verifies the tenant id claim AND
// the email domain so a misconfigured registration can never silently widen
// access. Same philosophy as upstream: never rely on one control.
//
// Pure and parameterized (no env reads) so it is unit-testable; auth.config.ts
// wires in the real tenant id and ALLOWED_DOMAINS. The tiny overlap with
// lib/identity's domain parsing is deliberate — identity reads env at module
// load, which would force env stubbing in tests.

export interface EntraClaims {
  tid?: unknown;
  email?: unknown;
  preferred_username?: unknown;
}

// Entra puts the sign-in address in `email` when the scope is granted, else in
// `preferred_username` (a UPN, which is an email-shaped login name at CTR).
export function emailFromClaims(claims: EntraClaims): string {
  const candidate =
    typeof claims.email === "string" && claims.email.includes("@")
      ? claims.email
      : typeof claims.preferred_username === "string" && claims.preferred_username.includes("@")
        ? claims.preferred_username
        : "";
  return candidate.trim().toLowerCase();
}

export function isAllowedSignIn(
  claims: EntraClaims,
  expectedTenantId: string,
  allowedDomains: readonly string[]
): boolean {
  const tenant = (expectedTenantId ?? "").trim();
  if (!tenant) return false; // fail closed: tenant not configured
  if (typeof claims.tid !== "string" || claims.tid !== tenant) return false;
  const email = emailFromClaims(claims);
  const at = email.lastIndexOf("@");
  if (at <= 0) return false;
  return allowedDomains.includes(email.slice(at + 1));
}
