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
 * Handles DST transitions correctly by checking the offset at midnight specifically.
 */
export function etMidnightToUTC(dateStr: string): Date {
  // Start with a guess: use 05:00 UTC (midnight EST) as initial candidate
  const guess = new Date(`${dateStr}T05:00:00Z`);
  // Find out what ET time this actually is
  const etStr = guess.toLocaleString('en-US', { timeZone: 'America/New_York' });
  const etDate = new Date(etStr);
  // Calculate the difference between our guess and midnight on the target date
  const targetMidnight = new Date(`${dateStr}T00:00:00`);
  const diffMs = etDate.getTime() - targetMidnight.getTime();
  // Adjust: subtract the difference to land on midnight ET
  const result = new Date(guess.getTime() - diffMs);
  return result;
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
