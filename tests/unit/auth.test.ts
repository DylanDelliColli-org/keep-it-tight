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

  it("rejects a modified seal", () => {
    const cookie = createSessionCookie(7).split(";", 1)[0];
    const [name, value] = cookie.split("=");
    const finalCharacter = value.at(-1) === "a" ? "b" : "a";
    const tampered = `${name}=${value.slice(0, -1)}${finalCharacter}`;

    expect(name).toBe(SESSION_COOKIE_NAME);
    expect(
      readSessionMemberId(
        new Request("http://localhost", { headers: { cookie: tampered } }),
      ),
    ).toBeNull();
    expect(
      readSessionMemberId(
        new Request("http://localhost", {
          headers: { cookie: `${SESSION_COOKIE_NAME}=%` },
        }),
      ),
    ).toBeNull();
  });
});
