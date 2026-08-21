import {
  boolean,
  date,
  integer,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const members = pgTable("members", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const scheduleDays = pgTable(
  "schedule_days",
  {
    memberId: integer("member_id")
      .notNull()
      .references(() => members.id),
    date: date("date").notNull(),
    isWorkout: boolean("is_workout").notNull(),
  },
  (table) => [primaryKey({ columns: [table.memberId, table.date] })],
);

export const workouts = pgTable("workouts", {
  id: serial("id").primaryKey(),
  memberId: integer("member_id")
    .notNull()
    .references(() => members.id),
  date: date("date").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
