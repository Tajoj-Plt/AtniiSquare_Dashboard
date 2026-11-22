import * as React from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  BookOpen, GraduationCap, RefreshCw, Smartphone, Users,
} from 'lucide-react';
import { api } from '@/lib/api';
import { formatNumber } from '@/lib/utils';
import { countryName } from '@/lib/countries';
import { PageHeader, Panel, StatCard, EmptyState } from '@/components/data/page-parts';
import { CategoryBarChart, DonutChart, RankedList, TrendChart } from '@/components/data/charts';
import { Funnel, RankTable, SegmentBar } from '@/components/data/report-charts';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/primitives';
import {
  ReportControls, resolveRange, type FilterSpec, type ReportQuery,
} from '@/features/reports/report-controls';
import { CsvButton, SectionTabs } from '@/features/app-control/app-control-parts';

const SECTIONS = ['engagement', 'content', 'learning', 'audience'] as const;
type Section = (typeof SECTIONS)[number];

const SECTION_META: Record<Section, { icon: typeof Users; tone: 'sky' | 'blue' | 'amber' | 'violet' }> = {
  engagement: { icon: Smartphone, tone: 'sky' },
  content: { icon: BookOpen, tone: 'blue' },
  learning: { icon: GraduationCap, tone: 'amber' },
  audience: { icon: Users, tone: 'violet' },
};

/** Segment values the API accepts, mirrored here so a control can never offer an invalid one. */
const CLASS_OPTIONS = ['blue_star', 'silver', 'gold'];
const ACTIVITY_OPTIONS = ['active_7d', 'active_30d', 'dormant_30d', 'dormant_90d', 'never'];
const AGE_BANDS = ['under_18', '18_24', '25_34', '35_44', '45_54', '55_64', '65_plus'];
const SEGMENT_COUNTRIES = ['SD', 'EG', 'SA', 'AE', 'QA', 'GB', 'US'];

/**
 * Behaviour and statistics for the mobile app.
 *
 * Four reports behind one control strip, each a single request that returns a whole screen
 * of small result sets. The strip is the same component the platform reports use, minus the
 * split and chart-form controls those need and these do not — the shapes here are fixed,
 * and what varies is the window and the segment.
 *
 * Panels whose source is an event the app reports show an empty state rather than a
 * substitute number when nothing has been recorded yet, and say where the data would come
 * from. A report that invents a plausible figure is worse than one that admits a gap.
 */
export function AppReportsPage() {
  const { t, i18n } = useTranslation();
  const { section } = useParams<{ section?: string }>();
  const active: Section = SECTIONS.includes(section as Section) ? (section as Section) : 'engagement';
  const lang = i18n.language;

  const [query, setQuery] = React.useState<ReportQuery>({
    preset: '30d', groupBy: 'none', chart: 'area', filters: {},
  });

  const params = React.useMemo(() => {
    const range = resolveRange(query);
    const filters = Object.fromEntries(
      Object.entries(query.filters).filter(([, value]) => value && value !== 'all'),
    );
    return { ...range, ...filters };
  }, [query]);

  const { data, isLoading, isFetching, refetch } = useQuery<any>({
    queryKey: ['app-reports', active, params],
    queryFn: () => api.get(`/app-control/reports/${active}`, params),
    // Hold the previous payload only while the *same* report refetches: across a tab change
    // the shapes differ, and handing the new component the old object would crash it.
    placeholderData: (prev: any, prevQuery: any) =>
      (prevQuery?.queryKey as unknown[])?.[1] === active ? prev : undefined,
  });

  /** One filter set for every report, because a segment must not change meaning per tab. */
  const filterSpecs: FilterSpec[] = React.useMemo(() => [
    {
      name: 'platform', label: t('appControl.segments.platform'), options: [
        { value: 'ios', label: t('appControl.platform.ios') },
        { value: 'android', label: t('appControl.platform.android') },
      ],
    },
    {
      name: 'country', label: t('appControl.segments.country'),
      options: SEGMENT_COUNTRIES.map((code) => ({ value: code, label: countryName(code, lang) })),
    },
    {
      name: 'sex', label: t('appReports.sex'), options: [
        { value: 'male', label: t('appReports.male') },
        { value: 'female', label: t('appReports.female') },
      ],
    },
    {
      name: 'age_band', label: t('appReports.ageBand'),
      options: AGE_BANDS.map((band) => ({ value: band, label: t(`appReports.bands.${band}`) })),
    },
    {
      name: 'user_class', label: t('appControl.segments.userClass'),
      options: CLASS_OPTIONS.map((c) => ({ value: c, label: t(`appControl.userClass.${c}`) })),
    },
    {
      name: 'activity', label: t('appControl.segments.activity'),
      options: ACTIVITY_OPTIONS.map((a) => ({ value: a, label: t(`appControl.activity.${a}`) })),
    },
  ], [t, lang]);

  const meta = SECTION_META[active];

  return (
    <>
      <PageHeader
        icon={meta.icon}
        tone={meta.tone}
        title={t('appReports.title')}
        subtitle={t('appReports.subtitle')}
        actions={
          <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>
            <RefreshCw className={isFetching ? 'animate-spin' : undefined} /> {t('actions.refresh')}
          </Button>
        }
      />

      <SectionTabs
        base="/app-reports"
        active={active}
        tabs={SECTIONS.map((key) => ({ key, label: t(`appReports.tabs.${key}`) }))}
      />

      <ReportControls
        query={query}
        onChange={(next) => setQuery((q) => ({ ...q, ...next }))}
        dimensions={[]}
        filters={filterSpecs}
        showDimension={false}
        showChart={false}
      />

      {isLoading || !data ? (
        <ReportSkeleton />
      ) : active === 'engagement' ? (
        <EngagementSection d={data} lang={lang} />
      ) : active === 'content' ? (
        <ContentSection d={data} lang={lang} />
      ) : active === 'learning' ? (
        <LearningSection d={data} lang={lang} />
      ) : (
        <AudienceSection d={data} lang={lang} />
      )}
    </>
  );
}

function ReportSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
      </div>
      <Skeleton className="h-72 rounded-lg" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    </div>
  );
}

/**
 * The panel used wherever the numbers depend on an event the app has to report.
 *
 * It names the endpoint the data would arrive on, so an empty chart reads as "nothing has
 * been sent yet" rather than "nothing happened" — two very different findings.
 */
function AwaitingEvents({ source }: { source: string }) {
  const { t } = useTranslation();
  return (
    <EmptyState
      icon={Smartphone}
      title={t('appReports.noEvents')}
      hint={t('appReports.noEventsHint', { source })}
    />
  );
}

/* ============================================================ engagement */

function EngagementSection({ d, lang }: { d: any; lang: string }) {
  const { t } = useTranslation();
  const n = (v: any) => formatNumber(v, lang);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t('appReports.activeMembers')} value={n(d.totals.active_members)} delta={d.totals.delta.activeMembers} icon={Users} tone="sky" />
        <StatCard label={t('appReports.sessions')} value={n(d.totals.sessions)} delta={d.totals.delta.sessions} icon={Smartphone} tone="blue" />
        <StatCard label={t('appReports.avgSession')} value={`${n(Math.round(d.totals.avg_session_seconds / 60))} ${t('appReports.minutes')}`} tone="teal" />
        <StatCard label={t('appReports.newMembers')} value={n(d.totals.new_members)} delta={d.totals.delta.newMembers} tone="emerald" />
      </div>

      <Panel
        title={t('appReports.engagementTimeline')}
        description={t('appReports.engagementTimelineHint')}
        actions={<CsvButton name="app-engagement-timeline" rows={d.timeline} />}
      >
        <TrendChart
          data={d.timeline}
          series={[
            { key: 'active_members', label: t('appReports.activeMembers') },
            { key: 'sessions', label: t('appReports.sessions') },
            { key: 'new_members', label: t('appReports.newMembers') },
          ]}
          height={280}
        />
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={t('appReports.funnel')} description={t('appReports.funnelHint')}>
          <Funnel stages={d.funnel.map((s: any) => ({ label: t(`appReports.stages.${s.stage}`), value: s.value }))} />
        </Panel>

        <Panel
          title={t('appReports.byProvider')}
          description={t('appReports.byProviderHint')}
          actions={<CsvButton name="registrations-by-provider" rows={d.registrationsByProvider} />}
        >
          {d.registrationsByProvider.length ? (
            <DonutChart
              data={d.registrationsByProvider.map((r: any) => ({
                name: t(`appReports.providers.${r.provider}`, { defaultValue: r.provider }),
                value: r.count,
              }))}
            />
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">{t('common.noResults')}</p>
          )}
        </Panel>
      </div>

      <Panel
        title={t('appReports.retention')}
        description={t('appReports.retentionHint')}
        actions={<CsvButton name="retention-cohorts" rows={d.retention} />}
      >
        <RankTable
          rows={d.retention}
          columns={[
            { key: 'cohort', header: t('appReports.cohort') },
            { key: 'size', header: t('appReports.cohortSize'), align: 'end' },
            {
              key: 'd1', header: t('appReports.day1'), align: 'end',
              render: (row) => rate(row.returned_d1, row.eligible_d1, lang),
            },
            {
              key: 'd7', header: t('appReports.day7'), align: 'end',
              render: (row) => rate(row.returned_d7, row.eligible_d7, lang),
            },
            {
              key: 'd30', header: t('appReports.day30'), align: 'end',
              render: (row) => rate(row.returned_d30, row.eligible_d30, lang),
            },
          ]}
        />
      </Panel>

      <Panel
        title={t('appReports.platforms')}
        description={t('appReports.platformsHint')}
        actions={<CsvButton name="sessions-by-platform" rows={d.platforms} />}
      >
        {d.platforms.length ? (
          <RankedList items={d.platforms.map((p: any) => ({
            label: t(`appControl.platform.${p.platform}`, { defaultValue: p.platform }),
            value: p.sessions,
          }))} />
        ) : (
          <AwaitingEvents source="POST /mobile/telemetry/sessions" />
        )}
      </Panel>
    </div>
  );
}

/**
 * A retention cell.
 *
 * A cohort too young for the horizon has no rate at all, and printing 0% for it would read
 * as total churn rather than "we cannot know yet" — so it shows a dash instead.
 */
function rate(returned: number, eligible: number, lang: string) {
  if (!eligible) return <span className="text-muted-foreground">—</span>;
  return (
    <span>
      {((returned / eligible) * 100).toFixed(0)}%
      <span className="ms-1 text-xs text-muted-foreground">({formatNumber(returned, lang)})</span>
    </span>
  );
}

/* =============================================================== content */

function ContentSection({ d, lang }: { d: any; lang: string }) {
  const { t } = useTranslation();
  const n = (v: any) => formatNumber(v, lang);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t('appReports.reads')} value={n(d.totals.reads)} delta={d.totals.delta.reads} icon={BookOpen} tone="blue" />
        <StatCard label={t('appReports.downloads')} value={n(d.totals.downloads)} delta={d.totals.delta.downloads} tone="teal" />
        <StatCard label={t('appReports.saves')} value={n(d.totals.saves)} delta={d.totals.delta.saves} tone="violet" />
        <StatCard
          label={t('appReports.emptySearches')} value={n(d.totals.empty_searches)}
          hint={t('appReports.ofSearches', { value: n(d.totals.searches) })}
          tone={d.totals.empty_searches > 0 ? 'warning' : 'emerald'}
        />
      </div>

      <Panel
        title={t('appReports.contentTimeline')}
        actions={<CsvButton name="content-behaviour-timeline" rows={d.timeline} />}
      >
        <TrendChart
          data={d.timeline}
          series={[
            { key: 'reads', label: t('appReports.reads') },
            { key: 'downloads', label: t('appReports.downloads') },
            { key: 'saves', label: t('appReports.saves') },
          ]}
          height={260}
        />
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={t('appReports.mostRead')} actions={<CsvButton name="most-read" rows={d.topRead} />}>
          {d.topRead.length ? (
            <RankTable
              rows={d.topRead}
              columns={[
                { key: 'title', header: t('common.title') },
                { key: 'reads', header: t('appReports.reads'), align: 'end' },
                { key: 'readers', header: t('appReports.readers'), align: 'end' },
              ]}
            />
          ) : (
            <AwaitingEvents source="POST /mobile/telemetry/content-events" />
          )}
        </Panel>

        <Panel title={t('appReports.mostDownloaded')} actions={<CsvButton name="most-downloaded" rows={d.topDownloaded} />}>
          <RankTable
            rows={d.topDownloaded}
            columns={[
              { key: 'title', header: t('common.title') },
              { key: 'downloads', header: t('appReports.downloads'), align: 'end' },
            ]}
          />
        </Panel>

        <Panel title={t('appReports.mostSaved')} actions={<CsvButton name="most-saved" rows={d.topSaved} />}>
          <RankTable
            rows={d.topSaved}
            columns={[
              { key: 'title', header: t('common.title') },
              { key: 'saves', header: t('appReports.saves'), align: 'end' },
            ]}
          />
        </Panel>

        <Panel
          title={t('appReports.reels')}
          description={t('appReports.reelsHint', {
            rate: d.reels.completion_rate, seconds: d.reels.avg_watch_seconds,
          })}
          actions={<CsvButton name="reel-watch-through" rows={d.topReels} />}
        >
          <RankTable
            rows={d.topReels}
            columns={[
              { key: 'title', header: t('common.title') },
              { key: 'views', header: t('appReports.views'), align: 'end' },
              { key: 'completion_rate', header: t('appReports.completion'), align: 'end', render: (row) => `${row.completion_rate}%` },
            ]}
          />
        </Panel>
      </div>

      <Panel
        title={t('appReports.postsByReach')}
        description={t('appReports.postsByReachHint')}
        actions={<CsvButton name="posts-by-reach" rows={d.topPosts} />}
      >
        <RankTable
          rows={d.topPosts}
          columns={[
            { key: 'excerpt', header: t('appReports.post') },
            { key: 'author', header: t('common.author') },
            { key: 'reach', header: t('appReports.reach'), align: 'end' },
            { key: 'reactions', header: t('appReports.reactions'), align: 'end' },
            { key: 'comments', header: t('appReports.comments'), align: 'end' },
            { key: 'shares', header: t('appReports.shares'), align: 'end' },
          ]}
        />
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title={t('appReports.zeroResults')}
          description={t('appReports.zeroResultsHint')}
          actions={<CsvButton name="zero-result-searches" rows={d.emptySearches} />}
        >
          {d.emptySearches.length ? (
            <RankTable
              rows={d.emptySearches}
              columns={[
                { key: 'term', header: t('appReports.term') },
                { key: 'searches', header: t('appReports.searches'), align: 'end' },
                { key: 'members', header: t('appReports.members'), align: 'end' },
              ]}
            />
          ) : (
            <AwaitingEvents source="POST /mobile/telemetry/searches" />
          )}
        </Panel>

        <Panel
          title={t('appReports.interestPopularity')}
          actions={<CsvButton name="interest-popularity" rows={d.interests} />}
        >
          <RankedList
            items={d.interests.slice(0, 10).map((i: any) => ({
              label: lang === 'ar' ? i.name : (i.name_en ?? i.name),
              value: i.members,
            }))}
          />
        </Panel>
      </div>
    </div>
  );
}

/* ============================================================== learning */

function LearningSection({ d, lang }: { d: any; lang: string }) {
  const { t } = useTranslation();
  const n = (v: any) => formatNumber(v, lang);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t('appReports.enrolments')} value={n(d.totals.enrolments)} delta={d.totals.delta.enrolments} icon={GraduationCap} tone="amber" />
        <StatCard label={t('appReports.completionRate')} value={`${d.totals.completion_rate}%`} hint={t('appReports.completions', { value: n(d.totals.completions) })} tone="emerald" />
        <StatCard label={t('appReports.attendance')} value={n(d.totals.event_attendance)} delta={d.totals.delta.eventAttendance} tone="rose" />
        <StatCard label={t('appReports.avgWatch')} value={`${n(d.totals.avg_watch_minutes)} ${t('appReports.minutes')}`} tone="violet" />
      </div>

      <Panel title={t('appReports.learningTimeline')} actions={<CsvButton name="learning-timeline" rows={d.timeline} />}>
        <TrendChart
          data={d.timeline}
          series={[
            { key: 'enrolments', label: t('appReports.enrolments') },
            { key: 'completions', label: t('appReports.completions_short') },
            { key: 'attendance', label: t('appReports.attendance') },
          ]}
          height={260}
        />
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={t('appReports.topCourses')} actions={<CsvButton name="top-courses" rows={d.topCourses} />}>
          <RankTable
            rows={d.topCourses}
            columns={[
              { key: 'title', header: t('common.title') },
              { key: 'enrolments', header: t('appReports.enrolments'), align: 'end' },
              { key: 'completion_rate', header: t('appReports.completion'), align: 'end', render: (row) => `${row.completion_rate}%` },
            ]}
          />
        </Panel>

        <Panel title={t('appReports.progress')} description={t('appReports.progressHint')}>
          {d.progress.length ? (
            <CategoryBarChart
              data={d.progress.map((p: any) => ({ band: t(`appReports.progressBands.${p.band}`), count: p.count }))}
              xKey="band"
              series={[{ key: 'count', label: t('common.count') }]}
              height={240}
            />
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">{t('common.noResults')}</p>
          )}
        </Panel>

        <Panel title={t('appReports.scholarshipViews')} actions={<CsvButton name="scholarship-views" rows={d.scholarships} />}>
          {d.scholarships.length ? (
            <RankTable
              rows={d.scholarships}
              columns={[
                { key: 'title', header: t('common.title') },
                { key: 'views', header: t('appReports.views'), align: 'end' },
              ]}
            />
          ) : (
            <AwaitingEvents source="POST /mobile/telemetry/content-events" />
          )}
        </Panel>

        <Panel title={t('appReports.examDownloads')} actions={<CsvButton name="exam-downloads" rows={d.exams} />}>
          {d.exams.length ? (
            <RankTable
              rows={d.exams}
              columns={[
                { key: 'title', header: t('common.title') },
                { key: 'downloads', header: t('appReports.downloads'), align: 'end' },
              ]}
            />
          ) : (
            <AwaitingEvents source="POST /mobile/telemetry/content-events" />
          )}
        </Panel>
      </div>

      <Panel
        title={t('appReports.events')}
        description={t('appReports.eventsHint')}
        actions={<CsvButton name="event-attendance" rows={d.events} />}
      >
        <RankTable
          rows={d.events}
          columns={[
            { key: 'title', header: t('common.title') },
            { key: 'attendance', header: t('appReports.attendance'), align: 'end' },
            { key: 'members', header: t('appReports.members'), align: 'end' },
            { key: 'avg_watch_minutes', header: t('appReports.avgWatch'), align: 'end' },
          ]}
        />
      </Panel>
    </div>
  );
}

/* ============================================================== audience */

function AudienceSection({ d, lang }: { d: any; lang: string }) {
  const { t } = useTranslation();
  const n = (v: any) => formatNumber(v, lang);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t('appReports.members')} value={n(d.totals.members)} icon={Users} tone="violet" />
        <StatCard label={t('appReports.newMembers')} value={n(d.totals.new_members)} delta={d.totals.delta.newMembers} tone="emerald" />
        <StatCard label={t('appReports.onboarded')} value={n(d.totals.onboarded)} hint={share(d.totals.onboarded, d.totals.members)} tone="sky" />
        <StatCard label={t('appReports.pushable')} value={n(d.totals.pushable)} hint={t('appReports.pushableHint')} tone="orange" />
      </div>

      <Panel
        title={t('appReports.growth')}
        description={t('appReports.growthHint')}
        actions={<CsvButton name="audience-growth" rows={d.growth} />}
      >
        <TrendChart
          data={d.growth}
          series={[
            { key: 'total_members', label: t('appReports.totalMembers') },
            { key: 'new_members', label: t('appReports.newMembers') },
          ]}
          height={280}
        />
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={t('appReports.byCountry')} actions={<CsvButton name="audience-country" rows={d.countries} />}>
          <RankedList
            items={d.countries.slice(0, 10).map((row: any) => ({
              label: row.key === 'unknown' ? t('common.unknown') : countryName(row.key, lang),
              value: row.count,
            }))}
          />
        </Panel>

        <Panel title={t('appReports.bySex')} actions={<CsvButton name="audience-sex" rows={d.sexes} />}>
          <SegmentBar
            total={d.totals.members}
            segments={d.sexes.map((row: any) => ({
              label: row.key === 'unknown' ? t('common.unknown') : t(`appReports.${row.key}`),
              value: row.count,
            }))}
          />
        </Panel>

        <Panel title={t('appReports.byAge')} actions={<CsvButton name="audience-age" rows={d.ages} />}>
          <CategoryBarChart
            data={d.ages.map((row: any) => ({
              band: row.key === 'unknown' ? t('common.unknown') : t(`appReports.bands.${row.key}`),
              count: row.count,
            }))}
            xKey="band"
            series={[{ key: 'count', label: t('appReports.members') }]}
            height={240}
          />
        </Panel>

        <Panel title={t('appReports.byClass')} actions={<CsvButton name="audience-class" rows={d.classes} />}>
          <SegmentBar
            total={d.totals.members}
            segments={d.classes.map((row: any) => ({
              label: t(`appControl.userClass.${row.key}`, { defaultValue: row.key }),
              value: row.count,
            }))}
          />
        </Panel>

        <Panel title={t('appReports.byTitle')} actions={<CsvButton name="audience-titles" rows={d.titles} />}>
          {d.titles.length ? (
            <RankedList items={d.titles.map((row: any) => ({
              label: t(`appReports.titles.${row.key}`, { defaultValue: row.key }), value: row.count,
            }))} />
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">{t('common.noResults')}</p>
          )}
        </Panel>

        <Panel title={t('appReports.byInterest')} actions={<CsvButton name="audience-interests" rows={d.interests} />}>
          {d.interests.length ? (
            <RankedList items={d.interests.slice(0, 10).map((row: any) => ({
              label: lang === 'ar' ? row.key : (row.key_en ?? row.key), value: row.count,
            }))} />
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">{t('common.noResults')}</p>
          )}
        </Panel>
      </div>
    </div>
  );
}

/** "62% of members" — the share a headline number represents, for the tile's hint line. */
function share(part: number, whole: number) {
  if (!whole) return undefined;
  return `${((part / whole) * 100).toFixed(0)}%`;
}
