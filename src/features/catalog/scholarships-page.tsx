import { useTranslation } from 'react-i18next';
import { Award } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/overlays';
import { CrudPage } from '@/features/taxonomy/crud-page';
import { CrudFormPage, type CrudConfig } from '@/features/taxonomy/crud-form';
import { countryFlag, countryName } from '@/lib/countries';

const DEGREES = ['bachelor', 'master', 'phd', 'postdoc', 'diploma', 'training'] as const;
const FUNDING = ['full', 'partial', 'tuition', 'stipend', 'travel'] as const;
const CURRENCIES = ['USD', 'EUR', 'GBP', 'SDG', 'SAR', 'AED', 'EGP'] as const;

/**
 * The study fields a CV is read into, and so the only values a listing can be matched on.
 *
 * This is the API's `StudyField` union (`cv-signals.ts`) verbatim. The matcher scores a
 * listing with `study_fields && <the fields read off the CV>`, so a field typed as prose
 * would intersect nothing — the vocabulary has to be the same on both sides or the match
 * silently returns everyone.
 */
const STUDY_FIELDS = [
  'computer_science', 'engineering', 'medicine', 'public_health', 'business',
  'economics', 'agriculture', 'education', 'law', 'environment', 'social_sciences',
] as const;

/** The API's `TeachingLanguage` union — what a scholarship teaches in, ISO 639-1. */
const TEACHING_LANGUAGES = ['en', 'ar', 'fr', 'de', 'tr', 'zh', 'ja', 'ko', 'hu', 'ms'] as const;

/**
 * Funding opportunities.
 *
 * The fields are the questions an applicant asks in order: what is it and who runs it,
 * where it is, what level and field it is for, what it actually pays and covers, who may
 * apply, and by when. Coverage is four switches rather than a benefits paragraph, and the
 * accepted nationalities are ISO countries rather than prose: both are things an applicant
 * filters by, and a report can only count what is stored as a fact.
 */

/** The shared description of this resource: used by the list and by the form. */
function useScholarshipConfig(): CrudConfig {
  const { t } = useTranslation();
  const options = (values: readonly string[], prefix: string) =>
    values.map((v) => ({ value: v, label: t(`${prefix}.${v}`) }));

  return {
    queryKey: 'scholarships',
    path: '/scholarships',
    route: '/content/scholarships',
    title: t('learn.scholarshipsTitle'),
    subtitle: t('scholarships.subtitle'),
    tone: 'emerald',
    icon: Award,
    writePermission: 'scholarship.manage',
    createLabel: t('scholarships.newListing'),
    fields: [
        /* --- what it is ------------------------------------------------ */
        { name: 'title', label: t('scholarships.name'), required: true, colSpan: 2, group: t('scholarships.groups.about'),
          placeholder: t('scholarships.titlePlaceholder') },
        { name: 'title_en', label: t('scholarships.nameEn'), colSpan: 2, dir: 'ltr' },
        { name: 'description', label: t('scholarships.description'), type: 'textarea' },
        { name: 'provider', label: t('learn.provider'), required: true, hint: t('scholarships.providerHint') },

        /* --- where ------------------------------------------------------ */
        { name: 'country', label: t('learn.country'), type: 'country', group: t('scholarships.groups.where') },
        { name: 'city', label: t('scholarships.city') },
        { name: 'host_institution', label: t('scholarships.university'), colSpan: 2 },

        /* --- what it is for -------------------------------------------- */
        { name: 'degree_level', label: t('scholarships.level'), type: 'select', required: true,
          options: options(DEGREES, 'scholarships.levels'), group: t('scholarships.groups.study') },
        { name: 'study_field', label: t('scholarships.field'), hint: t('scholarships.fieldHint') },
        // The two lists the CV matcher actually reads. Leaving either empty means "open to
        // everyone" — which is what every listing meant before they could be set at all.
        { name: 'study_fields', label: t('scholarships.studyFields'), type: 'multiselect',
          options: options(STUDY_FIELDS, 'scholarships.studyFieldValues'),
          hint: t('scholarships.studyFieldsHint') },
        { name: 'teaching_languages', label: t('scholarships.teachingLanguages'), type: 'multiselect',
          options: TEACHING_LANGUAGES.map((v) => ({ value: v, label: t(`languages.${v}`) })),
          hint: t('scholarships.teachingLanguagesHint') },

        /* --- what it pays and covers ----------------------------------- */
        { name: 'funding_type', label: t('scholarships.fundingType'), type: 'select',
          options: options(FUNDING, 'scholarships.funding'), group: t('scholarships.groups.funding') },
        { name: 'amount', label: t('scholarships.amount'), type: 'number', hint: t('scholarships.amountHint') },
        { name: 'currency', label: t('scholarships.currency'), type: 'select',
          options: CURRENCIES.map((c) => ({ value: c, label: c })) },
        { name: 'monthly_stipend', label: t('scholarships.monthlyStipend'), type: 'number', hint: t('scholarships.stipendHint') },
        { name: 'covers_tuition', label: t('scholarships.covers.tuition'), type: 'switch' },
        { name: 'covers_housing', label: t('scholarships.covers.housing'), type: 'switch' },
        { name: 'covers_insurance', label: t('scholarships.covers.insurance'), type: 'switch' },
        { name: 'covers_flight', label: t('scholarships.covers.flight'), type: 'switch' },

        /* --- who may apply --------------------------------------------- */
        { name: 'nationalities', label: t('scholarships.nationalities'), type: 'countries',
          group: t('scholarships.groups.eligibility'), placeholder: t('scholarships.allNationalities') },
        { name: 'min_gpa', label: t('scholarships.minGpa'), type: 'number', hint: t('scholarships.minGpaHint') },
        { name: 'max_age', label: t('scholarships.maxAge'), type: 'number' },
        { name: 'language_requirement', label: t('scholarships.languageRequirement'), placeholder: 'IELTS 6.5' },
        { name: 'required_documents', label: t('scholarships.requiredDocuments'), type: 'textarea',
          hint: t('scholarships.requiredDocumentsHint') },
        { name: 'interest_ids', label: t('library.fields.interests'), type: 'interests', colSpan: 2,
          hint: t('scholarships.interestsHint') },

        /* --- how and by when ------------------------------------------- */
        { name: 'opens_at', label: t('scholarships.opensAt'), type: 'date', group: t('scholarships.groups.applying') },
        { name: 'deadline', label: t('learn.deadline'), type: 'date', required: true },
        { name: 'external_url', label: t('scholarships.applyUrl'), type: 'url', required: true, colSpan: 2 },
        { name: 'official_url', label: t('scholarships.officialUrl'), type: 'url', colSpan: 2 },
        { name: 'status', label: t('scholarships.status'), type: 'select',
          options: ['draft', 'published', 'archived'].map((v) => ({ value: v, label: t(`library.status.${v}`, { defaultValue: v }) })) },
      ],
  };
}

export function ScholarshipsPage() {
  const config = useScholarshipConfig();
  const { t, i18n } = useTranslation();
  // Countries come from the listings themselves — a fixed world list would be mostly noise.
  const { data: stats } = useQuery({
    queryKey: ['scholarships', 'countries'],
    queryFn: () => api.get('/scholarships/stats'),
    staleTime: 5 * 60_000,
  });
  const countries: string[] = (stats?.breakdown?.country ?? [])
    .map((r: any) => r.key)
    .filter((k: string) => k && k !== 'unknown');

  return (
    <CrudPage
      {...config}
      path="/scholarships"
      subtitle={t('scholarships.subtitle')}
      icon={Award}
      defaultSort="deadline"
      createLabel={t('scholarships.newListing')}
      columns={[
        {
          key: 'title', header: t('common.title'), sortable: true,
          cell: (r: any) => (
            <div className="min-w-0">
              <p className="line-clamp-1 font-medium">{r.title}</p>
              <p className="text-xs text-muted-foreground">
                {[r.provider, r.host_institution].filter(Boolean).join(' · ') || '—'}
              </p>
            </div>
          ),
        },
        {
          key: 'degree_level', header: t('scholarships.level'), hideBelow: 'md',
          cell: (r: any) => (
            <div className="flex flex-wrap gap-1">
              {r.degree_level ? <Badge variant="secondary">{t(`scholarships.levels.${r.degree_level}`)}</Badge> : null}
              {r.funding_type ? <Badge variant="muted">{t(`scholarships.funding.${r.funding_type}`)}</Badge> : null}
            </div>
          ),
        },
        { key: 'country', header: t('learn.country'), hideBelow: 'lg',
          // Stored as an ISO code; named in the reader's language.
          cell: (r: any) => (r.country ? `${countryFlag(r.country)} ${countryName(r.country, i18n.language)}` : '—') },
        {
          key: 'deadline', header: t('learn.deadline'), sortable: true, className: 'numeric',
          cell: (r: any) => {
            if (!r.deadline) return '—';
            const days = r.days_left;
            return (
              <span className={r.expired ? 'text-danger' : undefined}>
                {formatDate(r.deadline, i18n.language)}
                {/* A date alone makes the reader do the arithmetic; the countdown is the
                    part that decides whether they act today. */}
                {r.expired
                  ? ` · ${t('learn.expired')}`
                  : typeof days === 'number' ? ` · ${t('scholarships.daysLeft', { count: days })}` : ''}
              </span>
            );
          },
        },
        {
          key: 'amount', header: t('scholarships.amount'), hideBelow: 'xl', className: 'numeric',
          cell: (r: any) => (r.amount ? `${Number(r.amount).toLocaleString()} ${r.currency ?? ''}`.trim() : '—'),
        },
      ]}
      insights={{
        cards: [
          { key: 'total', label: t('insights.cards.total') },
          { key: 'open_now', label: t('scholarships.openNow'), tone: 'success' },
          { key: 'closing_30d', label: t('scholarships.closing30'), tone: 'warning' },
          { key: 'expired', label: t('learn.expired'), tone: 'danger' },
          { key: 'fully_funded', label: t('scholarships.funding.full'), tone: 'teal' },
        ],
        cuts: [
          { key: 'degree_level', label: t('scholarships.level'), labelFor: (k) => t(`scholarships.levels.${k}`, { defaultValue: k }) },
          { key: 'funding_type', label: t('scholarships.fundingType'), labelFor: (k) => t(`scholarships.funding.${k}`, { defaultValue: k }) },
          { key: 'country', label: t('learn.country'),
            labelFor: (k) => (k === 'unknown' ? '—' : `${countryFlag(k)} ${countryName(k, i18n.language)}`) },
        ],
      }}
      filters={(list) => (
        <>
          <Select value={list.state.filter.degree_level ?? 'all'} onValueChange={(v) => list.setFilter('degree_level', v)}>
            <SelectTrigger className="w-[11rem]"><SelectValue placeholder={t('scholarships.level')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('common.all')}</SelectItem>
              {DEGREES.map((d) => <SelectItem key={d} value={d}>{t(`scholarships.levels.${d}`)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={list.state.filter.funding_type ?? 'all'} onValueChange={(v) => list.setFilter('funding_type', v)}>
            <SelectTrigger className="w-[11rem]"><SelectValue placeholder={t('scholarships.fundingType')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('common.all')}</SelectItem>
              {FUNDING.map((f) => <SelectItem key={f} value={f}>{t(`scholarships.funding.${f}`)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={list.state.filter.country ?? 'all'} onValueChange={(v) => list.setFilter('country', v)}>
            <SelectTrigger className="w-[11rem]"><SelectValue placeholder={t('learn.country')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('learn.country')}</SelectItem>
              {countries.map((c) => <SelectItem key={c} value={c}>{countryFlag(c)} {countryName(c, i18n.language)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={list.state.filter.status ?? 'all'} onValueChange={(v) => list.setFilter('status', v)}>
            <SelectTrigger className="w-[9.5rem]"><SelectValue placeholder={t('common.status')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('common.status')}</SelectItem>
              {['draft', 'published', 'archived'].map((st) => (
                <SelectItem key={st} value={st}>{t(`library.status.${st}`, { defaultValue: st })}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {Object.keys(list.state.filter).length ? (
            <Button variant="ghost" size="sm" onClick={list.reset}>{t('actions.reset')}</Button>
          ) : null}
        </>
      )}
    />
  );
}

/** Create and edit, on their own route. */
export function ScholarshipFormPage() {
  return <CrudFormPage config={useScholarshipConfig()} />;
}
