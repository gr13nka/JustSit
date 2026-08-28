/**
 * Time formatting for display. One home for it, so the app speaks about time
 * consistently wherever it comes up.
 *
 * It is also the only place in the app that formats a *date*, and that part has
 * to stay in one place: both date functions below compose their months against
 * a pinned locale rather than the phone's, because the fonts are subset to
 * Latin and a month taken from the device would come back as tofu on a handset
 * set to Russian. See `LOCALE`.
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

/**
 * Named rather than left to the device.
 *
 * Every string in this app is English and the fonts are subset to Latin — the
 * three weights of M PLUS Rounded 1c ship without CJK or Cyrillic coverage
 * precisely because none is needed. A month taken from the phone's locale would
 * therefore not merely read oddly beside "Your garden"; on a Russian handset it
 * would come back as tofu, and it would do it only on that handset.
 */
const LOCALE = 'en';

/**
 * When a garden ran, as the months it spanned: "Feb", "Feb – Mar".
 *
 * Months and not days, because a garden's length in days was never a fact about
 * it — one sitting can grow two or three plants, so the same size takes wildly
 * different times to fill and printing that would be inventing a pace. What is
 * true is roughly when it was, and that is what a shelf wants beside a
 * thumbnail.
 *
 * The year appears only when the range crosses one, where the months alone
 * would read backwards.
 */
export function formatMonthRange(from: number, to: number): string {
  const start = new Date(from);
  const end = new Date(to);

  const month = (d: Date) => d.toLocaleDateString(LOCALE, { month: 'short' });
  const withYear = (d: Date) =>
    d.toLocaleDateString(LOCALE, { month: 'short', year: 'numeric' });

  if (start.getFullYear() !== end.getFullYear()) {
    return `${withYear(start)} – ${withYear(end)}`;
  }
  if (start.getMonth() === end.getMonth()) return month(start);

  return `${month(start)} – ${month(end)}`;
}

/**
 * One day, as "12 Mar" — the line under a note.
 *
 * Composed rather than left to `toLocaleDateString`, which would order the two
 * halves by region: the pinned locale settles the language and says nothing
 * about whether the day or the month comes first. A note card wants the day
 * first, because within a screen of them the month is the part that repeats.
 *
 * No year. A note is read against the others on the same screen, and every one
 * that needs a year is far enough down the page to be obviously old.
 */
export function formatDay(ms: number): string {
  const d = new Date(ms);
  return `${d.getDate()} ${d.toLocaleDateString(LOCALE, { month: 'short' })}`;
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
