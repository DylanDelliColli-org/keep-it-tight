import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

import { compare } from "bcryptjs";
import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { members } from "@/db/schema";
import { getEnv } from "@/env";

export const SESSION_COOKIE_NAME = "session";

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;
const SESSION_VERSION = 1;
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;
const INVALID_PASSWORD_HASH =
  "$2b$12$xtmknu0ckEKyKoBwtaIbfuoaSkxyRfHNG6F0ZSCS/V0YxL.YYQlTa";

type SessionPayload = {
  expiresAt: number;
  memberId: number;
  version: number;
};

export type AuthenticatedMember = {
  email: string;
  id: number;
  name: string;
};

function sessionKey(): Buffer {
  return createHash("sha256").update(getEnv().SESSION_SECRET).digest();
}

function seal(payload: SessionPayload): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", sessionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([iv, authTag, ciphertext]).toString("base64url");
}

function unseal(value: string): SessionPayload | null {
  try {
    const sealed = Buffer.from(value, "base64url");
    if (sealed.length <= IV_BYTES + AUTH_TAG_BYTES) {
      return null;
    }

    const iv = sealed.subarray(0, IV_BYTES);
    const authTag = sealed.subarray(IV_BYTES, IV_BYTES + AUTH_TAG_BYTES);
    const ciphertext = sealed.subarray(IV_BYTES + AUTH_TAG_BYTES);
    const decipher = createDecipheriv("aes-256-gcm", sessionKey(), iv);
    decipher.setAuthTag(authTag);
    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString("utf8");
    const payload: unknown = JSON.parse(plaintext);

    if (
      typeof payload !== "object" ||
      payload === null ||
      !("version" in payload) ||
      payload.version !== SESSION_VERSION ||
      !("memberId" in payload) ||
      !Number.isSafeInteger(payload.memberId) ||
      Number(payload.memberId) <= 0 ||
      !("expiresAt" in payload) ||
      !Number.isSafeInteger(payload.expiresAt) ||
      Number(payload.expiresAt) <= Date.now()
    ) {
      return null;
    }

    return payload as SessionPayload;
  } catch {
    return null;
  }
}

function cookieValue(request: Request): string | null {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) {
    return null;
  }

  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) {
      continue;
    }

    const name = part.slice(0, separator).trim();
    if (name === SESSION_COOKIE_NAME) {
      const value = part.slice(separator + 1).trim();
      try {
        return value ? decodeURIComponent(value) : null;
      } catch {
        return null;
      }
    }
  }

  return null;
}

function serializeSessionCookie(value: string, maxAge: number): string {
  const attributes = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
  ];

  if (maxAge === 0) {
    attributes.push("Expires=Thu, 01 Jan 1970 00:00:00 GMT");
  }
  if (process.env.NODE_ENV === "production") {
    attributes.push("Secure");
  }

  return attributes.join("; ");
}

export async function verifyLogin(
  email: string,
  password: string,
): Promise<AuthenticatedMember | null> {
  const [member] = await getDb()
    .select({
      email: members.email,
      id: members.id,
      name: members.name,
      passwordHash: members.passwordHash,
    })
    .from(members)
    .where(eq(members.email, email.trim().toLowerCase()))
    .limit(1);

  const passwordMatches = await compare(
    password,
    member?.passwordHash ?? INVALID_PASSWORD_HASH,
  );

  if (!member || !passwordMatches) {
    return null;
  }

  return { email: member.email, id: member.id, name: member.name };
}

export function createSessionCookie(memberId: number): string {
  const expiresAt = Date.now() + SESSION_MAX_AGE_SECONDS * 1000;
  return serializeSessionCookie(
    seal({ expiresAt, memberId, version: SESSION_VERSION }),
    SESSION_MAX_AGE_SECONDS,
  );
}

export function clearSessionCookie(): string {
  return serializeSessionCookie("", 0);
}

export function readSessionMemberId(request: Request): number | null {
  const value = cookieValue(request);
  return value ? unseal(value)?.memberId ?? null : null;
}

function unauthorized(): Response {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

export async function requireMember(
  request: Request,
): Promise<AuthenticatedMember> {
  const memberId = readSessionMemberId(request);
  if (memberId === null) {
    throw unauthorized();
  }

  const [member] = await getDb()
    .select({ email: members.email, id: members.id, name: members.name })
    .from(members)
    .where(eq(members.id, memberId))
    .limit(1);

  if (!member) {
    throw unauthorized();
  }

  return member;
}
