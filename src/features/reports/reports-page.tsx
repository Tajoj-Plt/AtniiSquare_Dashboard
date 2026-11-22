import * as React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  Activity, BadgeCheck, BarChart3, BookOpen, Compass, Download, Flag, GitCompareArrows, GraduationCap,
  MessageSquare, Network, RefreshCw, SlidersHorizontal, Users, Waves,
} from 'lucide-react';
import { api } from '@/lib/api';
import { cn, CONTENT_TYPES, formatDate, formatNumber } from '@/lib/utils';
import { CONTENT_TONES, TONES } from '@/lib/tones';
import { countryName } from '@/lib/countries';
import { PageHeader, Panel, StatCard } from '@/components/data/page-parts';
import { CategoryBarChart, DonutChart, RankedList, TrendChart } from '@/components/data/charts';
import { ActivityHeatmap, Funnel, RankTable, SegmentBar } from '@/components/data/report-charts';
import { Button } from '@/components/ui/button';
import { Skeleton, Tabs, TabsList, TabsTrigger } from '@/components/ui/primitives';
import {
  ReportControls, pivotTimeline, resolveRange, type ChartKind, type FilterSpec, type ReportQuery,
} from './report-controls';
import {
  AcademicSection, BehaviourReport, ComparisonReport, DemographicsSection, DistributionReport,
  RelationshipsReport, ScholarshipExamSection,
} from './analysis-sections';
import { ExplorePanel } from './explore-panel';

const SECTIONS = [
  'users', 'content', 'engagement', 'moderation', 'learning', 'app-members', 'pages',
  'behaviour', 'distribution', 'relationships', 'comparison', 'explore',
] as const;
type SectionKey = (typeof SECTIONS)[number];

/** Sections whose whole point is a shape, not a split, offer no group-by or chart toggle. */
const NO_CONTROLS: SectionKey[] = ['behaviour', 'distribution', 'relationships', 'explore'];

/**
 * Which dimensions each report accepts, mirroring the server's allow-list.
 *
 * The effective group-by is *derived* from this rather than corrected by an effect after the
 * tab changes: an effect runs after render, so for one pass the section and the dimension
 * disagree and a request goes out that the API rightly rejects (users has no "type").
 */
const SECTION_DIMENSIONS: Record<SectionKey, string[]> = {
  users: ['none', 'role', 'status', 'locale', 'activity'],
  content: ['type', 'status', 'language', 'license', 'interest'],
  engagement: ['none'],
  moderation: ['none'],
  learning: ['none'],
  'app-members': ['none'],
  pages: ['none'],
  behaviour: ['none'],
  distribution: ['none'],
  relationships: ['none'],
  comparison: ['type', 'status', 'language', 'license', 'interest'],
  explore: ['none'],
};
const DEFAULT_GROUP: Record<SectionKey, string> = {
  users: 'none', content: 'type', engagement: 'none', moderation: 'none', learning: 'none',
  'app-members': 'none', pages: 'none',
  behaviour: 'none', distribution: 'none', relationships: 'none', comparison: 'type', explore: 'none',
};

const SECTION_META: Record<SectionKey, { icon: typeof Users; tone: keyof typeof TONES }> = {
  users: { icon: Users, tone: 'sky' },
  content: { icon: BookOpen, tone: 'blue' },
  engagement: { icon: MessageSquare, tone: 'violet' },
  moderation: { icon: Flag, tone: 'rose' },
  learning: { icon: GraduationCap, tone: 'amber' },
  'app-members': { icon: Users, tone: 'sky' },
  pages: { icon: BadgeCheck, tone: 'amber' },
  behaviour: { icon: Waves, tone: 'teal' },
  distribution: { icon: SlidersHorizontal, tone: 'orange' },
  relationships: { icon: Network, tone: 'indigo' },
  comparison: { icon: GitCompareArrows, tone: 'emerald' },
  explore: { icon: Compass, tone: 'violet' },
};

/**
 * The reporting surface: five reports behind one filter bar.
 *
 * Each report is a single request that returns a bundle of small result sets, so switching
 * tabs is one fetch rather than a dozen, and the period selector applies to whichever
 * report is open. The section lives in the URL so a particular view can be linked to.
 */
export function ReportsPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { section } = useParams<{ section?: string }>();
  const active: SectionKey = SECTIONS.includes(section as SectionKey) ? (section as SectionKey) : 'users';
  const lang = i18n.language;

  const [query, setQuery] = React.useState<ReportQuery>({
    preset: '90d', groupBy: 'none', chart: 'area', filters: {},
  });
  // Filters are cleared on a tab change because a user segment means nothing on the content
  // report; the dimension is derived below rather than reset here.
  React.useEffect(() => {
    setQuery((q) => ({ ...q, filters: {} }));
  }, [active]);

  const groupBy = SECTION_DIMENSIONS[active].includes(query.groupBy)
    ? query.groupBy
    : DEFAULT_GROUP[active];

  const { data: roles } = useQuery({
    queryKey: ['roles'], queryFn: () => api.get('/roles'), staleTime: 5 * 60_000,
  });

  const params = React.useMemo(() => {
    const range = resolveRange(query);
    const filters = Object.fromEntries(
      Object.entries(query.filters).filter(([, v]) => v && v !== 'all'),
    );
    return { ...range, groupBy, ...filters };
  }, [query, groupBy]);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['reports', active, params],
    queryFn: () => api.get(`/reports/${active}`, params),
    // Explore issues its own request from its own builder state; there is no
    // `/reports/explore` payload for this page to hold.
    enabled: active !== 'explore',
    // Keep the previous payload only while the *same* report is refetching — changing the
    // period or a filter should not blank the page. Across a tab change the shapes differ
    // (a moderation view has no byReason on a users payload), so holding the old data would
    // hand the new component the wrong object and crash the render.
    placeholderData: (prev, prevQuery) =>
      (prevQuery?.queryKey as unknown[])?.[1] === active ? prev : undefined,
  });

  const update = (next: Partial<ReportQuery>) => setQuery((q) => ({ ...q, ...next }));

  // Filter sets per report. Values match what the API accepts.
  const filterSpecs: FilterSpec[] = React.useMemo(() => {
    const roleOptions = (roles ?? []).map((r: any) => ({
      value: r.slug, label: lang === 'ar' ? r.name : (r.name_en ?? r.slug),
    }));
    if (active === 'users') {
      return [
        { name: 'role', label: t('users.roles'), options: roleOptions },
        { name: 'status', label: t('common.status'), options: [
          { value: 'active', label: t('users.status.active') },
          { value: 'suspended', label: t('users.status.suspended') },
        ] },
        { name: 'activity', label: t('reports.filters.activity'), options:
          ['active_7d', 'active_30d', 'dormant_30d', 'dormant_90d', 'never']
            .map((a) => ({ value: a, label: t(`reports.filters.${a}`) })) },
        { name: 'has_content', label: t('reports.filters.hasContent'), options: [
          { value: 'true', label: t('reports.filters.yes') },
          { value: 'false', label: t('reports.filters.no') },
        ] },
        { name: 'locale', label: t('common.language'), options: [
          { value: 'ar', label: 'العربية' }, { value: 'en', label: 'English' },
        ] },
        { name: 'sex', label: t('users.demographics.sex'), options: [
          { value: 'male', label: t('users.demographics.male') },
          { value: 'female', label: t('users.demographics.female') },
        ] },
        { name: 'age_band', label: t('users.demographics.ageBand'), options:
          ['under_18', '18_24', '25_34', '35_44', '45_54', '55_64', '65_plus', 'unknown']
            .map((b) => ({ value: b, label: t(`users.demographics.bands.${b}`) })) },
        // Only countries the directory actually holds — offering all 250 as a filter on a
        // report that covers a dozen would be a scrolling exercise with no payoff.
        { name: 'country', label: t('users.demographics.country'), options:
          (data?.demographics?.country ?? [])
            .filter((c: any) => c.key && c.key !== 'unknown')
            .map((c: any) => ({ value: c.key, label: countryName(c.key, lang) })) },
      ];
    }
    if (active === 'content') {
      return [
        { name: 'content_type', label: t('common.type'), options:
          [...CONTENT_TYPES]
            .map((k) => ({ value: k, label: t(`library.type.${k}`) })) },
        { name: 'status', label: t('common.status'), options:
          ['draft', 'pending_review', 'published', 'rejected', 'archived']
            .map((k) => ({ value: k, label: t(`library.status.${k}`) })) },
        { name: 'language', label: t('common.language'), options: [
          { value: 'ar', label: 'العربية' }, { value: 'en', label: 'English' },
        ] },
        { name: 'role', label: t('reports.byCreatorRole'), options: roleOptions },
        // Academic segments; the institutions and specializations offered are the ones the
        // library actually holds, not an empty directory.
        { name: 'institution', label: t('content.fields.institution'), options:
          (data?.academic?.byInstitution ?? []).map((r: any) => ({ value: r.key, label: r.key })) },
        { name: 'specialization', label: t('content.fields.specialization'), options:
          (data?.academic?.bySpecialization ?? []).map((r: any) => ({ value: r.key, label: r.key })) },
        { name: 'degree_level', label: t('content.fields.degree_level'), options:
          ['diploma', 'bachelor', 'higher_diploma', 'master', 'phd', 'postdoc', 'other']
            .map((v) => ({ value: v, label: t(`content.options.degree_level.${v}`) })) },
      ];
    }
    return [];
  }, [active, roles, lang, t, data]);

  return (
    <>
      <PageHeader
        icon={BarChart3}
        tone="indigo"
        title={t('reports.title')}
        subtitle={t('reports.subtitle')}
        actions={
          <Button variant="outline" onClick={() => void refetch()} loading={isFetching}>
            <RefreshCw /> {t('actions.refresh')}
          </Button>
        }
      />

      <Tabs value={active} onValueChange={(v) => navigate(`/reports/${v}`)}>
        <TabsList className="h-auto flex-wrap justify-start">
          {SECTIONS.map((s) => {
            const Icon = SECTION_META[s].icon;
            return (
              <TabsTrigger key={s} value={s} className="gap-1.5">
                <Icon className="h-4 w-4" />
                {t(`reports.tabs.${s}`)}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      {active !== 'explore' ? (
        <ReportControls
          query={{ ...query, groupBy }}
          onChange={update}
          // The server's list when it sends one, our mirror of it otherwise — so the
          // period selector is present on every report, including the ones that have no
          // dimension to offer and previously rendered no control bar at all.
          dimensions={data?.dimensions ?? SECTION_DIMENSIONS[active].filter((d) => d !== 'none')}
          allowNone={SECTION_DIMENSIONS[active].includes('none')}
          showDimension={SECTION_DIMENSIONS[active].some((d) => d !== 'none')}
          showChart={!NO_CONTROLS.includes(active)}
          filters={filterSpecs}
        />
      ) : null}

      {data?.range ? (
        <p className="numeric -mt-2 text-xs text-muted-foreground">
          {formatDate(data.range.from, i18n.language)} — {formatDate(data.range.to, i18n.language)}
          {' · '}{data.range.days} {i18n.language === 'ar' ? 'يوماً' : 'days'}
        </p>
      ) : null}

      {active === 'explore' ? (
        <ExplorePanel range={resolveRange(query)} />
      ) : isLoading ? (
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
          </div>
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      ) : !data ? null : active === 'users' ? (
        <UsersReport d={data} q={{ ...query, groupBy }} />
      ) : active === 'content' ? (
        <ContentReport d={data} q={{ ...query, groupBy }} />
      ) : active === 'engagement' ? (
        <EngagementReport d={data} />
      ) : active === 'moderation' ? (
        <ModerationReport d={data} />
      ) : active === 'app-members' ? (
        <AppMembersReport d={data} />
      ) : active === 'pages' ? (
        <PagesReport d={data} />
      ) : active === 'behaviour' ? (
        <BehaviourReport d={data} />
      ) : active === 'distribution' ? (
        <DistributionReport d={data} />
      ) : active === 'relationships' ? (
        <RelationshipsReport d={data} />
      ) : active === 'comparison' ? (
        <ComparisonReport d={data} groupBy={groupBy} />
      ) : (
        <LearningReport d={data} />
      )}
    </>
  );
}

/* --------------------------------------------------------------- helpers */

const useN = () => {
  const { i18n } = useTranslation();
  return (v: any) => formatNumber(v, i18n.language);
};

const useDayLabels = (rows: any[]) => {
  const { i18n } = useTranslation();
  return React.useMemo(
    () => rows.map((r) => ({ ...r, day: formatDate(r.day, i18n.language).replace(/\s\d{4}$/, '') })),
    [rows, i18n.language],
  );
};

/**
 * The main timeline, drawn in the selected form from the selected dimension.
 *
 * The API returns long rows ({day, key, count}); pivoting here means the series set is
 * whatever the data actually contained, so a dimension with three values draws three
 * series without the client needing to know them in advance.
 */
function GroupedTimeline({
  rows, chart, labelFor, height = 300,
}: {
  rows: { day: string; key: string; count: number }[];
  chart: ChartKind;
  labelFor?: (key: string) => string;
  height?: number;
}) {
  const { i18n } = useTranslation();
  const { data, series } = React.useMemo(() => pivotTimeline(rows ?? []), [rows]);
  const shaped = React.useMemo(
    () => data.map((row) => ({ ...row, day: formatDate(row.day, i18n.language).replace(/\s\d{4}$/, '') })),
    [data, i18n.language],
  );
  const spec = series.map((key) => ({ key, label: labelFor?.(key) ?? key }));

  if (!shaped.length) return null;
  if (chart === 'area') return <TrendChart data={shaped} series={spec} height={height} />;
  return <CategoryBarChart xKey="day" data={shaped} series={spec} height={height} stacked={chart === 'stacked'} />;
}

/* ----------------------------------------------------------- users report */

function UsersReport({ d, q }: { d: any; q: ReportQuery }) {
  const { t, i18n } = useTranslation();
  const n = useN();
  const cumulative = useDayLabels(d.cumulative ?? []);
  const lang = i18n.language;

  return (
    <>
      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label={t('users.stats.total')} value={n(d.totals.total)} icon={Users} tone="sky" />
        <StatCard label={t('users.stats.active')} value={n(d.totals.active)} tone="success" />
        <StatCard label={t('users.stats.suspended')} value={n(d.totals.suspended)} tone={d.totals.suspended ? 'danger' : 'ink'} />
        <StatCard label={t('reports.users.never')} value={n(d.totals.never_signed_in)} tone="amber" />
        <StatCard label={t('users.stats.active7d')} value={n(d.totals.active_7d)} tone="teal" />
        <StatCard label={t('users.stats.new30d')} value={n(d.totals.new_in_range)} tone="violet"
          delta={d.deltas?.new_in_range ?? undefined}
          hint={d.deltas?.new_in_range == null ? t('reports.vsPrevious') : undefined} />
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2" title={t('reports.users.growth')}
          description={q.groupBy !== 'none' ? t(`reports.dims.${q.groupBy}`, { defaultValue: q.groupBy }) : undefined}>
          <GroupedTimeline
            rows={d.timeline}
            chart={q.chart}
            labelFor={(k) => t(`reports.users.${k}`, {
              defaultValue: t(`users.status.${k}`, {
                defaultValue: k === 'ar' ? 'العربية' : k === 'en' ? 'English' : k,
              }),
            })}
          />
        </Panel>
        <Panel title={t('reports.cumulative')}>
          <TrendChart
            data={cumulative}
            series={[{ key: 'total', label: t('users.stats.total') }]}
            height={300}
          />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2" title={t('reports.users.byRole')}>
          <RankTable
            rows={d.byRole}
            columns={[
              { key: 'name', header: t('users.roles'), render: (r) => (lang === 'ar' ? r.name : (r.name_en ?? r.slug)) },
              { key: 'users', header: t('users.stats.total'), align: 'end', render: (r) => n(r.users) },
              { key: 'active_30d', header: t('reports.users.activeInRole'), align: 'end', render: (r) => n(r.active_30d) },
              { key: 'content', header: t('users.contentCount'), align: 'end', render: (r) => n(r.content) },
              { key: 'avg', header: t('reports.users.avgContent'), align: 'end', render: (r) => Number(r.avg_content_per_user).toFixed(2) },
            ]}
          />
        </Panel>

        <Panel title={t('reports.users.activity')}>
          <SegmentBar
            segments={['last_7d', 'last_30d', 'last_90d', 'over_90d', 'never'].map((b) => ({
              label: t(`reports.users.${b}`),
              value: d.activity.find((x: any) => x.bucket === b)?.count ?? 0,
            })).filter((s) => s.value > 0)}
          />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title={t('reports.users.status')}>
          <DonutChart data={d.byStatus.map((s: any) => ({ name: t(`users.status.${s.key}`, { defaultValue: s.key }), value: s.count }))} height={200} />
        </Panel>
        <Panel title={t('reports.users.locale')}>
          <DonutChart data={d.byLocale.map((s: any) => ({ name: s.key === 'ar' ? 'العربية' : 'English', value: s.count }))} height={200} />
        </Panel>
        <Panel title={t('reports.users.engagement')}>
          <RankedList
            items={d.engagementByRole
              .filter((r: any) => r.posts + r.comments + r.enrollments > 0)
              .slice(0, 6)
              .map((r: any) => ({ label: r.slug, value: r.posts + r.comments + r.enrollments }))}
          />
        </Panel>
      </div>

      <Panel title={t('reports.users.heatmap')}>
        <ActivityHeatmap data={d.heatmap} />
      </Panel>

      <DemographicsSection d={d.demographics} />

      <Panel title={t('reports.users.contributors')}>
        <RankTable
          rows={d.topContributors}
          columns={[
            { key: 'full_name', header: t('common.name'), render: (r) => r.full_name ?? r.email },
            { key: 'roles', header: t('users.roles'), render: (r) => <span className="text-xs text-muted-foreground">{r.roles}</span> },
            { key: 'content', header: t('users.contentCount'), align: 'end', render: (r) => n(r.content) },
            { key: 'published', header: t('library.status.published'), align: 'end', render: (r) => n(r.published) },
            { key: 'views', header: t('library.views'), align: 'end', render: (r) => n(r.views) },
            { key: 'downloads', header: t('library.downloads'), align: 'end', render: (r) => n(r.downloads) },
          ]}
        />
      </Panel>
    </>
  );
}

/* --------------------------------------------------------- content report */

function ContentReport({ d, q }: { d: any; q: ReportQuery }) {
  const { t, i18n } = useTranslation();
  const n = useN();

  return (
    <>
      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label={t('overview.kpi.content')} value={n(d.totals.total)} icon={BookOpen} tone="blue"
          delta={d.deltas?.new_in_range ?? undefined} />
        <StatCard label={t('library.status.published')} value={n(d.totals.published)} tone="success" />
        <StatCard label={t('library.status.pending_review')} value={n(d.totals.pending)} tone={d.totals.pending ? 'warning' : 'ink'} />
        <StatCard label={t('library.status.rejected')} value={n(d.totals.rejected)} tone={d.totals.rejected ? 'danger' : 'ink'} />
        <StatCard label={t('library.views')} value={n(d.totals.views)} tone="teal" />
        <StatCard label={t('library.downloads')} value={n(d.totals.downloads)} icon={Download} tone="violet" />
      </section>

      <Panel title={t('reports.content.uploads')}
        description={t(`reports.dims.${q.groupBy}`, { defaultValue: q.groupBy })}>
        <GroupedTimeline
          rows={d.timeline}
          chart={q.chart === 'area' ? 'area' : q.chart}
          labelFor={(k) => t(`library.type.${k}`, {
            defaultValue: t(`library.status.${k}`, {
              defaultValue: k === 'ar' ? 'العربية' : k === 'en' ? 'English' : k.replace(/_/g, ' '),
            }),
          })}
        />
      </Panel>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title={t('reports.content.funnel')}>
          <Funnel
            stages={[
              { label: t('reports.content.created'), value: d.funnel.created },
              { label: t('reports.content.submitted'), value: d.funnel.submitted },
              { label: t('reports.content.reviewed'), value: d.funnel.reviewed },
              { label: t('reports.content.published'), value: d.funnel.published },
            ]}
          />
        </Panel>
        <Panel title={t('reports.content.reviewTime')}>
          <div className="space-y-4">
            <div>
              <p className="text-xs text-muted-foreground">{t('reports.content.medianHours')}</p>
              <p className="numeric text-3xl font-semibold">{d.reviewTime.median_hours ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('reports.content.avgHours')}</p>
              <p className="numeric text-xl font-medium">{d.reviewTime.avg_hours ?? '—'}</p>
            </div>
            <p className="text-xs text-muted-foreground">
              {n(d.reviewTime.reviewed)} {t('reports.content.reviewed').toLowerCase()}
            </p>
          </div>
        </Panel>
        <Panel title={t('reports.content.language')}>
          <DonutChart data={d.byLanguage.map((l: any) => ({ name: l.key === 'ar' ? 'العربية' : 'English', value: l.count }))} height={200} />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={t('reports.content.byType')}>
          <RankTable
            rows={d.byType}
            columns={[
              { key: 'content_type', header: t('common.type'),
                render: (r) => (
                  <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
                    TONES[CONTENT_TONES[r.content_type] ?? 'blue'].chip)}>
                    {t(`library.type.${r.content_type}`)}
                  </span>
                ) },
              { key: 'total', header: t('common.count'), align: 'end', render: (r) => n(r.total) },
              { key: 'published', header: t('library.status.published'), align: 'end', render: (r) => n(r.published) },
              { key: 'pending', header: t('library.status.pending_review'), align: 'end', render: (r) => n(r.pending) },
              { key: 'downloads', header: t('library.downloads'), align: 'end', render: (r) => n(r.downloads) },
            ]}
          />
        </Panel>
        <Panel title={t('reports.content.interests')}>
          <RankedList
            items={d.byInterest.map((r: any) => ({
              label: i18n.language === 'ar' ? r.name : (r.name_en ?? r.name), value: r.count,
            }))}
          />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={t('reports.matrix')}>
          <RankTable
            rows={Object.values((d.matrix ?? []).reduce((acc: any, m: any) => {
              acc[m.content_type] ??= { content_type: m.content_type };
              acc[m.content_type][m.status] = m.count;
              return acc;
            }, {}))}
            columns={[
              { key: 'content_type', header: t('common.type'),
                render: (r) => t(`library.type.${r.content_type}`) },
              ...['published', 'pending_review', 'draft', 'rejected'].map((st) => ({
                key: st, header: t(`library.status.${st}`), align: 'end' as const,
                render: (r: any) => n(r[st] ?? 0),
              })),
            ]}
          />
        </Panel>
        <Panel title={t('reports.byCreatorRole')}>
          <RankTable
            rows={d.byCreatorRole ?? []}
            columns={[
              { key: 'slug', header: t('users.roles') },
              { key: 'content', header: t('users.contentCount'), align: 'end', render: (r) => n(r.content) },
              { key: 'published', header: t('library.status.published'), align: 'end', render: (r) => n(r.published) },
              { key: 'views', header: t('library.views'), align: 'end', render: (r) => n(r.views) },
            ]}
          />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={t('reports.content.top')}>
          <RankTable
            rows={d.topContent}
            columns={[
              { key: 'title', header: t('common.title') },
              { key: 'view_count', header: t('library.views'), align: 'end', render: (r) => n(r.view_count) },
              { key: 'download_count', header: t('library.downloads'), align: 'end', render: (r) => n(r.download_count) },
            ]}
          />
        </Panel>
        <Panel title={t('reports.content.contributors')}>
          <RankedList items={d.contributors.map((c: any) => ({ label: c.name, value: c.count }))} />
        </Panel>
      </div>

      <Panel title={t('reports.license')}>
        <RankedList items={(d.byLicense ?? []).map((l: any) => ({
          label: String(l.key).replace(/_/g, ' ').toUpperCase(), value: l.count,
        }))} />
      </Panel>

      <AcademicSection d={d.academic} />
    </>
  );
}

/* ------------------------------------------------------ engagement report */

function EngagementReport({ d }: { d: any }) {
  const { t } = useTranslation();
  const n = useN();
  const timeline = useDayLabels(d.timeline);

  return (
    <>
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        <StatCard label={t('nav.posts')} value={n(d.totals.posts)} tone="violet" />
        <StatCard label={t('nav.comments')} value={n(d.totals.comments)} tone="blue" />
        <StatCard label={t('library.engagement')} value={n(d.totals.reactions)} tone="rose" />
        <StatCard label={t('nav.reels')} value={n(d.totals.reels)} tone="orange" />
        <StatCard label={t('library.downloads')} value={n(d.totals.downloads)} tone="teal" />
        <StatCard label={t('taxonomy.followers')} value={n(d.totals.follows)} tone="sky" />
        <StatCard label={t('actions.save')} value={n(d.totals.bookmarks)} tone="emerald" />
      </section>

      <Panel title={t('reports.engagement.timeline')}>
        <TrendChart
          data={timeline}
          series={[
            { key: 'posts', label: t('nav.posts') },
            { key: 'comments', label: t('nav.comments') },
            { key: 'reactions', label: t('library.engagement') },
            { key: 'downloads', label: t('library.downloads') },
          ]}
          height={280}
        />
      </Panel>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title={t('reports.engagement.reactions')}>
          <DonutChart data={d.byTarget.map((r: any) => ({ name: r.target_type, value: r.reactions }))} height={200} />
        </Panel>
        <Panel title={t('reports.engagement.comments')}>
          <DonutChart data={d.commentsByTarget.map((r: any) => ({ name: r.target_type, value: r.comments }))} height={200} />
        </Panel>
        <Panel title={t('reports.engagement.downloads')}>
          <RankedList items={d.topDownloads.map((r: any) => ({ label: r.title, value: r.downloads }))} />
        </Panel>
      </div>
    </>
  );
}

/* ------------------------------------------------------ moderation report */

function ModerationReport({ d }: { d: any }) {
  const { t } = useTranslation();
  const n = useN();
  const timeline = useDayLabels(d.timeline);

  return (
    <>
      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label={t('moderation.open')} value={n(d.totals.open)} icon={Flag} tone={d.totals.open ? 'danger' : 'ink'} />
        <StatCard label={t('moderation.overdue')} value={n(d.totals.overdue)} tone={d.totals.overdue ? 'warning' : 'ink'} />
        <StatCard label={t('moderation.actioned')} value={n(d.totals.actioned)} tone="violet" />
        <StatCard label={t('moderation.dismissed')} value={n(d.totals.dismissed)} tone="ink" />
        <StatCard label={t('moderation.actionsTitle')} value={n(d.totals.actions)} icon={Activity} tone="rose" />
        <StatCard label={t('library.status.pending_review')} value={n(d.totals.pending_content)} tone={d.totals.pending_content ? 'warning' : 'ink'} />
      </section>

      <Panel title={t('reports.moderation.timeline')}>
        <TrendChart
          data={timeline}
          series={[
            { key: 'reported', label: t('reports.moderation.reported') },
            { key: 'resolved', label: t('reports.moderation.resolved') },
            { key: 'actions', label: t('moderation.actionsTitle') },
          ]}
          height={280}
        />
      </Panel>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title={t('reports.moderation.reasons')}>
          <RankedList items={d.byReason.map((r: any) => ({ label: r.reason, value: r.count }))} />
        </Panel>
        <Panel title={t('reports.moderation.targets')}>
          <DonutChart data={d.byTargetType.map((r: any) => ({ name: r.target_type, value: r.count }))} height={200} />
        </Panel>
        <Panel title={t('reports.moderation.resolution')}>
          <div className="space-y-4">
            <div>
              <p className="text-xs text-muted-foreground">{t('reports.content.medianHours')}</p>
              <p className="numeric text-3xl font-semibold">{d.resolutionTime.median_hours ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('reports.content.avgHours')}</p>
              <p className="numeric text-xl font-medium">{d.resolutionTime.avg_hours ?? '—'}</p>
            </div>
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={t('reports.moderation.actions')}>
          <RankedList items={d.byAction.map((r: any) => ({ label: r.action, value: r.count }))} />
        </Panel>
        <Panel title={t('reports.moderation.moderators')}>
          <RankedList items={d.moderators.map((r: any) => ({ label: r.name, value: r.actions }))} />
        </Panel>
      </div>
    </>
  );
}

/* -------------------------------------------------------- learning report */

function LearningReport({ d }: { d: any }) {
  const { t } = useTranslation();
  const n = useN();
  const timeline = useDayLabels(d.timeline);
  const completion = d.totals.enrollments > 0
    ? ((d.totals.completed / d.totals.enrollments) * 100).toFixed(1)
    : '0.0';

  return (
    <>
      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label={t('learn.coursesTitle')} value={n(d.totals.courses)} icon={GraduationCap} tone="amber" />
        <StatCard label={t('library.status.published')} value={n(d.totals.published)} tone="success" />
        <StatCard label={t('learn.enrollmentsTitle')} value={n(d.totals.enrollments)} tone="blue" />
        <StatCard label={t('reports.learning.completion')} value={`${completion}%`} tone="teal" />
        <StatCard label={t('learn.avgProgress')} value={`${d.totals.avg_progress}%`} tone="violet" />
        <StatCard label={t('learn.scholarshipsTitle')} value={n(d.totals.scholarships)} tone="emerald" />
      </section>

      <Panel title={t('reports.learning.timeline')}>
        <TrendChart
          data={timeline}
          series={[
            { key: 'enrollments', label: t('learn.enrollmentsTitle') },
            { key: 'courses', label: t('learn.coursesTitle') },
          ]}
          height={260}
        />
      </Panel>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2" title={t('reports.learning.progress')}>
          {d.progress.length ? (
            <CategoryBarChart
              xKey="band"
              data={d.progress}
              series={[{ key: 'count', label: t('learn.progress') }]}
              height={220}
            />
          ) : (
            <p className="py-10 text-center text-sm text-muted-foreground">{t('common.noResults')}</p>
          )}
        </Panel>
        <Panel title={t('reports.learning.mode')}>
          <DonutChart data={d.byMode.map((m: any) => ({ name: t(`learn.${m.delivery_mode}`, { defaultValue: m.delivery_mode }), value: m.count }))} height={200} />
        </Panel>
      </div>

      <Panel title={t('reports.learning.top')}>
        <RankTable
          rows={d.topCourses}
          columns={[
            { key: 'title', header: t('common.title') },
            { key: 'instructor', header: t('learn.instructor'), render: (r) => r.instructor ?? '—' },
            { key: 'enrollments', header: t('learn.enrollmentsTitle'), align: 'end', render: (r) => n(r.enrollments) },
            { key: 'avg_progress', header: t('learn.avgProgress'), align: 'end', render: (r) => `${r.avg_progress}%` },
          ]}
        />
      </Panel>

      <ScholarshipExamSection s={d.scholarships} e={d.exams} />
    </>
  );
}

/* ---------------------------------------------------- app members report */

/**
 * The mobile audience specifically — separate from the `users` report above, which covers
 * staff and members together. Backed by `GET /reports/app-members`
 * (`ReportsService.appMembers`): growth, interest distribution, the blue-star/silver/gold
 * contribution ladder, most active members, where they are, and a cheap retention proxy.
 */
function AppMembersReport({ d }: { d: any }) {
  const { t, i18n } = useTranslation();
  const n = useN();
  const lang = i18n.language;
  const timeline = useDayLabels(d.timeline);
  const cumulative = useDayLabels(d.cumulative ?? []);
  const retentionPct = d.retention?.eligible > 0
    ? ((d.retention.retained_30d / d.retention.eligible) * 100).toFixed(1)
    : null;

  return (
    <>
      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatCard label={t('users.stats.total')} value={n(d.totals.total)} icon={Users} tone="sky" />
        <StatCard label={t('users.stats.active')} value={n(d.totals.active)} tone="success" />
        <StatCard label={t('users.stats.new30d')} value={n(d.totals.new_in_range)} tone="violet"
          delta={d.deltas?.new_in_range ?? undefined}
          hint={d.deltas?.new_in_range == null ? t('reports.vsPrevious') : undefined} />
        <StatCard label={t('users.stats.active7d')} value={n(d.totals.active_30d)} tone="teal" />
        <StatCard
          label={t('reports.appMembers.retention')}
          value={retentionPct != null ? `${retentionPct}%` : '—'}
          tone="amber"
          hint={retentionPct == null ? t('common.noResults') : undefined}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2" title={t('reports.appMembers.growth')}>
          {timeline.some((r: any) => r.signups > 0) ? (
            <TrendChart data={timeline} series={[{ key: 'signups', label: t('reports.appMembers.signups') }]} height={280} />
          ) : (
            <p className="py-10 text-center text-sm text-muted-foreground">{t('common.noResults')}</p>
          )}
        </Panel>
        <Panel title={t('reports.cumulative')}>
          <TrendChart data={cumulative} series={[{ key: 'total', label: t('users.stats.total') }]} height={280} />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={t('reports.appMembers.byClass')}>
          {d.byClass.length ? (
            <DonutChart
              data={d.byClass.map((c: any) => ({ name: t(`appControl.userClass.${c.key}`, { defaultValue: c.key }), value: c.count }))}
              height={220}
            />
          ) : <p className="py-10 text-center text-sm text-muted-foreground">{t('common.noResults')}</p>}
        </Panel>
        <Panel title={t('reports.appMembers.byInterest')}>
          {d.byInterest.length ? (
            <RankedList items={d.byInterest.map((r: any) => ({
              label: lang === 'ar' ? r.name : (r.name_en ?? r.name), value: r.members,
            }))} />
          ) : <p className="py-10 text-center text-sm text-muted-foreground">{t('common.noResults')}</p>}
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={t('reports.appMembers.byCountry')}>
          {d.byCountry.some((c: any) => c.key !== 'unknown') ? (
            <RankedList
              items={d.byCountry.filter((c: any) => c.key !== 'unknown').slice(0, 10)
                .map((r: any) => ({ label: countryName(r.key, lang), value: r.count }))}
            />
          ) : <p className="py-10 text-center text-sm text-muted-foreground">{t('common.noResults')}</p>}
        </Panel>
        <Panel title={t('reports.appMembers.mostActive')}>
          <RankTable
            rows={d.mostActive}
            columns={[
              { key: 'name', header: t('common.name') },
              { key: 'posts', header: t('nav.posts'), align: 'end', render: (r) => n(r.posts) },
              { key: 'comments', header: t('nav.comments'), align: 'end', render: (r) => n(r.comments) },
              { key: 'contributions', header: t('users.contentCount'), align: 'end', render: (r) => n(r.contributions) },
            ]}
          />
        </Panel>
      </div>
    </>
  );
}

/* ----------------------------------------------------------- pages report */

/**
 * Institutional, publisher and community pages. Backed by `GET /reports/pages`
 * (`ReportsService.pages`): how many exist and when they joined, who follows them, which
 * are actually active (publishing content, generating posts), and what they are about.
 */
function PagesReport({ d }: { d: any }) {
  const { t, i18n } = useTranslation();
  const n = useN();
  const lang = i18n.language;
  const timeline = useDayLabels(d.timeline);
  const cumulative = useDayLabels(d.cumulative ?? []);

  return (
    <>
      <section className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatCard label={t('taxonomy.pagesTitle')} value={n(d.totals.total)} icon={BadgeCheck} tone="sky" />
        <StatCard label={t('taxonomy.verified')} value={n(d.totals.verified)} tone="success" />
        <StatCard label={t('users.stats.new30d')} value={n(d.totals.new_in_range)} tone="violet"
          delta={d.deltas?.new_in_range ?? undefined}
          hint={d.deltas?.new_in_range == null ? t('reports.vsPrevious') : undefined} />
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2" title={t('reports.pages.growth')}>
          {timeline.some((r: any) => r.created > 0) ? (
            <TrendChart data={timeline} series={[{ key: 'created', label: t('reports.pages.created') }]} height={280} />
          ) : (
            <p className="py-10 text-center text-sm text-muted-foreground">{t('common.noResults')}</p>
          )}
        </Panel>
        <Panel title={t('reports.cumulative')}>
          <TrendChart data={cumulative} series={[{ key: 'total', label: t('users.stats.total') }]} height={280} />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={t('taxonomy.kind')}>
          {d.byKind.length ? (
            <DonutChart
              data={d.byKind.map((k: any) => ({ name: t(`taxonomy.kinds.${k.key}`, { defaultValue: k.key }), value: k.count }))}
              height={200}
            />
          ) : <p className="py-10 text-center text-sm text-muted-foreground">{t('common.noResults')}</p>}
        </Panel>
        <Panel title={t('reports.pages.byInterest')}>
          {d.byInterest.length ? (
            <RankedList items={d.byInterest.map((r: any) => ({
              label: lang === 'ar' ? r.name : (r.name_en ?? r.name), value: r.pages,
            }))} />
          ) : <p className="py-10 text-center text-sm text-muted-foreground">{t('common.noResults')}</p>}
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={t('reports.pages.mostFollowed')}>
          <RankTable
            rows={d.mostFollowed}
            columns={[
              { key: 'name', header: t('common.name') },
              { key: 'kind', header: t('taxonomy.kind'), render: (r) => t(`taxonomy.kinds.${r.kind}`, { defaultValue: r.kind }) },
              { key: 'followers', header: t('taxonomy.followers'), align: 'end', render: (r) => n(r.followers) },
            ]}
          />
        </Panel>
        <Panel title={t('reports.pages.mostActive')}>
          <RankTable
            rows={d.mostActive}
            columns={[
              { key: 'name', header: t('common.name') },
              { key: 'content', header: t('taxonomy.items'), align: 'end', render: (r) => n(r.content) },
              { key: 'posts', header: t('nav.posts'), align: 'end', render: (r) => n(r.posts) },
            ]}
          />
        </Panel>
      </div>
    </>
  );
}
