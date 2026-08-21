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

const CANONICAL_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Dates are compared lexically below, so a non-canonical string such as
// "2026-8-21" would sort above "2026-08-20" and slip past the freeze gate.
function parseCanonicalDate(date: string): Date {
  if (!CANONICAL_DATE.test(date)) {
    throw new RangeError(`Expected a canonical YYYY-MM-DD date, got "${date}"`);
  }

  const instant = new Date(`${date}T00:00:00Z`);

  if (Number.isNaN(instant.getTime())) {
    throw new RangeError(`"${date}" is not a valid date`);
  }

  // Date normalizes impossible days: "2026-02-30" silently becomes March 2.
  if (instant.toISOString().slice(0, 10) !== date) {
    throw new RangeError(`"${date}" is not a real calendar date`);
  }

  return instant;
}

export function weekStartMonday(date: string): string {
  const instant = parseCanonicalDate(date);
  const daysSinceMonday = (instant.getUTCDay() + 6) % 7;
  instant.setUTCDate(instant.getUTCDate() - daysSinceMonday);

  return instant.toISOString().slice(0, 10);
}

export function isEditableScheduleDate(date: string, now: Date): boolean {
  parseCanonicalDate(date);

  return date > todayInGroupZone(now);
}
