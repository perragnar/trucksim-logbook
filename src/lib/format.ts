/**
 * European-standard date formatting in the viewer's local time.
 *   formatDateTime → "2026-06-12 (20:22:00)"
 *   formatDate     → "2026-06-12"
 *
 * Accepts unix ms, a Date, or a WoT date string ("June 12, 2026 at 7:50 PM").
 * Returns `fallback` (default "—") when the value is missing/unparseable.
 */

const pad = (n: number) => String(n).padStart(2, '0');

/** Normalise WoT's date wordings into something `new Date()` can parse:
 *   "June 12, 2026 at 7:50 PM"   (job Completed/Taken)
 *   "19th of May, 2026 09:31"    (achievement "Achieved on") */
function normalize(s: string): string {
	return s
		.replace(/\s+at\s+/i, ' ')
		.replace(/(\d{1,2})(st|nd|rd|th)\b/gi, '$1')
		.replace(/\bof\b/gi, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

function toDate(value: number | string | Date | null | undefined): Date | null {
	if (value == null || value === '') return null;
	const d = value instanceof Date ? value : new Date(typeof value === 'string' ? normalize(value) : value);
	return Number.isNaN(d.getTime()) ? null : d;
}

const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hms = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

export function formatDateTime(
	value: number | string | Date | null | undefined,
	fallback = '—'
): string {
	const d = toDate(value);
	return d ? `${ymd(d)} (${hms(d)})` : fallback;
}

export function formatDate(
	value: number | string | Date | null | undefined,
	fallback = '—'
): string {
	const d = toDate(value);
	return d ? ymd(d) : fallback;
}
