import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "@/db/schema";
import { getEnv } from "@/env";

let database: NodePgDatabase<typeof schema> | undefined;

export function getDb(): NodePgDatabase<typeof schema> {
  if (!database) {
    const pool = new Pool({ connectionString: getEnv().DATABASE_URL });
    database = drizzle(pool, { schema });
  }

  return database;
}
