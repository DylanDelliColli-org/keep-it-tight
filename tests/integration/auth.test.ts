import { readdir } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";

import { count, eq } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import { members, scheduleDays, workouts } from "@/db/schema";
import {
  createSessionCookie,
  requireMember,
  SESSION_COOKIE_NAME,
} from "@/lib/auth";
import { POST as login } from "@/app/api/login/route";
import { POST as logout } from "@/app/api/logout/route";
import {
  PRODUCTION_BCRYPT_COST,
  provisionMembers,
  type SeedMemberInput,
} from "../../scripts/seed-members";

import { closeTestPool, testDb } from "./helpers/db";
import { FIXTURE_PASSWORD, seedMembers, type Seeded } from "./helpers/seed";

const APP_ROOT = resolve(process.cwd(), "src/app");
const API_ROOT = resolve(APP_ROOT, "api");
const AUTH_FAILURE_BODY = { error: "Invalid email or password" };

type AuthenticatedMutationCase = {
  invoke: (request: Request) => Promise<Response>;
  method: string;
  path: string;
  rowCount: () => Promise<number>;
};

// Each later mutation bead appends its handler here. Login and logout are
// intentionally excluded by ADR decision 9.
const authenticatedMutationCases: AuthenticatedMutationCase[] = [];

function requestJson(path: string, body: unknown): Request {
  return new Request(`http://localhost${path}`, {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
}

function requestCookie(setCookie: string): string {
  return setCookie.split(";", 1)[0];
}

async function responseThrownBy(
  operation: () => Promise<unknown>,
): Promise<Response> {
  try {
    await operation();
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    throw error;
  }

  throw new Error("Expected operation to throw a Response");
}

async function filesUnder(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = resolve(directory, entry.name);
      return entry.isDirectory() ? filesUnder(path) : [path];
    }),
  );

  return nested.flat();
}

async function tableCount(
  table: typeof members | typeof scheduleDays | typeof workouts,
): Promise<number> {
  const [result] = await testDb.select({ value: count() }).from(table);
  return result.value;
}

describe("self-auth route contract", () => {
  let seeded: Seeded;

  beforeEach(async () => {
    seeded = await seedMembers(3);
  });

  afterEach(async () => {
    await seeded.cleanup();
  });

  it("logs in a seeded member and authenticates the next request", async () => {
    const member = seeded.members[0];
    const response = await login(
      requestJson("/api/login", {
        email: member.email,
        password: FIXTURE_PASSWORD,
      }),
    );

    expect(response.status).toBe(200);
    const setCookie = response.headers.get("set-cookie");
    expect(setCookie).toBeTruthy();
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Lax/i);

    const followUp = new Request("http://localhost/api/workouts", {
      headers: { cookie: requestCookie(setCookie!) },
      method: "POST",
    });
    await expect(requireMember(followUp)).resolves.toMatchObject({
      email: member.email,
      id: member.id,
      name: member.name,
    });
  });

  it("returns 401 without a cookie for each authenticated mutation and writes no rows", async () => {
    for (const testCase of authenticatedMutationCases) {
      const before = await testCase.rowCount();
      const response = await testCase.invoke(
        new Request(`http://localhost${testCase.path}`, {
          headers: { "content-type": "application/json" },
          method: testCase.method,
        }),
      );

      expect(response.status, `${testCase.method} ${testCase.path}`).toBe(401);
      await expect(testCase.rowCount()).resolves.toBe(before);
    }

    expect(authenticatedMutationCases).toHaveLength(0);
    await expect(tableCount(scheduleDays)).resolves.toBe(0);
    await expect(tableCount(workouts)).resolves.toBe(0);
  });

  it("returns 401 without a cookie for a bad password", async () => {
    const badPassword = await login(
      requestJson("/api/login", {
        email: seeded.members[0].email,
        password: "wrong-password",
      }),
    );

    expect(badPassword.status).toBe(401);
    expect(badPassword.headers.has("set-cookie")).toBe(false);
    await expect(badPassword.json()).resolves.toEqual(AUTH_FAILURE_BODY);
  });

  it("uses the identical 401 response for an unknown email", async () => {
    const unknownEmail = await login(
      requestJson("/api/login", {
        email: "nobody@example.com",
        password: FIXTURE_PASSWORD,
      }),
    );

    expect(unknownEmail.status).toBe(401);
    expect(unknownEmail.headers.has("set-cookie")).toBe(false);
    await expect(unknownEmail.json()).resolves.toEqual(AUTH_FAILURE_BODY);
  });

  it("rejects a tampered cookie without writing rows", async () => {
    const request = new Request("http://localhost/api/schedule", {
      headers: { cookie: `${SESSION_COOKIE_NAME}=garbage` },
      method: "PUT",
    });
    const response = await responseThrownBy(() => requireMember(request));

    expect(response.status).toBe(401);
    await expect(tableCount(scheduleDays)).resolves.toBe(0);
    await expect(tableCount(workouts)).resolves.toBe(0);
  });

  it("allows only the ADR mutation surface and has no signup path", async () => {
    const apiFiles = await filesUnder(API_ROOT);
    const routePaths = apiFiles
      .filter((path) => path.endsWith(`${sep}route.ts`))
      .map((path) => relative(API_ROOT, path).split(sep).slice(0, -1).join("/"))
      .sort();
    const allowedRoutes = [
      "login",
      "logout",
      "meals",
      "schedule",
      "workouts",
      "workouts/[id]",
    ];

    expect(routePaths.every((route) => allowedRoutes.includes(route))).toBe(
      true,
    );
    expect(routePaths).toEqual(["login", "logout"]);

    const appFiles = await filesUnder(APP_ROOT);
    const forbiddenSegment = /(^|[\\/])(signup|register|sign-up)([\\/]|$)/i;
    expect(
      appFiles.map((path) => relative(APP_ROOT, path)).filter((path) =>
        forbiddenSegment.test(path),
      ),
    ).toEqual([]);
  });

  it("logout clears a valid cookie and the emptied cookie is unauthorized", async () => {
    const sessionCookie = createSessionCookie(seeded.members[0].id);
    const response = await logout(
      new Request("http://localhost/api/logout", {
        headers: { cookie: requestCookie(sessionCookie) },
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    const clearingCookie = response.headers.get("set-cookie");
    expect(clearingCookie).toMatch(new RegExp(`^${SESSION_COOKIE_NAME}=`));
    expect(clearingCookie).toMatch(/Max-Age=0/i);

    const emptiedCookie = requestCookie(clearingCookie!);
    const unauthorized = await responseThrownBy(() =>
      requireMember(
        new Request("http://localhost/api/workouts", {
          headers: { cookie: emptiedCookie },
          method: "POST",
        }),
      ),
    );
    expect(unauthorized.status).toBe(401);

    const sessionlessLogout = await logout(
      new Request("http://localhost/api/logout", { method: "POST" }),
    );
    expect(sessionlessLogout.status).toBe(200);
    expect(sessionlessLogout.headers.get("set-cookie")).toMatch(/Max-Age=0/i);
  });
});

describe("member provisioning", () => {
  afterEach(async () => {
    await testDb.delete(workouts);
    await testDb.delete(scheduleDays);
    await testDb.delete(members);
  });

  it("upserts exactly three accounts by email", async () => {
    const inputs: SeedMemberInput[] = [1, 2, 3].map((number) => ({
      email: `seed-${number}@example.com`,
      name: `Seed ${number}`,
      password: `fixture-seed-password-${number}`,
    }));

    await provisionMembers(inputs, 4, testDb);
    await provisionMembers(
      inputs.map((input) => ({ ...input, name: `${input.name} Updated` })),
      4,
      testDb,
    );

    const rows = await testDb.select().from(members);
    expect(PRODUCTION_BCRYPT_COST).toBeGreaterThan(4);
    expect(rows).toHaveLength(3);
    expect(rows.map(({ name }) => name).sort()).toEqual([
      "Seed 1 Updated",
      "Seed 2 Updated",
      "Seed 3 Updated",
    ]);
  });

  it("replaces a removed history-free account and disables its login", async () => {
    const retainedInputs: SeedMemberInput[] = [2, 3].map((number) => ({
      email: `seed-${number}@example.com`,
      name: `Seed ${number}`,
      password: `fixture-seed-password-${number}`,
    }));
    const oldInput: SeedMemberInput = {
      email: "seed-old@example.com",
      name: "Seed Old",
      password: "fixture-seed-password-old",
    };
    const newInput: SeedMemberInput = {
      email: "seed-new@example.com",
      name: "Seed New",
      password: "fixture-seed-password-new",
    };

    await provisionMembers([oldInput, ...retainedInputs], 4, testDb);
    const staleLoginBeforeRotation = await login(
      requestJson("/api/login", {
        email: oldInput.email,
        password: oldInput.password,
      }),
    );
    expect(staleLoginBeforeRotation.status).toBe(200);

    await provisionMembers([newInput, ...retainedInputs], 4, testDb);

    const rows = await testDb.select().from(members);
    const staleLoginAfterRotation = await login(
      requestJson("/api/login", {
        email: oldInput.email,
        password: oldInput.password,
      }),
    );
    expect({
      memberRows: rows.length,
      staleAccountLoginStatus: staleLoginAfterRotation.status,
    }).toEqual({ memberRows: 3, staleAccountLoginStatus: 401 });
  });

  it("refuses to remove an account that owns schedule or workout history", async () => {
    const retainedInputs: SeedMemberInput[] = [2, 3].map((number) => ({
      email: `seed-${number}@example.com`,
      name: `Seed ${number}`,
      password: `fixture-seed-password-${number}`,
    }));
    const oldInput: SeedMemberInput = {
      email: "seed-old@example.com",
      name: "Seed Old",
      password: "fixture-seed-password-old",
    };
    const newInput: SeedMemberInput = {
      email: "seed-new@example.com",
      name: "Seed New",
      password: "fixture-seed-password-new",
    };

    await provisionMembers([oldInput, ...retainedInputs], 4, testDb);
    const [oldMember] = await testDb
      .select()
      .from(members)
      .where(eq(members.email, oldInput.email));
    await testDb.insert(scheduleDays).values({
      date: "2026-08-25",
      isWorkout: true,
      memberId: oldMember.id,
    });
    await testDb.insert(workouts).values({
      date: "2026-08-21",
      memberId: oldMember.id,
    });

    await expect(
      provisionMembers([newInput, ...retainedInputs], 4, testDb),
    ).rejects.toThrow(/history/i);

    await expect(testDb.select().from(members)).resolves.toHaveLength(3);
    await expect(testDb.select().from(scheduleDays)).resolves.toHaveLength(1);
    await expect(testDb.select().from(workouts)).resolves.toHaveLength(1);
  });
});

afterAll(async () => {
  await closeTestPool();
});
