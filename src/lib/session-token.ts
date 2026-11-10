import crypto from "node:crypto";

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type SessionPayload = { sub: string; exp: number };

function base64Url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function signature(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("base64url");
}

export function signSessionToken(userId: string, secret: string, now = Date.now()): string {
  const payload: SessionPayload = { sub: userId, exp: now + SESSION_TTL_MS };
  const encoded = base64Url(JSON.stringify(payload));
  return `${encoded}.${signature(encoded, secret)}`;
}

export function verifySessionToken(token: string, secret: string, now = Date.now()): SessionPayload | null {
  const [encoded, provided] = token.split(".");
  if (!encoded || !provided) return null;
  const expected = signature(encoded, secret);
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString()) as SessionPayload;
    if (!payload.sub || typeof payload.exp !== "number" || payload.exp < now) return null;
    return payload;
  } catch {
    return null;
  }
}
