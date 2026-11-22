import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Locale-aware number formatting; Arabic uses Latin digits for scanability in tables. */
export function formatNumber(value: number | string | null | undefined, locale = 'en') {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-SD-u-nu-latn' : 'en-US').format(n);
}

export function formatBytes(bytes: number | string | null | undefined) {
  const n = Number(bytes ?? 0);
  if (!n) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), units.length - 1);
  return `${(n / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function formatDate(value: string | null | undefined, locale = 'en', withTime = false) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SD-u-nu-latn-ca-gregory' : 'en-GB', {
    year: 'numeric', month: 'short', day: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(d);
}

/** "3 days ago" / "منذ ٣ أيام" without pulling in a date library. */
export function formatRelative(value: string | null | undefined, locale = 'en') {
  if (!value) return '—';
  const diff = Date.now() - new Date(value).getTime();
  const rtf = new Intl.RelativeTimeFormat(locale === 'ar' ? 'ar' : 'en', { numeric: 'auto' });
  const table: [Intl.RelativeTimeFormatUnit, number][] = [
    ['second', 1000], ['minute', 60_000], ['hour', 3_600_000],
    ['day', 86_400_000], ['week', 604_800_000], ['month', 2_592_000_000], ['year', 31_536_000_000],
  ];
  let chosen: [Intl.RelativeTimeFormatUnit, number] = table[0];
  for (const entry of table) if (Math.abs(diff) >= entry[1]) chosen = entry;
  return rtf.format(-Math.round(diff / chosen[1]), chosen[0]);
}

/**
 * `YYYY-MM-DD` in the viewer's own timezone.
 *
 * `toISOString().slice(0, 10)` is the obvious thing to reach for and is wrong for this:
 * it converts to UTC first, so anywhere east of Greenwich the early hours of a day report
 * as the previous date. Used to build report ranges, where that silently drops today.
 */
export function toLocalDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function initials(name?: string | null) {
  if (!name) return '؟';
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('');
}

/** Debounce for search inputs. */
export function debounce<T extends (...args: any[]) => void>(fn: T, ms = 300) {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

export const CONTENT_TYPES = [
  'book', 'article', 'research', 'scientific_paper', 'translated_paper', 'graduation_project',
  'video', 'audio',
] as const;

/** Content types whose file is played rather than read. */
export const TIME_BASED_TYPES = ['video', 'audio'] as const;

/**
 * The sidebar links to plural slugs (/content/books) while the API filters on singular
 * content types (book). Without this map the per-type pages quietly list everything.
 */
const TYPE_SLUGS: Record<string, string> = {
  books: 'book',
  articles: 'article',
  research: 'research',
  scientific_papers: 'scientific_paper',
  translated_papers: 'translated_paper',
  graduation_projects: 'graduation_project',
  videos: 'video',
  audios: 'audio',
};

/** The content type a /content/:type route pins, accepting the singular form too. */
export function contentTypeFromSlug(slug?: string) {
  if (!slug) return undefined;
  if ((CONTENT_TYPES as readonly string[]).includes(slug)) return slug;
  return TYPE_SLUGS[slug];
}
export type ContentType = (typeof CONTENT_TYPES)[number];

export const CONTENT_STATUSES = ['draft', 'pending_review', 'published', 'rejected', 'archived'] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

/**
 * Seconds as h:mm:ss (or m:ss under an hour) — always LTR, like every other duration.
 * Accepts a string too: Postgres hands back `numeric` columns as text.
 */
export function formatDuration(seconds: number | string | null | undefined) {
  const value = Number(seconds);
  if (!Number.isFinite(value) || value <= 0) return '';
  const s = Math.round(value);
  const parts = [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60];
  return (parts[0] ? parts : parts.slice(1))
    .map((n, i) => (i === 0 ? String(n) : String(n).padStart(2, '0')))
    .join(':');
}
