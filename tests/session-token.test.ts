import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { signSessionToken, verifySessionToken } from "@/lib/session-token";

const SECRET = "test-secret-value";

describe("HMAC session tokens", () => {
  it("round-trips the signed user id", () => {
    const token = signSessionToken("user-123", SECRET, Date.UTC(2026, 10, 10));
    const payload = verifySessionToken(token, SECRET, Date.UTC(2026, 10, 10));
    assert.equal(payload?.sub, "user-123");
  });

  it("rejects a token signed with another secret", () => {
    const token = signSessionToken("user-123", SECRET);
    assert.equal(verifySessionToken(token, "different-secret"), null);
  });

  it("rejects a tampered payload", () => {
    const token = signSessionToken("user-123", SECRET);
    const [, signature] = token.split(".");
    const forgedPayload = Buffer.from(JSON.stringify({ sub: "admin-999", exp: Date.now() + 60_000 })).toString("base64url");
    assert.equal(verifySessionToken(`${forgedPayload}.${signature}`, SECRET), null);
  });

  it("rejects an expired token", () => {
    const issuedAt = Date.now() - 8 * 24 * 60 * 60 * 1000;
    const token = signSessionToken("user-123", SECRET, issuedAt);
    assert.equal(verifySessionToken(token, SECRET), null);
  });

  it("rejects malformed tokens", () => {
    assert.equal(verifySessionToken("not-a-token", SECRET), null);
    assert.equal(verifySessionToken("a.b.c", SECRET), null);
    assert.equal(verifySessionToken("", SECRET), null);
  });
});
