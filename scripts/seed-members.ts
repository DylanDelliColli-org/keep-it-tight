import { pathToFileURL } from "node:url";

import { hash } from "bcryptjs";
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

function membersFromArguments(arguments_: string[]): SeedMemberInput[] {
  if (arguments_.every((argument) => argument !== "--member")) {
    if (arguments_.length !== 9) {
      throw new Error(
        "Pass nine positional values (name email password, repeated three times) or three --member name email password groups",
      );
    }

    return [0, 3, 6].map((offset) => ({
      email: arguments_[offset + 1],
      name: arguments_[offset],
      password: arguments_[offset + 2],
    }));
  }

  const result: SeedMemberInput[] = [];
  for (let index = 0; index < arguments_.length; index += 4) {
    if (
      arguments_[index] !== "--member" ||
      arguments_.slice(index + 1, index + 4).length !== 3
    ) {
      throw new Error(
        "Each member must be passed as --member name email password",
      );
    }

    result.push({
      email: arguments_[index + 2],
      name: arguments_[index + 1],
      password: arguments_[index + 3],
    });
  }

  return result;
}

export function readSeedMembers(
  arguments_: string[] = process.argv.slice(2),
  environment: SeedEnvironment = process.env,
): SeedMemberInput[] {
  const candidates = arguments_.length
    ? membersFromArguments(arguments_)
    : [1, 2, 3].map((index) => memberFromEnvironment(index, environment));
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
