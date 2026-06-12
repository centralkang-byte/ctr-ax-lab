import { cookies } from "next/headers";

// "View as member": an owner-only testing affordance that lets an admin preview
// the plain-member experience. It is intentionally NOT a security control — it
// only ever *removes* privileges from the caller's own session, so a real member
// setting the cookie changes nothing (there is no escalation path). The cookie
// is set/cleared client-side from the header; the server simply honors it.
export const VIEW_AS_COOKIE = "viewAs";

export async function isViewingAsMember(): Promise<boolean> {
  const store = await cookies();
  return store.get(VIEW_AS_COOKIE)?.value === "member";
}
