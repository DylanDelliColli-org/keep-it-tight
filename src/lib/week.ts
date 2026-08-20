export const GROUP_TZ = "America/Toronto";

const groupDateFormatter = new Intl.DateTimeFormat("en-CA", {
  day: "2-digit",
  month: "2-digit",
  timeZone: GROUP_TZ,
  year: "numeric",
});

export function todayInGroupZone(now: Date): string {
  const parts = groupDateFormatter.formatToParts(now);
  const dateParts = new Map(parts.map(({ type, value }) => [type, value]));

  return `${dateParts.get("year")}-${dateParts.get("month")}-${dateParts.get("day")}`;
}

export function weekStartMonday(date: string): string {
  const instant = new Date(`${date}T00:00:00Z`);
  const daysSinceMonday = (instant.getUTCDay() + 6) % 7;
  instant.setUTCDate(instant.getUTCDate() - daysSinceMonday);

  return instant.toISOString().slice(0, 10);
}

export function isEditableScheduleDate(date: string, now: Date): boolean {
  return date > todayInGroupZone(now);
}
