export type Milestone = { id: string; title: string; date: string };

export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00Z');
  return !Number.isNaN(+date) && date.toISOString().slice(0, 10) === value && value >= '1900-01-01';
}

export function calendarToday() {
  const now = new Date();
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
}

export function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
}

export function daysLabel(days: number) {
  const n = Math.abs(days);
  const last = n % 10;
  const teen = n % 100 >= 11 && n % 100 <= 14;
  return `${n.toLocaleString('ru-RU')} ${!teen && last === 1 ? 'день' : !teen && last >= 2 && last <= 4 ? 'дня' : 'дней'}`;
}

export function formatDate(date: string) {
  return new Intl.DateTimeFormat('ru-RU', {day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC'}).format(new Date(date));
}
