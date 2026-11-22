import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  Activity, BookOpen, ClipboardCheck, Database, Flag, GraduationCap,
  HardDrive, LayoutDashboard, Radio, Users,
} from 'lucide-react';
import { api } from '@/lib/api';
import { formatBytes, formatDate, formatNumber, formatRelative } from '@/lib/utils';
import { CategoryBarChart, DonutChart, RankedList, TrendChart } from '@/components/data/charts';
import { MetricRow, PageHeader, Panel, StatCard } from '@/components/data/page-parts';
import { Badge, Skeleton } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';

export function OverviewPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['analytics', 'overview'],
    queryFn: () => api.get('/analytics/overview'),
    refetchInterval: 120_000,
  });
  const { data: health } = useQuery({
    queryKey: ['health'],
    queryFn: () => api.get('/health'),
    refetchInterval: 60_000,
  });

  const k = data?.kpis;
  const n = (v: any) => formatNumber(v, lang);

  return (
    <>
      <PageHeader
        icon={LayoutDashboard}
        tone="indigo"
        title={t('overview.title')}
        subtitle={t('overview.subtitle')}
        actions={
          <Button variant="outline" size="sm" onClick={() => void refetch()} loading={isFetching}>
            {t('actions.refresh')}
          </Button>
        }
      />

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {/* Each tile carries the hue of the area it links to, matching the sidebar. */}
        <StatCard loading={isLoading} label={t('overview.kpi.users')} value={n(k?.users)} icon={Users}
          tone="sky" hint={`+${n(k?.users_30d)} ${t('common.last30Days')}`} />
        <StatCard loading={isLoading} label={t('overview.kpi.content')} value={n(k?.content)} icon={BookOpen}
          tone="blue" hint={`${n(k?.published)} ${t('overview.kpi.published')}`} />
        <StatCard loading={isLoading} label={t('overview.kpi.pending')} value={n(k?.pending_review)}
          icon={ClipboardCheck} tone={k?.pending_review ? 'warning' : 'violet'} />
        <StatCard loading={isLoading} label={t('overview.kpi.openReports')} value={n(k?.open_reports)}
          icon={Flag} tone={k?.open_reports ? 'danger' : 'rose'} />
        <StatCard loading={isLoading} label={t('overview.kpi.enrollments')} value={n(k?.enrollments)}
          icon={GraduationCap} tone="amber" hint={`${n(k?.courses)} ${t('nav.courses')}`} />
        <StatCard loading={isLoading} label={t('overview.kpi.liveRooms')} value={n(k?.live_rooms)}
          icon={Radio} tone={k?.live_rooms ? 'danger' : 'teal'} />
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2" title={t('overview.growth')} description={t('common.last30Days')}>
          {isLoading ? (
            <Skeleton className="h-[260px]" />
          ) : (
            <TrendChart
              data={(data?.growth ?? []).map((row: any) => ({
                ...row,
                day: formatDate(row.day, lang).replace(/\s\d{4}$/, ''),
              }))}
              series={[
                { key: 'users', label: t('overview.kpi.users') },
                { key: 'content', label: t('overview.kpi.content') },
                { key: 'downloads', label: t('overview.kpi.downloads') },
                { key: 'comments', label: t('nav.comments') },
              ]}
            />
          )}
        </Panel>

        <div className="space-y-4">
          <Panel title={t('overview.systemHealth')}>
            <ul className="space-y-2.5">
              {(['database', 'cache', 'storage'] as const).map((key) => {
                const up = health?.components?.[key] === 'up';
                const Icon = { database: Database, cache: Activity, storage: HardDrive }[key];
                return (
                  <li key={key} className="flex items-center gap-3">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{t(`overview.component.${key}`)}</span>
                    <Badge variant={up ? 'success' : 'danger'} className="ms-auto">
                      {up ? t('overview.up') : t('overview.down')}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          </Panel>

          <Panel title={t('overview.kpi.storage')}>
            <p className="numeric text-2xl font-semibold">{formatBytes(k?.storage_bytes)}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {n(k?.media_assets)} {t('nav.media').toLowerCase()}
            </p>
            <div className="mt-4">
              <MetricRow
                items={[
                  { label: t('overview.kpi.views'), value: n(k?.views) },
                  { label: t('overview.kpi.downloads'), value: n(k?.downloads) },
                ]}
              />
            </div>
          </Panel>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2" title={t('overview.libraryBreakdown')}>
          {isLoading ? (
            <Skeleton className="h-[260px]" />
          ) : (
            <CategoryBarChart
              stacked
              xKey="label"
              data={(data?.libraryByType ?? []).map((row: any) => ({
                ...row,
                label: t(`library.type.${row.content_type}_plural`, { defaultValue: row.content_type }),
              }))}
              series={[
                { key: 'published', label: t('library.status.published') },
                { key: 'pending', label: t('library.status.pending_review') },
                { key: 'draft', label: t('library.status.draft') },
                { key: 'rejected', label: t('library.status.rejected') },
              ]}
            />
          )}
        </Panel>

        <Panel title={t('overview.languages')}>
          {isLoading ? (
            <Skeleton className="h-[240px]" />
          ) : (
            <DonutChart
              data={(data?.languages ?? []).map((row: any) => ({
                name: row.language === 'ar' ? 'العربية' : row.language === 'en' ? 'English' : row.language,
                value: row.count,
              }))}
            />
          )}
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={t('overview.topInterests')}>
          {isLoading ? (
            <Skeleton className="h-40" />
          ) : (
            <RankedList
              items={(data?.topInterests ?? []).map((row: any) => ({
                label: lang === 'ar' ? row.name : (row.name_en ?? row.name),
                value: row.content_count,
              }))}
              valueLabel={t('taxonomy.items')}
            />
          )}
        </Panel>

        <Panel
          title={t('overview.recentActivity')}
          actions={
            <Button variant="ghost" size="sm" asChild>
              <Link to="/audit">{t('actions.view')}</Link>
            </Button>
          }
        >
          {isLoading ? (
            <Skeleton className="h-40" />
          ) : (
            <ul className="divide-y text-sm">
              {(data?.recentActivity ?? []).map((row: any) => (
                <li key={row.id} className="flex items-center gap-3 py-2">
                  <Badge variant="secondary" className="shrink-0 font-mono text-[10px]">{row.action}</Badge>
                  <span className="truncate text-muted-foreground">{row.actor_name ?? '—'}</span>
                  <span className="ms-auto shrink-0 text-xs text-muted-foreground">
                    {formatRelative(row.created_at, lang)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
