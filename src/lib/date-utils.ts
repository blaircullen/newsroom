/**
 * Convert a Date to Eastern Time day-of-week and hour.
 */
export function toET(date: Date): { dayOfWeek: number; hour: number } {
  const etStr = date.toLocaleString('en-US', { timeZone: 'America/New_York' });
  const etDate = new Date(etStr);
  return {
    dayOfWeek: etDate.getDay(), // 0=Sun, 6=Sat
    hour: etDate.getHours(),
  };
}

/**
 * Get the current time interpreted as Eastern Time.
 * Returns a Date whose local methods (getHours, getDay, etc.) reflect ET.
 */
export function nowET(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
}

/**
 * Get today's midnight in Eastern Time as a Date suitable for DB queries.
 * The returned Date has time set to 00:00:00.000.
 */
export function todayET(): Date {
  const et = nowET();
  et.setHours(0, 0, 0, 0);
  return et;
}

/**
 * Convert any UTC Date to its Eastern Time representation.
 * The returned Date's local methods reflect ET values.
 */
export function utcToET(date: Date): Date {
  return new Date(date.toLocaleString('en-US', { timeZone: 'America/New_York' }));
}

/**
 * Get the ET date string (YYYY-MM-DD) for a given Date.
 */
export function etDateString(date: Date = new Date()): string {
  return date.toLocaleDateString('en-CA', { timeZone: 'America/New_York' }); // en-CA gives YYYY-MM-DD
}

/**
 * Get the UTC Date representing midnight ET for a given YYYY-MM-DD date string.
 * Useful for creating DB query boundaries from ET date strings.
 */
export function etMidnightToUTC(dateStr: string): Date {
  // Use noon UTC to safely determine the ET offset (avoids DST edge cases)
  const noon = new Date(`${dateStr}T12:00:00Z`);
  const etNoon = new Date(noon.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const offsetMs = noon.getTime() - etNoon.getTime();
  // Midnight ET in UTC = midnight UTC + ET offset
  const midnightUTC = new Date(`${dateStr}T00:00:00Z`);
  return new Date(midnightUTC.getTime() + offsetMs);
}

/**
 * Format a Date as a datetime-local input value (YYYY-MM-DDTHH:MM) in ET.
 * Works on both client and server.
 */
export function etDatetimeLocalValue(date: Date = new Date()): string {
  const d = date.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  const t = date.toLocaleTimeString('en-GB', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `${d}T${t}`;
}
