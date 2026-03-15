import { format } from 'date-fns';

/**
 * Generates a Google Calendar "Add Event" URL from visit data.
 * Opens in a new tab — no API or OAuth needed.
 */
export function buildGoogleCalendarUrl(params: {
  title: string;
  startDate: Date;
  durationMinutes?: number;
  location?: string;
  description?: string;
}): string {
  const { title, startDate, durationMinutes = 60, location, description } = params;

  const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);

  const fmt = (d: Date) => format(d, "yyyyMMdd'T'HHmmss");

  const url = new URL('https://calendar.google.com/calendar/render');
  url.searchParams.set('action', 'TEMPLATE');
  url.searchParams.set('text', title);
  url.searchParams.set('dates', `${fmt(startDate)}/${fmt(endDate)}`);
  if (location) url.searchParams.set('location', location);
  if (description) url.searchParams.set('details', description);

  return url.toString();
}

/**
 * Opens the Google Calendar "Add Event" page in a new tab.
 */
export function openGoogleCalendar(params: {
  title: string;
  startDate: Date;
  durationMinutes?: number;
  location?: string;
  description?: string;
}) {
  window.open(buildGoogleCalendarUrl(params), '_blank', 'noopener');
}
