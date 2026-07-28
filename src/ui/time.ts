/**
 * Time formatting for display. One home for it, so the app speaks about time
 * consistently wherever it comes up.
 *
 * Kept free of native imports so it stays testable without a device standing by.
 */

/** mm:ss for the session clock. Minutes unpadded — "5:00" reads calmer. */
export function formatRemaining(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Whole minutes for the same clock, rounded up: "2" covers 2:00 down to 1:01.
 *
 * A sibling of `formatRemaining` rather than a mode of it, because the two are
 * read differently — one is a countdown you can follow, the other is roughly
 * how much is left.
 */
export function formatRemainingMinutes(ms: number): string {
  return String(Math.ceil(ms / 60_000));
}

/** Total time sat, as "4h 20m" / "45m". Rounded down — never flatter. */
export function formatTotal(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  const hours = Math.floor(minutes / 60);
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes % 60}m`;
}

/** "12 Mar 2026" — unambiguous, and no leading zero to read past. */
export function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** "07:30" from a Date, for storing a reminder time. */
export function toHhMm(date: Date): string {
  return `${date.getHours().toString().padStart(2, '0')}:${date
    .getMinutes()
    .toString()
    .padStart(2, '0')}`;
}

/** A Date at today's date and the given "HH:MM", for seeding the time picker. */
export function fromHhMm(hhmm: string): Date {
  const [hour, minute] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d;
}
