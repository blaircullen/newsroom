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
