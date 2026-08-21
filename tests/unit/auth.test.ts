import { beforeAll, describe, expect, it } from "vitest";

import {
  createSessionCookie,
  readSessionMemberId,
  SESSION_COOKIE_NAME,
} from "@/lib/auth";

describe("sealed session cookies", () => {
  beforeAll(() => {
    process.env.DATABASE_URL =
      "postgresql://unused:unused@127.0.0.1:5433/unused";
    process.env.SESSION_SECRET =
      "unit-test-session-secret-that-is-at-least-thirty-two-bytes";
  });

  it("round-trips the member id without exposing it as plaintext", () => {
    const setCookie = createSessionCookie(42);
    const cookie = setCookie.split(";", 1)[0];
    const request = new Request("http://localhost", {
      headers: { cookie },
    });

    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Lax/i);
    const sealedValue = cookie.slice(cookie.indexOf("=") + 1);
    expect(() =>
      JSON.parse(Buffer.from(sealedValue, "base64url").toString("utf8")),
    ).toThrow();
    expect(readSessionMemberId(request)).toBe(42);
  });

  it.each([
    ["IV", 0],
    ["ciphertext", 12 + 16],
    ["authentication tag", 12],
  ])("rejects a seal with a flipped %s byte", (_region, byteIndex) => {
    const cookie = createSessionCookie(7).split(";", 1)[0];
    const [name, value] = cookie.split("=");
    const originalBytes = Buffer.from(value, "base64url");
    const tamperedBytes = Buffer.from(originalBytes);
    tamperedBytes[byteIndex] ^= 1;
    const tamperedValue = tamperedBytes.toString("base64url");
    const tampered = `${name}=${tamperedValue}`;

    expect(name).toBe(SESSION_COOKIE_NAME);
    expect(tamperedBytes.equals(originalBytes)).toBe(false);
    expect(
      readSessionMemberId(
        new Request("http://localhost", { headers: { cookie: tampered } }),
      ),
    ).toBeNull();
  });

  it("rejects malformed seal encoding", () => {
    expect(
      readSessionMemberId(
        new Request("http://localhost", {
          headers: { cookie: `${SESSION_COOKIE_NAME}=%` },
        }),
      ),
    ).toBeNull();
  });
});
