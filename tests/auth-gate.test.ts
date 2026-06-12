import { describe, it, expect } from "vitest";
import { isAllowedSignIn, emailFromClaims } from "@/lib/auth-gate";

const TENANT = "11111111-2222-3333-4444-555555555555";
const OK = { tid: TENANT, email: "user@ctr.co.kr" };

describe("isAllowedSignIn (Entra dual gate, decision D3)", () => {
  it("accepts correct tenant + allowed domain", () => {
    expect(isAllowedSignIn(OK, TENANT, ["ctr.co.kr"])).toBe(true);
  });
  it("rejects an allowed-domain email from the WRONG tenant", () => {
    expect(isAllowedSignIn({ ...OK, tid: "other-tenant" }, TENANT, ["ctr.co.kr"])).toBe(false);
  });
  it("rejects the right tenant with a foreign email domain", () => {
    expect(isAllowedSignIn({ tid: TENANT, email: "user@gmail.com" }, TENANT, ["ctr.co.kr"])).toBe(false);
  });
  it("falls back to preferred_username when email is absent", () => {
    expect(
      isAllowedSignIn({ tid: TENANT, preferred_username: "User@CTR.co.kr" }, TENANT, ["ctr.co.kr"])
    ).toBe(true);
    expect(emailFromClaims({ preferred_username: "User@CTR.co.kr" })).toBe("user@ctr.co.kr");
  });
  it("fails closed on missing claims or missing config", () => {
    expect(isAllowedSignIn({ email: "user@ctr.co.kr" }, TENANT, ["ctr.co.kr"])).toBe(false); // no tid
    expect(isAllowedSignIn(OK, "", ["ctr.co.kr"])).toBe(false); // no expected tenant
    expect(isAllowedSignIn(OK, TENANT, [])).toBe(false); // no domains
    expect(isAllowedSignIn({}, TENANT, ["ctr.co.kr"])).toBe(false);
  });
  it("prefers the email claim over preferred_username when both exist", () => {
    expect(emailFromClaims({ email: "a@ctr.co.kr", preferred_username: "b@other.com" })).toBe(
      "a@ctr.co.kr"
    );
    // An email claim without "@" is ignored — falls through to preferred_username.
    expect(emailFromClaims({ email: "not-an-address", preferred_username: "b@ctr.co.kr" })).toBe(
      "b@ctr.co.kr"
    );
  });
});
