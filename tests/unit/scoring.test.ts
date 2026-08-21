import { describe, expect, it } from "vitest";

import * as scoring from "@/lib/scoring";

describe("scoring", () => {
  it("keeps one point per workout as the scoring contract", () => {
    expect(scoring.POINTS_PER_WORKOUT).toBe(1);
  });

  it("reports only past declared workout days with no workout", () => {
    const scheduleRows = [
      { date: "2026-08-17", isWorkout: true },
      { date: "2026-08-18", isWorkout: true },
      { date: "2026-08-19", isWorkout: false },
      { date: "2026-08-20", isWorkout: true },
    ];
    const workoutRows = [{ date: "2026-08-17" }];

    expect(
      scoring.missedDays(
        scheduleRows,
        workoutRows,
        "2026-08-17",
        new Date("2026-08-20T12:00:00Z"),
      ),
    ).toEqual(["2026-08-18"]);
  });

  it("does not expose a second score-total implementation", () => {
    expect(Object.keys(scoring).sort()).toEqual([
      "POINTS_PER_WORKOUT",
      "missedDays",
    ]);
  });
});
