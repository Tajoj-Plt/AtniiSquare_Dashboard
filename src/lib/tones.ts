/**
 * The colour system layered on top of the black-and-white base.
 *
 * Cards themselves stay monochrome — white on light, near-black on dark. Colour appears
 * only on what sits *inside* a card: icon chips, type and status pills, chart series, and
 * the sidebar's active marker.
 *
 * Black stays the platform's main colour — every solid button, the logo and the sidebar
 * ground are ink. Colour is used *categorically*: each area of the product and each content
 * type owns a hue, so a reader learns "amber means learning, rose means trust & safety"
 * and can find a screen by its colour before reading the label.
 *
 * Class strings are written out in full rather than composed at runtime because Tailwind
 * only emits the classes it can see in the source — a template literal like
 * `bg-${tone}-500/10` would compile to nothing.
 */
export type Tone =
  | 'ink' | 'blue' | 'violet' | 'amber' | 'rose' | 'teal' | 'emerald' | 'indigo' | 'orange' | 'sky';

interface ToneClasses {
  /** Soft tinted surface with matching text — icon chips, badges, tags. */
  chip: string;
  /** Solid fill with contrasting text — emphasis only, used sparingly. */
  solid: string;
  /** Small status dot / bullet. */
  dot: string;
  /** Active navigation row. */
  active: string;
  /** Border tint for selected cards. */
  ring: string;
  /** Hex-ish HSL for charts and inline styles. */
  css: string;
}

export const TONES: Record<Tone, ToneClasses> = {
  ink: {
    chip: 'bg-foreground/10 text-foreground',
    solid: 'bg-primary text-primary-foreground',
    dot: 'bg-foreground',
    active: 'bg-foreground/10 text-foreground',
    ring: 'border-foreground/25',
    css: 'hsl(222 24% 11%)',
  },
  blue: {
    chip: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    solid: 'bg-blue-600 text-white',
    dot: 'bg-blue-500',
    active: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    ring: 'border-blue-500/40',
    css: 'hsl(217 91% 55%)',
  },
  violet: {
    chip: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
    solid: 'bg-violet-600 text-white',
    dot: 'bg-violet-500',
    active: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
    ring: 'border-violet-500/40',
    css: 'hsl(258 78% 62%)',
  },
  amber: {
    chip: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
    solid: 'bg-amber-500 text-amber-950',
    dot: 'bg-amber-500',
    active: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
    ring: 'border-amber-500/40',
    css: 'hsl(38 92% 50%)',
  },
  rose: {
    chip: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
    solid: 'bg-rose-600 text-white',
    dot: 'bg-rose-500',
    active: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
    ring: 'border-rose-500/40',
    css: 'hsl(347 77% 58%)',
  },
  teal: {
    chip: 'bg-teal-500/10 text-teal-700 dark:text-teal-300',
    solid: 'bg-teal-600 text-white',
    dot: 'bg-teal-500',
    active: 'bg-teal-500/10 text-teal-700 dark:text-teal-300',
    ring: 'border-teal-500/40',
    css: 'hsl(174 72% 40%)',
  },
  emerald: {
    chip: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    solid: 'bg-emerald-600 text-white',
    dot: 'bg-emerald-500',
    active: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    ring: 'border-emerald-500/40',
    css: 'hsl(160 70% 40%)',
  },
  indigo: {
    chip: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
    solid: 'bg-indigo-600 text-white',
    dot: 'bg-indigo-500',
    active: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
    ring: 'border-indigo-500/40',
    css: 'hsl(243 75% 62%)',
  },
  orange: {
    chip: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
    solid: 'bg-orange-600 text-white',
    dot: 'bg-orange-500',
    active: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
    ring: 'border-orange-500/40',
    css: 'hsl(25 95% 53%)',
  },
  sky: {
    chip: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
    solid: 'bg-sky-600 text-white',
    dot: 'bg-sky-500',
    active: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
    ring: 'border-sky-500/40',
    css: 'hsl(199 89% 48%)',
  },
};

export const tone = (name: Tone | undefined, part: keyof ToneClasses) =>
  TONES[name ?? 'blue'][part];

/** Each library type carries its own hue, in the dashboard and on the public page alike. */
export const CONTENT_TONES: Record<string, Tone> = {
  book: 'amber',
  article: 'blue',
  research: 'violet',
  scientific_paper: 'teal',
  translated_paper: 'rose',
  graduation_project: 'orange',
  video: 'indigo',
  audio: 'emerald',
};

/** Rotation used where items have no intrinsic meaning, e.g. landing-page cards. */
export const TONE_CYCLE: Tone[] = ['blue', 'violet', 'amber', 'teal', 'rose', 'indigo', 'emerald', 'orange'];
export const cycleTone = (i: number): Tone => TONE_CYCLE[i % TONE_CYCLE.length];
