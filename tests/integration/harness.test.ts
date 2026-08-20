import { compare } from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { members, scheduleDays, workouts } from "@/db/schema";
import { getDb } from "@/db";

import {
  closeTestPool,
  resolveTestDatabaseUrl,
  TEST_DATABASE_URL,
  testDb,
} from "./helpers/db";
import { FIXTURE_PASSWORD, seedMembers } from "./helpers/seed";

afterAll(async () => {
  await closeTestPool();
});

describe("migrations applied to the real database", () => {
  it("creates exactly the three tables the schema contract names", async () => {
    const result = await testDb.execute(
      sql`select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name`,
    );
    const tables = result.rows
      .map((row) => String(row.table_name))
      .filter((name) => name !== "__drizzle_migrations");

    expect(tables).toEqual(["members", "schedule_days", "workouts"]);
  });
});

describe("schema contract against real Postgres", () => {
  it("accepts two workouts for the same member on the same day", async () => {
    const seeded = await seedMembers(1);

    try {
      await testDb
        .insert(workouts)
        .values([
          { date: "2026-08-20", memberId: seeded.members[0].id },
          { date: "2026-08-20", memberId: seeded.members[0].id },
        ]);

      const rows = await testDb.select().from(workouts);

      expect(rows).toHaveLength(2);
    } finally {
      await seeded.cleanup();
    }
  });

  it("rejects a duplicate schedule declaration for one member and date", async () => {
    const seeded = await seedMembers(1);

    try {
      const day = {
        date: "2026-08-21",
        isWorkout: true,
        memberId: seeded.members[0].id,
      };
      await testDb.insert(scheduleDays).values(day);

      await expect(testDb.insert(scheduleDays).values(day)).rejects.toThrow();
    } finally {
      await seeded.cleanup();
    }
  });
});

describe("getDb composition through the production driver", () => {
  it("round-trips a member", async () => {
    const db = getDb();
    const [inserted] = await db
      .insert(members)
      .values({
        email: "round-trip@example.com",
        name: "Round Trip",
        passwordHash: "not-a-real-hash",
      })
      .returning();

    try {
      const found = await db.select().from(members);

      expect(found.map((row) => row.email)).toContain("round-trip@example.com");
    } finally {
      await testDb.delete(members).where(sql`${members.id} = ${inserted.id}`);
    }
  });
});

describe("integration database isolation", () => {
  it("pins the test and production drivers to the loopback container", () => {
    expect(TEST_DATABASE_URL).toBe(
      "postgresql://postgres:postgres@127.0.0.1:5433/postgres",
    );
    expect(process.env.DATABASE_URL).toBe(TEST_DATABASE_URL);
  });

  it("rejects a configured non-loopback host and names it", () => {
    expect(() =>
      resolveTestDatabaseUrl({
        CONTEST_TEST_DATABASE_URL:
          "postgresql://user:pw@db.example.com:5432/prod",
      }),
    ).toThrow(/db\.example\.com/);
  });

  it("rejects a query parameter that overrides the authority host", () => {
    expect(() =>
      resolveTestDatabaseUrl({
        CONTEST_TEST_DATABASE_URL:
          "postgresql://u:pw@127.0.0.1:5433/db?host=db.example.com",
      }),
    ).toThrow(/db\.example\.com/);
  });

  it("rejects a query parameter that redirects to a Unix socket", () => {
    expect(() =>
      resolveTestDatabaseUrl({
        CONTEST_TEST_DATABASE_URL:
          "postgresql://u:pw@127.0.0.1:5433/db?host=%2Fvar%2Frun%2Fpostgresql",
      }),
    ).toThrow(/\/var\/run\/postgresql/);
  });
});

describe("seed and cleanup closures", () => {
  it("inserts the requested members and removes them again", async () => {
    const seeded = await seedMembers(3);

    expect(seeded.members).toHaveLength(3);
    expect(await testDb.select().from(members)).toHaveLength(3);

    await seeded.cleanup();

    expect(await testDb.select().from(members)).toHaveLength(0);
  });

  it("stores a real cost-4 bcrypt hash for the fixture password", async () => {
    const seeded = await seedMembers(1);

    try {
      const [stored] = await testDb
        .select({ passwordHash: members.passwordHash })
        .from(members)
        .where(eq(members.id, seeded.members[0].id));

      expect(stored.passwordHash).toMatch(/^\$2[aby]\$04\$/);
      expect(stored.passwordHash).toHaveLength(60);
      await expect(compare(FIXTURE_PASSWORD, stored.passwordHash)).resolves.toBe(
        true,
      );
    } finally {
      await seeded.cleanup();
    }
  });
});
