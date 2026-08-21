import { pathToFileURL } from "node:url";

import { hash } from "bcryptjs";
import { count, inArray, notInArray, sql } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { z } from "zod";

import { getDb } from "@/db";
import * as schema from "@/db/schema";
import { getEnv } from "@/env";

export const PRODUCTION_BCRYPT_COST = 12;

const memberSchema = z.object({
  email: z.string().email().transform((email) => email.trim().toLowerCase()),
  name: z.string().trim().min(1),
  password: z.string().min(12),
});

export type SeedMemberInput = z.input<typeof memberSchema>;
type ContestDatabase = NodePgDatabase<typeof schema>;
type SeedEnvironment = Readonly<Record<string, string | undefined>>;

function memberFromEnvironment(
  index: number,
  environment: SeedEnvironment,
): SeedMemberInput {
  const prefix = `MEMBER_${index}`;
  return {
    email: environment[`${prefix}_EMAIL`] ?? "",
    name: environment[`${prefix}_NAME`] ?? "",
    password: environment[`${prefix}_PASSWORD`] ?? "",
  };
}

export function readSeedMembers(
  arguments_: string[] = process.argv.slice(2),
  environment: SeedEnvironment = process.env,
): SeedMemberInput[] {
  // The supported path passes the three real account passwords through the
  // environment (normally loaded from .env.local). That file is gitignored
  // and must never be committed; this is a deliberate local-secret tradeoff.
  if (arguments_.length > 0) {
    throw new Error(
      "Command-line member arguments are not supported because they expose plaintext passwords; use the MEMBER_1_*, MEMBER_2_*, and MEMBER_3_* environment variables",
    );
  }

  const candidates = [1, 2, 3].map((index) =>
    memberFromEnvironment(index, environment),
  );
  const parsed = z.array(memberSchema).length(3).parse(candidates);

  if (new Set(parsed.map(({ email }) => email)).size !== 3) {
    throw new Error("The three seeded member emails must be unique");
  }

  return parsed;
}

export async function provisionMembers(
  inputs: SeedMemberInput[],
  bcryptCost = PRODUCTION_BCRYPT_COST,
  database: ContestDatabase = getDb(),
): Promise<void> {
  const parsed = z.array(memberSchema).length(3).parse(inputs);
  if (new Set(parsed.map(({ email }) => email)).size !== 3) {
    throw new Error("The three seeded member emails must be unique");
  }

  const prepared = await Promise.all(
    parsed.map(async (member) => ({
      email: member.email,
      name: member.name,
      passwordHash: await hash(member.password, bcryptCost),
    })),
  );

  await database.transaction(async (transaction) => {
    // Provisioning is a whole-set replacement. Serialize concurrent operator
    // runs so two different requested sets cannot interleave into a union.
    await transaction.execute(
      sql`select pg_advisory_xact_lock(hashtext('contest:seed-members'))`,
    );

    const requestedEmails = prepared.map(({ email }) => email);
    const removedMembers = await transaction
      .select({ email: schema.members.email, id: schema.members.id })
      .from(schema.members)
      .where(notInArray(schema.members.email, requestedEmails));

    if (removedMembers.length > 0) {
      const removedMemberIds = removedMembers.map(({ id }) => id);
      const [[scheduleHistory], [workoutHistory]] = await Promise.all([
        transaction
          .select({ value: count() })
          .from(schema.scheduleDays)
          .where(inArray(schema.scheduleDays.memberId, removedMemberIds)),
        transaction
          .select({ value: count() })
          .from(schema.workouts)
          .where(inArray(schema.workouts.memberId, removedMemberIds)),
      ]);

      if (scheduleHistory.value > 0 || workoutHistory.value > 0) {
        throw new Error(
          `Refusing to remove member history (${scheduleHistory.value} schedule days, ${workoutHistory.value} workouts) for: ${removedMembers.map(({ email }) => email).join(", ")}`,
        );
      }

      await transaction
        .delete(schema.members)
        .where(inArray(schema.members.id, removedMemberIds));
    }

    for (const member of prepared) {
      await transaction
        .insert(schema.members)
        .values(member)
        .onConflictDoUpdate({
          set: { name: member.name, passwordHash: member.passwordHash },
          target: schema.members.email,
        });
    }
  });
}

async function main(): Promise<void> {
  const inputs = readSeedMembers();
  const pool = new Pool({ connectionString: getEnv().DATABASE_URL });

  try {
    await provisionMembers(
      inputs,
      PRODUCTION_BCRYPT_COST,
      drizzle(pool, { schema }),
    );
    console.log("Provisioned three member accounts.");
  } finally {
    await pool.end();
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
