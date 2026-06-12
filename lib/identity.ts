// Sign-in domain allow-list + user-identity helpers.
//
// Deployment config, not company-specific code: the set of company email
// domains allowed to sign in is read from NEXT_PUBLIC_ALLOWED_EMAIL_DOMAINS
// (comma-separated, e.g. "acme.com,foo.com"). It is intentionally a
// NEXT_PUBLIC_ var so the same list is available to client components (for
// placeholders / "sign in with @x" hints) AND server code — this module has no
// server-only imports and is shared by both. The list is not a secret; security
// comes from SERVER-SIDE enforcement in auth.ts (and the admin gate), never from
// hiding this list. Fail closed: with nothing configured, no one may sign in.

const RAW = process.env.NEXT_PUBLIC_ALLOWED_EMAIL_DOMAINS ?? "";

export const ALLOWED_DOMAINS: string[] = RAW.split(",")
  .map((d) => d.trim().toLowerCase().replace(/^@/, ""))
  .filter(Boolean);

// First configured domain — used for UI hints (placeholders, error copy).
export const PRIMARY_DOMAIN = ALLOWED_DOMAINS[0] ?? "";

function domainOf(email: string | null | undefined): string {
  const e = (email ?? "").toLowerCase().trim();
  const at = e.lastIndexOf("@");
  return at > 0 ? e.slice(at + 1) : "";
}

// Whether an email belongs to an allowed company domain. With no domains
// configured this returns false for everyone (fail closed).
export function isAllowedEmail(email: string | null | undefined): boolean {
  const domain = domainOf(email);
  return domain.length > 0 && ALLOWED_DOMAINS.includes(domain);
}

// Whether the given domain is one we accept — used when validating admin grants.
export function isAllowedDomain(domain: string): boolean {
  return ALLOWED_DOMAINS.includes(domain.trim().toLowerCase().replace(/^@/, ""));
}

// The stable identity used as the author/submitter key and for ownership checks.
//
// Single-domain deployment: the local part alone is unique, so we key on it
// (e.g. "jnoh") — this keeps existing data and the short-name UI unchanged.
// Multi-domain deployment: the local part is NO LONGER unique ("john" could be
// at two companies), so we key on the full, lowercased email to keep authors
// distinct and stop one company's users from seeing another's drafts.
export function identityFromEmail(email: string | null | undefined): string {
  const e = (email ?? "").toLowerCase().trim();
  if (ALLOWED_DOMAINS.length > 1) return e;
  const at = e.lastIndexOf("@");
  return at > 0 ? e.slice(0, at) : e;
}

// Whether a stored author key refers to the current user. Accepts a legacy
// local-part-only key (data written before identities were full emails) as a
// match for the same local part. That is safe for a single-domain deployment,
// and a fresh multi-domain install has no such legacy data.
export function sameUser(author: string | null | undefined, me: string | null | undefined): boolean {
  const a = (author ?? "").toLowerCase().trim();
  const m = (me ?? "").toLowerCase().trim();
  if (!a || !m) return false;
  if (a === m) return true;
  return a === m.split("@")[0]; // legacy local-part vs full email
}

// Normalize a co-worker registration input into the same identity key used for
// authors. Accepts a company email ("kim@ctr.co.kr") or — single-domain only —
// a bare id ("kim"). Returns null for anything else: a foreign-domain email, a
// malformed id, or a bare id on a multi-domain deployment (ambiguous across
// companies, so the full email form is required there). With no domains
// configured nothing normalizes (fail closed, matching sign-in).
// Parameterized (no env reads) so it is unit-testable like lib/auth-gate.ts.
export function coworkerKeyForDomains(
  input: string | null | undefined,
  domains: string[]
): string | null {
  const v = (input ?? "").toLowerCase().trim();
  if (!v) return null;
  if (v.includes("@")) {
    const at = v.lastIndexOf("@");
    const domain = at > 0 ? v.slice(at + 1) : "";
    if (!domain || !domains.includes(domain)) return null;
    return domains.length > 1 ? v : v.slice(0, at);
  }
  if (domains.length !== 1) return null;
  return /^[a-z0-9][a-z0-9._%+-]*$/.test(v) ? v : null;
}

// The deployment-bound form used by app code.
export function coworkerKeyFromInput(input: string | null | undefined): string | null {
  return coworkerKeyForDomains(input, ALLOWED_DOMAINS);
}

// How an author/submitter key is shown in the UI. Single-domain deployments
// show the short local part (e.g. "jnoh"); multi-domain deployments show the
// full address so it stays unambiguous across companies.
export function displayAuthor(author: string | null | undefined): string {
  const a = (author ?? "").trim();
  if (!a) return "";
  if (ALLOWED_DOMAINS.length > 1) return a;
  return a.includes("@") ? a.slice(0, a.lastIndexOf("@")) : a;
}
