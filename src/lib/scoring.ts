import { todayInGroupZone, weekStartMonday } from "@/lib/week";

export const POINTS_PER_WORKOUT = 1;

type ScheduleRow = {
  date: string;
  isWorkout: boolean;
};

type WorkoutRow = {
  date: string;
};

export function missedDays(
  scheduleRows: readonly ScheduleRow[],
  workoutRows: readonly WorkoutRow[],
  week: string,
  now: Date,
): string[] {
  const today = todayInGroupZone(now);
  const workoutDates = new Set(workoutRows.map(({ date }) => date));

  return scheduleRows
    .filter(
      ({ date, isWorkout }) =>
        isWorkout &&
        date < today &&
        weekStartMonday(date) === week &&
        !workoutDates.has(date),
    )
    .map(({ date }) => date)
    .sort();
}
