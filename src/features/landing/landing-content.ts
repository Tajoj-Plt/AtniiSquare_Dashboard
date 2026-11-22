import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import * as React from 'react';
import { api } from '@/lib/api';

export interface LandingItem {
  icon?: string;
  value?: number;
  [lang: string]: any;
}

export interface LandingSection {
  key: string;
  text?: Record<string, Record<string, string>>;
  items?: LandingItem[];
  layout?: string;
}

export interface LandingDocument {
  sections: LandingSection[];
  settings: Record<string, any>;
}

/** The order the page falls back to when the API cannot be reached. */
const FALLBACK_ORDER = [
  'hero', 'problem', 'solution', 'video', 'types', 'how', 'mobile', 'audience', 'trust', 'faq', 'cta',
];

/**
 * Loads the landing document the dashboard publishes.
 *
 * The marketing page is the one screen an anonymous visitor sees, so it must never depend
 * on the API being up: if the request fails, the page renders from the bundled translation
 * bundle instead. That is also why every text lookup below falls through to i18n — a
 * section an operator has not customised has no stored copy, and should still read
 * correctly in both languages.
 */
export function useLandingContent() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === 'ar' ? 'ar' : 'en';

  const { data, isLoading } = useQuery<LandingDocument>({
    queryKey: ['landing', 'public'],
    queryFn: () => api.get('/landing'),
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const sections = React.useMemo<LandingSection[]>(
    () => data?.sections?.length ? data.sections : FALLBACK_ORDER.map((key) => ({ key })),
    [data],
  );

  const settings = data?.settings ?? {};

  /** Stored copy for a field, falling back to the shipped translation. */
  const text = React.useCallback(
    (section: LandingSection, field: string, i18nKey?: string) => {
      const stored = section.text?.[lang]?.[field];
      if (stored) return stored;
      const key = i18nKey ?? `landing.${section.key}.${field}`;
      const translated = t(key);
      return translated === key ? '' : translated;
    },
    [lang, t],
  );

  /** Stored copy for a repeatable entry, falling back to the shipped translation. */
  const itemText = React.useCallback(
    (item: LandingItem | undefined, field: string, i18nKey: string) => {
      const stored = item?.[lang]?.[field];
      if (stored) return stored;
      const translated = t(i18nKey);
      return translated === i18nKey ? '' : translated;
    },
    [lang, t],
  );

  /**
   * A stored URL (video, poster, screenshot).
   *
   * These are not really copy: an operator who uploads one film for both languages should
   * not have to paste it twice, so an empty field falls back to the other language rather
   * than to a translation key that will never exist.
   */
  const asset = React.useCallback(
    (section: LandingSection, field: string) =>
      String(section.text?.[lang]?.[field] || section.text?.[lang === 'ar' ? 'en' : 'ar']?.[field] || ''),
    [lang],
  );

  const setting = React.useCallback(
    (name: string, fallback?: any) => {
      const value = settings[name];
      if (value === undefined || value === null) return fallback;
      // Settings that carry per-language copy resolve like any other text.
      if (typeof value === 'object' && !Array.isArray(value) && (value.ar || value.en)) {
        return value[lang] ?? value.en ?? fallback;
      }
      return value;
    },
    [settings, lang],
  );

  return { sections, settings, text, itemText, asset, setting, isLoading, lang };
}
