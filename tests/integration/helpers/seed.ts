import { hash } from "bcryptjs";

import { members, scheduleDays, workouts } from "@/db/schema";

import { testDb } from "./db";

export type SeededMember = {
  email: string;
  id: number;
  name: string;
};

export type Seeded = {
  cleanup: () => Promise<void>;
  members: SeededMember[];
};

export const FIXTURE_PASSWORD = "fixture-password";

/**
 * Inserts `count` members and returns them with a closure that removes
 * everything the fixture touched. Cleanup deletes rather than resetting the
 * database: a per-run reset would eat the suite's wall-clock budget on its own.
 */
export async function seedMembers(count: number): Promise<Seeded> {
  const passwordHash = await hash(FIXTURE_PASSWORD, 4);
  const inserted = await testDb
    .insert(members)
    .values(
      Array.from({ length: count }, (_, index) => ({
        email: `member${index + 1}@example.com`,
        name: `Member ${index + 1}`,
        passwordHash,
      })),
    )
    .returning();

  return {
    cleanup: async () => {
      await testDb.delete(workouts);
      await testDb.delete(scheduleDays);
      await testDb.delete(members);
    },
    members: inserted.map(({ email, id, name }) => ({ email, id, name })),
  };
}
