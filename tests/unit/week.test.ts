import { describe, expect, it } from "vitest";

import {
  isEditableScheduleDate,
  todayInGroupZone,
  weekStartMonday,
} from "@/lib/week";

describe("todayInGroupZone", () => {
  it("uses Toronto midnight rather than UTC midnight", () => {
    expect(todayInGroupZone(new Date("2026-08-20T03:59:00Z"))).toBe(
      "2026-08-19",
    );
    expect(todayInGroupZone(new Date("2026-08-20T04:00:00Z"))).toBe(
      "2026-08-20",
    );
  });

  it("handles the spring-forward transition", () => {
    expect(todayInGroupZone(new Date("2026-03-08T04:59:00Z"))).toBe(
      "2026-03-07",
    );
    expect(todayInGroupZone(new Date("2026-03-08T05:00:00Z"))).toBe(
      "2026-03-08",
    );
    expect(todayInGroupZone(new Date("2026-03-08T06:59:00Z"))).toBe(
      "2026-03-08",
    );
    expect(todayInGroupZone(new Date("2026-03-08T07:00:00Z"))).toBe(
      "2026-03-08",
    );
    expect(todayInGroupZone(new Date("2026-03-09T03:59:00Z"))).toBe(
      "2026-03-08",
    );
    expect(todayInGroupZone(new Date("2026-03-09T04:00:00Z"))).toBe(
      "2026-03-09",
    );
  });

  it("handles the repeated hour during fall-back", () => {
    expect(todayInGroupZone(new Date("2026-11-01T05:30:00Z"))).toBe(
      "2026-11-01",
    );
    expect(todayInGroupZone(new Date("2026-11-01T06:30:00Z"))).toBe(
      "2026-11-01",
    );
    expect(todayInGroupZone(new Date("2026-11-02T04:59:00Z"))).toBe(
      "2026-11-01",
    );
    expect(todayInGroupZone(new Date("2026-11-02T05:00:00Z"))).toBe(
      "2026-11-02",
    );
  });
});

describe("weekStartMonday", () => {
  it("keeps a Monday and maps the following Sunday to it", () => {
    expect(weekStartMonday("2026-08-17")).toBe("2026-08-17");
    expect(weekStartMonday("2026-08-23")).toBe("2026-08-17");
  });

  it("crosses a year boundary", () => {
    expect(weekStartMonday("2026-01-01")).toBe("2025-12-29");
  });

  it("rolls from Sunday to Monday at Toronto midnight", () => {
    const beforeMidnight = new Date("2026-08-24T03:59:00Z");
    const atMidnight = new Date("2026-08-24T04:00:00Z");

    expect(weekStartMonday(todayInGroupZone(beforeMidnight))).toBe(
      "2026-08-17",
    );
    expect(weekStartMonday(todayInGroupZone(atMidnight))).toBe("2026-08-24");
  });
});

describe("isEditableScheduleDate", () => {
  it("only permits dates strictly after today in Toronto", () => {
    const atMidnight = new Date("2026-08-20T04:00:00Z");

    expect(isEditableScheduleDate("2026-08-19", atMidnight)).toBe(false);
    expect(isEditableScheduleDate("2026-08-20", atMidnight)).toBe(false);
    expect(isEditableScheduleDate("2026-08-21", atMidnight)).toBe(true);
  });

  it("still permits the upcoming Toronto date before midnight", () => {
    const beforeMidnight = new Date("2026-08-20T03:59:00Z");

    expect(isEditableScheduleDate("2026-08-20", beforeMidnight)).toBe(true);
  });
});
