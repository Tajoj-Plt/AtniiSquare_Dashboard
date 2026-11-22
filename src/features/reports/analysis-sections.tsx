import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Award, FileCheck2, GraduationCap } from 'lucide-react';
import {
  Activity, BookOpen, Download, UserCheck, Users,
} from 'lucide-react';
import { cn, formatBytes, formatNumber } from '@/lib/utils';
import { downloadCsv, toCsv } from '@/lib/csv';
import { Button } from '@/components/ui/button';
import { Panel, StatCard } from '@/components/data/page-parts';
import { CategoryBarChart, DonutChart, RankedList, SERIES_COLORS } from '@/components/data/charts';
import { ActivityHeatmap, Funnel, RankTable, SegmentBar } from '@/components/data/report-charts';
import {
  BoxPlot, BulletChart, CohortGrid, CorrelationMatrix, CoverageBars, DivergingBars, Histogram,
  LorenzCurve, MatrixHeatmap, ParetoChart, PopulationPyramid, RadarProfile, ScatterPlot,
  SegmentGrid, ShareArea, SlopeChart, Treemap,
} from '@/components/data/analytic-charts';
import { countryFlag, countryName } from '@/lib/countries';

/**
 * The four analytical reports.
 *
 * They are separated from the counting reports next door because they answer a different
 * class of question and share a different vocabulary — quantiles, correlation, cohorts,
 * period-over-period. Each takes the whole payload of its endpoint and does no fetching of
 * its own, so the period selector on the page governs all of them identically.
 */

/** Every panel that shows rows can be taken away as a file. */
export function ExportButton({ name, rows, columns }: {
  name: string;
  rows: any[];
  columns?: { key: string; header: string }[];
}) {
  const { t } = useTranslation();
  if (!rows?.length) return null;
  return (
    <Button
      variant="ghost" size="sm"
      onClick={() => downloadCsv(name, toCsv(rows, columns))}
      title={t('reports.exportCsv')}
    >
      <Download className="h-4 w-4" /> CSV
    </Button>
  );
}

const useN = () => {
  const { i18n } = useTranslation();
  return (v: any) => formatNumber(v, i18n.language);
};

/* ============================================================== behaviour */

const SEGMENT_TONES: Record<string, string> = {
  champion: 'border-success/40 bg-success/10',
  loyal: 'border-accent/40 bg-accent/10',
  promising: 'border-sky-500/30 bg-sky-500/10',
  new: 'border-violet-500/30 bg-violet-500/10',
  at_risk: 'border-warning/40 bg-warning/10',
  hibernating: 'border-danger/30 bg-danger/10',
  dormant: 'border-border bg-muted/40',
};

export function BehaviourReport({ d }: { d: any }) {
  const { t, i18n } = useTranslation();
  const n = useN();
  const lang = i18n.language;
  const totalSegmented = (d.segments ?? []).reduce((s: number, x: any) => s + x.users, 0);
  const kindLabel = (k: string) => t(`reports.behaviour.kind.${k}`, { defaultValue: k });
  const eventSeries = React.useMemo(
    () => [...new Set((d.eventMix ?? []).map((r: any) => String(r.key)))] as string[],
    [d.eventMix],
  );

  const withInterests = (d.interestEffect ?? []).find((x: any) => x.key === 'with_interests');
  const without = (d.interestEffect ?? []).find((x: any) => x.key === 'without_interests');

  return (
    <>
      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatCard label={t('reports.behaviour.signedUp')} value={n(d.lifecycle?.signed_up)} icon={Users} tone="sky" />
        <StatCard label={t('reports.behaviour.signedIn')} value={n(d.lifecycle?.signed_in)} tone="blue" />
        <StatCard label={t('reports.behaviour.engaged')} value={n(d.lifecycle?.engaged)} icon={Activity} tone="violet" />
        <StatCard label={t('reports.behaviour.contributed')} value={n(d.lifecycle?.contributed)} tone="teal" />
        <StatCard label={t('reports.behaviour.retained')} value={n(d.lifecycle?.retained)} icon={UserCheck} tone="success" />
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title={t('reports.behaviour.lifecycle')} description={t('reports.behaviour.lifecycleHint')}>
          <Funnel
            stages={[
              { label: t('reports.behaviour.signedUp'), value: d.lifecycle?.signed_up ?? 0 },
              { label: t('reports.behaviour.signedIn'), value: d.lifecycle?.signed_in ?? 0 },
              { label: t('reports.behaviour.engaged'), value: d.lifecycle?.engaged ?? 0 },
              { label: t('reports.behaviour.contributed'), value: d.lifecycle?.contributed ?? 0 },
            ]}
          />
        </Panel>

        <Panel
          className="lg:col-span-2"
          title={t('reports.behaviour.cohorts')}
          description={t('reports.behaviour.cohortsHint')}
          actions={<ExportButton name="cohort-retention" rows={d.cohorts?.activity ?? []} />}
        >
          <CohortGrid sizes={d.cohorts?.sizes ?? []} activity={d.cohorts?.activity ?? []} />
        </Panel>
      </div>

      <Panel title={t('reports.behaviour.segments')} description={t('reports.behaviour.segmentsHint')}>
        <SegmentGrid
          segments={d.segments ?? []}
          total={totalSegmented}
          labelFor={(k) => t(`reports.behaviour.segment.${k}`, { defaultValue: k })}
          toneFor={(k) => SEGMENT_TONES[k] ?? ''}
          hintFor={(s) => (s.users
            ? `${t('reports.behaviour.avgEvents')} ${Number(s.avg_events).toFixed(1)}`
            : null)}
        />
      </Panel>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2" title={t('reports.behaviour.rhythm')} description={t('reports.behaviour.rhythmHint')}>
          <ActivityHeatmap data={d.heatmap ?? []} />
        </Panel>
        <Panel title={t('reports.behaviour.recency')}>
          <SegmentBar
            segments={['today', 'week', 'month', 'quarter', 'older', 'never']
              .map((k) => ({
                label: t(`reports.behaviour.recencyBucket.${k}`, { defaultValue: k }),
                value: (d.recency ?? []).find((x: any) => x.key === k)?.count ?? 0,
              }))
              .filter((s) => s.value > 0)}
          />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={t('reports.behaviour.mix')} description={t('reports.behaviour.mixHint')}>
          <ShareArea rows={d.eventMix ?? []} series={eventSeries} labelFor={kindLabel} />
        </Panel>
        <Panel title={t('reports.behaviour.depth')} description={t('reports.behaviour.depthHint')}>
          <Histogram bins={d.depth?.bins ?? []} stats={d.depth?.stats} log={d.depth?.log}
            unit={t('reports.behaviour.events')} />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title={t('reports.behaviour.byKind')}
          actions={<ExportButton name="activity-by-kind" rows={d.byKind ?? []} />}>
          <RankedList items={(d.byKind ?? []).map((r: any) => ({ label: kindLabel(r.key), value: r.count }))} />
        </Panel>

        <Panel className="lg:col-span-2" title={t('reports.behaviour.interestEffect')}
          description={t('reports.behaviour.interestEffectHint')}>
          {withInterests && without ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {[withInterests, without].map((row: any, i) => (
                <div key={row.key} className={cn('rounded-xl border p-4', i === 0 ? 'border-accent/40 bg-accent/5' : '')}>
                  <p className="text-sm font-medium">{t(`reports.behaviour.${row.key}`)}</p>
                  <p className="numeric mt-2 text-2xl font-semibold">{Number(row.avg_events).toFixed(1)}</p>
                  <p className="text-xs text-muted-foreground">{t('reports.behaviour.avgEventsPerUser')}</p>
                  <dl className="mt-3 flex gap-5 text-xs">
                    <div>
                      <dt className="text-muted-foreground">{t('users.stats.total')}</dt>
                      <dd className="numeric font-medium">{n(row.users)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">{t('users.stats.active30d')}</dt>
                      <dd className="numeric font-medium">
                        {n(row.active_30d)}
                        <span className="ms-1 text-muted-foreground">
                          ({row.users ? ((row.active_30d / row.users) * 100).toFixed(0) : 0}%)
                        </span>
                      </dd>
                    </div>
                  </dl>
                </div>
              ))}
            </div>
          ) : null}
        </Panel>
      </div>

      <Panel
        title={t('reports.behaviour.affinity')}
        description={t('reports.behaviour.affinityHint')}
        actions={<ExportButton name="interest-affinity" rows={d.interestAffinity ?? []} />}
      >
        <RankTable
          rows={d.interestAffinity ?? []}
          columns={[
            { key: 'name', header: t('taxonomy.interestsTitle'),
              render: (r) => (lang === 'ar' ? r.name : (r.name_en ?? r.name)) },
            { key: 'followers', header: t('reports.behaviour.followers'), align: 'end', render: (r) => n(r.followers) },
            { key: 'content', header: t('overview.kpi.content'), align: 'end', render: (r) => n(r.content) },
            { key: 'views', header: t('library.views'), align: 'end', render: (r) => n(r.views) },
            { key: 'downloads', header: t('library.downloads'), align: 'end', render: (r) => n(r.downloads) },
            {
              key: 'ratio', header: t('reports.behaviour.supply'), align: 'end',
              // Demand per published item. A high number is an interest whose audience is
              // being under-served, which is the actionable end of this table.
              render: (r) => (
                <span className={cn(r.content === 0 && r.followers > 0 && 'text-warning font-medium')}>
                  {r.content ? (r.followers / r.content).toFixed(1) : (r.followers ? '∞' : '—')}
                </span>
              ),
            },
          ]}
        />
      </Panel>
    </>
  );
}

/* =========================================================== distribution */

export function DistributionReport({ d }: { d: any }) {
  const { t } = useTranslation();
  const n = useN();
  const typeLabel = (k: string) => t(`library.type.${k}`, { defaultValue: k });

  const treemapData = React.useMemo(
    () => (d.treemap ?? []).map((r: any) => ({
      name: `${typeLabel(r.group_key)} · ${t(`library.status.${r.key}`, { defaultValue: r.key })}`,
      size: Number(r.value),
    })),
    [d.treemap, t],
  );

  return (
    <>
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label={t('overview.kpi.content')} value={n(d.totals?.content)} icon={BookOpen} tone="blue" />
        <StatCard label={t('reports.distribution.creators')} value={n(d.totals?.creators)} icon={Users} tone="violet" />
        <StatCard label={t('library.views')} value={n(d.totals?.views)} tone="teal" />
        <StatCard label={t('media.storageUsed')} value={formatBytes(d.totals?.bytes)} tone="amber" />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={t('reports.distribution.viewsHist')} description={t('reports.distribution.viewsHistHint')}>
          <Histogram bins={d.histograms?.views?.bins ?? []} stats={d.histograms?.views?.stats}
            log={d.histograms?.views?.log} unit={t('library.views')} />
        </Panel>
        <Panel title={t('reports.distribution.downloadsHist')}>
          <Histogram bins={d.histograms?.downloads?.bins ?? []} stats={d.histograms?.downloads?.stats}
            log={d.histograms?.downloads?.log} unit={t('library.downloads')} />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={t('reports.distribution.perCreator')} description={t('reports.distribution.perCreatorHint')}>
          <Histogram bins={d.histograms?.per_creator?.bins ?? []} stats={d.histograms?.per_creator?.stats} />
        </Panel>
        <Panel title={t('reports.distribution.reviewHist')} description={t('reports.distribution.reviewHistHint')}>
          <Histogram bins={d.histograms?.review_hours?.bins ?? []} stats={d.histograms?.review_hours?.stats}
            unit={t('reports.distribution.hours')} />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2" title={t('reports.distribution.boxByType')}
          description={t('reports.distribution.boxHint')}
          actions={<ExportButton name="views-by-type" rows={d.quantiles?.views_by_type ?? []} />}>
          <BoxPlot rows={d.quantiles?.views_by_type ?? []} labelFor={typeLabel} scale="sqrt" />
        </Panel>
        <Panel title={t('reports.distribution.concentration')} description={t('reports.distribution.concentrationHint')}>
          <LorenzCurve
            points={d.lorenz ?? []} gini={d.gini}
            xLabel={t('reports.distribution.creatorsAxis')}
            yLabel={t('reports.distribution.contentAxis')}
          />
        </Panel>
      </div>

      <Panel
        title={t('reports.distribution.pareto')}
        description={t('reports.distribution.paretoHint')}
        actions={<ExportButton name="top-creators" rows={d.pareto ?? []} />}
      >
        <ParetoChart rows={d.pareto ?? []} valueLabel={t('users.contentCount')} />
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={t('reports.distribution.composition')} description={t('reports.distribution.compositionHint')}>
          <Treemap data={treemapData} />
        </Panel>
        <Panel title={t('reports.distribution.progressBox')} description={t('reports.distribution.progressHint')}>
          <BoxPlot rows={d.quantiles?.progress_by_course ?? []} />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={t('reports.distribution.byLanguage')}>
          <BoxPlot
            rows={d.quantiles?.views_by_language ?? []}
            labelFor={(k) => (k === 'ar' ? 'العربية' : k === 'en' ? 'English' : k)}
            scale="sqrt"
          />
        </Panel>
        <Panel title={t('reports.distribution.storage')}
          actions={<ExportButton name="storage-by-type" rows={d.storage ?? []} />}>
          <RankTable
            rows={d.storage ?? []}
            columns={[
              { key: 'key', header: t('common.type') },
              { key: 'files', header: t('media.title'), align: 'end', render: (r) => n(r.files) },
              { key: 'bytes', header: t('media.storageUsed'), align: 'end', render: (r) => formatBytes(r.bytes) },
              { key: 'median_mb', header: t('reports.distribution.medianSize'), align: 'end', render: (r) => `${r.median_mb} MB` },
              { key: 'avg_mb', header: t('reports.distribution.avgSize'), align: 'end', render: (r) => `${r.avg_mb} MB` },
            ]}
          />
        </Panel>
      </div>
    </>
  );
}

/* ========================================================== relationships */

export function RelationshipsReport({ d }: { d: any }) {
  const { t, i18n } = useTranslation();
  const n = useN();
  const lang = i18n.language;
  const metricLabel = (k: string) => t(`reports.relationships.metric.${k}`, { defaultValue: k });
  const typeLabel = (k: string) => t(`library.type.${k}`, { defaultValue: k });

  const matrix = React.useMemo(() => {
    const rows = [...new Set((d.interestMatrix ?? []).map((r: any) =>
      lang === 'ar' ? r.row_key : (r.row_key_en ?? r.row_key)))] as string[];
    const columns = [...new Set((d.interestMatrix ?? []).map((r: any) => String(r.col_key)))] as string[];
    const cells = new Map<string, number>();
    for (const r of d.interestMatrix ?? []) {
      const row = lang === 'ar' ? r.row_key : (r.row_key_en ?? r.row_key);
      cells.set(`${row}||${r.col_key}`, Number(r.value));
    }
    return { rows: rows.slice(0, 14), columns, cells };
  }, [d.interestMatrix, lang]);

  return (
    <>
      <Panel
        title={t('reports.relationships.correlation')}
        description={t('reports.relationships.correlationHint')}
      >
        <CorrelationMatrix
          metrics={d.correlation?.metrics ?? []}
          matrix={d.correlation?.matrix ?? []}
          labelFor={metricLabel}
        />
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={t('reports.relationships.ageViews')} description={t('reports.relationships.ageViewsHint')}
          actions={<ExportButton name="content-age-vs-views" rows={d.contentScatter ?? []} />}>
          <ScatterPlot
            points={d.contentScatter ?? []}
            xLabel={t('reports.relationships.ageDays')}
            yLabel={t('library.views')}
            seriesLabel={typeLabel}
          />
        </Panel>
        <Panel title={t('reports.relationships.conversion')} description={t('reports.relationships.conversionHint')}>
          <ScatterPlot
            points={d.conversionScatter ?? []}
            xLabel={t('library.views')}
            yLabel={t('library.downloads')}
            seriesLabel={typeLabel}
          />
        </Panel>
      </div>

      <Panel
        title={t('reports.relationships.creators')}
        description={t('reports.relationships.creatorsHint')}
        actions={<ExportButton name="creator-output-vs-reach" rows={d.creatorScatter ?? []} />}
      >
        <ScatterPlot
          points={d.creatorScatter ?? []}
          xLabel={t('users.contentCount')}
          yLabel={t('library.views')}
          seriesLabel={(k) => t(`users.roleName.${k}`, { defaultValue: String(k).replace(/_/g, ' ') })}
          height={340}
        />
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={t('reports.relationships.interestMatrix')} description={t('reports.relationships.interestMatrixHint')}>
          <MatrixHeatmap
            rows={matrix.rows} columns={matrix.columns} cells={matrix.cells}
            labelForColumn={typeLabel}
          />
        </Panel>
        <Panel title={t('reports.relationships.supplyDemand')} description={t('reports.relationships.supplyDemandHint')}>
          <ScatterPlot
            points={(d.interestBubble ?? []).map((r: any) => ({
              title: lang === 'ar' ? r.label : (r.label_en ?? r.label),
              x: r.x, y: r.y, size: r.size,
            }))}
            xLabel={t('reports.behaviour.followers')}
            yLabel={t('overview.kpi.content')}
            showFit={false}
          />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={t('reports.relationships.coOccurrence')} description={t('reports.relationships.coOccurrenceHint')}
          actions={<ExportButton name="interest-pairs" rows={d.coOccurrence ?? []} />}>
          <RankedList
            items={(d.coOccurrence ?? []).slice(0, 12).map((r: any) => ({
              label: lang === 'ar'
                ? `${r.source} + ${r.target}`
                : `${r.source_en ?? r.source} + ${r.target_en ?? r.target}`,
              value: r.value,
            }))}
          />
        </Panel>
        <Panel title={t('reports.relationships.reviewImpact')} description={t('reports.relationships.reviewImpactHint')}>
          <RankTable
            rows={d.reviewImpact ?? []}
            columns={[
              { key: 'key', header: t('reports.relationships.reviewSpeed'),
                render: (r) => t(`reports.relationships.speed.${r.key}`, { defaultValue: r.key }) },
              { key: 'items', header: t('common.count'), align: 'end', render: (r) => n(r.items) },
              { key: 'avg_views', header: t('reports.relationships.avgViews'), align: 'end', render: (r) => n(r.avg_views) },
              { key: 'avg_downloads', header: t('reports.relationships.avgDownloads'), align: 'end', render: (r) => n(r.avg_downloads) },
            ]}
          />
        </Panel>
      </div>
    </>
  );
}

/* ============================================================= comparison */

const RADAR_METRICS = ['content', 'comments', 'reactions', 'downloads', 'enrollments', 'active'];

export function ComparisonReport({ d, groupBy }: { d: any; groupBy: string }) {
  const { t, i18n } = useTranslation();
  const n = useN();
  const lang = i18n.language;

  const dimLabel = React.useCallback((k: string) => t(`library.type.${k}`, {
    defaultValue: t(`library.status.${k}`, {
      defaultValue: k === 'ar' ? 'العربية' : k === 'en' ? 'English' : String(k).replace(/_/g, ' '),
    }),
  }), [t]);

  const shareSeries = React.useMemo(
    () => [...new Set((d.shareOverTime ?? []).map((r: any) => String(r.key)))].slice(0, 8) as string[],
    [d.shareOverTime],
  );

  const headline = (d.metrics ?? []).slice(0, 4);

  return (
    <>
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {headline.map((m: any) => (
          <StatCard
            key={m.key}
            label={t(`reports.comparison.metric.${m.key}`, { defaultValue: m.key })}
            value={n(m.current)}
            delta={m.delta ?? undefined}
            hint={`${t('reports.comparison.previous')} ${n(m.previous)}`}
            tone={m.key === 'users' ? 'sky' : m.key === 'content' ? 'blue' : 'violet'}
          />
        ))}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title={t('reports.comparison.periodOverPeriod')}
          description={`${d.range?.prevFrom} → ${d.range?.prevTo}  ·  ${d.range?.from} → ${d.range?.to}`}
          actions={<ExportButton name="period-over-period" rows={d.metrics ?? []} />}
        >
          <DivergingBars
            rows={d.metrics ?? []}
            labelFor={(k) => t(`reports.comparison.metric.${k}`, { defaultValue: k })}
          />
        </Panel>

        <Panel title={t('reports.comparison.slope')} description={t('reports.comparison.slopeHint')}>
          <SlopeChart
            rows={d.byDimension ?? []}
            labelFor={dimLabel}
            fromLabel={t('reports.comparison.previous')}
            toLabel={t('reports.comparison.current')}
          />
        </Panel>
      </div>

      <Panel
        title={t('reports.comparison.byDimension')}
        description={t(`reports.dims.${groupBy}`, { defaultValue: groupBy })}
        actions={<ExportButton name={`comparison-by-${groupBy}`} rows={d.byDimension ?? []} />}
      >
        <RankTable
          rows={d.byDimension ?? []}
          columns={[
            { key: 'key', header: t('reports.dimension'), render: (r) => dimLabel(r.key) },
            { key: 'previous', header: t('reports.comparison.previous'), align: 'end', render: (r) => n(r.previous) },
            { key: 'current', header: t('reports.comparison.current'), align: 'end', render: (r) => n(r.current) },
            {
              key: 'change', header: t('reports.comparison.change'), align: 'end',
              render: (r) => {
                const change = r.current - r.previous;
                return (
                  <span className={cn(change > 0 ? 'text-success' : change < 0 ? 'text-danger' : 'text-muted-foreground')}>
                    {change > 0 ? '+' : ''}{n(change)}
                  </span>
                );
              },
            },
            { key: 'views', header: t('library.views'), align: 'end', render: (r) => n(r.views) },
            { key: 'downloads', header: t('library.downloads'), align: 'end', render: (r) => n(r.downloads) },
          ]}
        />
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={t('reports.comparison.radar')} description={t('reports.comparison.radarHint')}>
          <RadarProfile
            segments={d.roleProfile ?? []}
            metrics={RADAR_METRICS}
            labelFor={(k) => {
              const row = (d.roleProfile ?? []).find((r: any) => r.key === k);
              return row ? (lang === 'ar' ? row.name : (row.name_en ?? k)) : k;
            }}
            metricLabelFor={(m) => t(`reports.comparison.metric.${m}`, { defaultValue: m })}
          />
        </Panel>

        <Panel title={t('reports.comparison.benchmark')} description={t('reports.comparison.benchmarkHint')}>
          <BulletChart
            rows={(d.benchmark ?? []).map((r: any) => ({
              key: r.key,
              value: Number(r.avg_views),
              benchmark: Number(r.benchmark_views),
              count: r.items,
            }))}
            benchmarkLabel={t('reports.comparison.platformAvg')}
            labelFor={dimLabel}
          />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2" title={t('reports.comparison.share')} description={t('reports.comparison.shareHint')}>
          <ShareArea rows={d.shareOverTime ?? []} series={shareSeries} labelFor={dimLabel} />
        </Panel>
        <Panel title={t('reports.comparison.mixNow')}>
          <DonutChart
            data={(d.byDimension ?? []).slice(0, 8).map((r: any) => ({ name: dimLabel(r.key), value: r.current }))}
            height={220}
          />
        </Panel>
      </div>

      <Panel
        title={t('reports.comparison.roleTable')}
        actions={<ExportButton name="role-profile" rows={d.roleProfile ?? []} />}
      >
        <RankTable
          rows={d.roleProfile ?? []}
          columns={[
            { key: 'name', header: t('users.roles'), render: (r) => (lang === 'ar' ? r.name : (r.name_en ?? r.key)) },
            { key: 'members', header: t('users.stats.total'), align: 'end', render: (r) => n(r.members) },
            { key: 'active', header: t('users.stats.active30d'), align: 'end', render: (r) => n(r.active) },
            { key: 'content', header: t('overview.kpi.content'), align: 'end', render: (r) => n(r.content) },
            { key: 'comments', header: t('nav.comments'), align: 'end', render: (r) => n(r.comments) },
            { key: 'downloads', header: t('library.downloads'), align: 'end', render: (r) => n(r.downloads) },
            { key: 'enrollments', header: t('learn.enrollmentsTitle'), align: 'end', render: (r) => n(r.enrollments) },
          ]}
        />
      </Panel>
    </>
  );
}

/* =========================================================== demographics */

const AGE_BANDS = ['under_18', '18_24', '25_34', '35_44', '45_54', '55_64', '65_plus'] as const;

/**
 * Who the platform reaches, as opposed to how much it is used.
 *
 * Sits inside the user report rather than in a tab of its own: sex, age and place are cuts
 * of the same population the panels above describe, and separating them would invite the
 * two to be read against different filters.
 */
export function DemographicsSection({ d }: { d: any }) {
  const { t, i18n } = useTranslation();
  const n = useN();
  const lang = i18n.language;
  if (!d) return null;

  const bandLabel = (k: string) => t(`users.demographics.bands.${k}`, { defaultValue: k });
  const sexLabel = (k: string) => t(`users.demographics.${k}`, { defaultValue: k });

  const pyramid = new Map<string, number>();
  for (const row of d.sexByAge ?? []) {
    pyramid.set(`${row.row_key}||${row.col_key}`, Number(row.value));
  }

  const known = (rows: any[]) => (rows ?? []).filter((r: any) => r.key);

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title={t('reports.demographics.pyramid')} description={t('reports.demographics.pyramidHint')}
          className="lg:col-span-2">
          <PopulationPyramid
            // Oldest first so the youngest cohorts form the base, as a pyramid should.
            bands={[...AGE_BANDS].reverse()}
            left="male" right="female"
            cells={pyramid}
            labelFor={bandLabel}
            leftLabel={t('users.demographics.male')}
            rightLabel={t('users.demographics.female')}
          />
        </Panel>

        <Panel title={t('reports.demographics.coverage')}>
          <CoverageBars
            total={d.coverage?.total ?? 0}
            fields={['sex', 'birth_date', 'country', 'town', 'village']
              .map((k) => ({ key: k, count: Number(d.coverage?.[k] ?? 0) }))}
            labelFor={(k) => t(`users.demographics.${k === 'birth_date' ? 'birthDate' : k}`, { defaultValue: k })}
          />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title={t('users.demographics.sex')}>
          <DonutChart
            data={(d.sex ?? []).map((r: any) => ({ name: sexLabel(r.key), value: r.count }))}
            height={200}
          />
        </Panel>

        <Panel title={t('users.demographics.ageBand')}
          description={d.age?.known
            ? t('reports.demographics.ageSummary', {
                median: d.age.median, mean: d.age.mean, min: d.age.min, max: d.age.max,
              })
            : undefined}>
          <SegmentBar
            total={Number(d.coverage?.total ?? 0) || undefined}
            segments={(d.ageBand ?? [])
              .filter((r: any) => r.count > 0)
              .map((r: any) => ({ label: bandLabel(r.key), value: r.count }))}
          />
        </Panel>

        <Panel title={t('users.demographics.country')}
          actions={<ExportButton name="users-by-country" rows={d.country ?? []} />}>
          <RankedList
            items={(d.country ?? []).map((r: any) => ({
              label: r.key === 'unknown'
                ? t('users.demographics.notStated')
                : `${countryFlag(r.key)} ${countryName(r.key, lang)}`,
              value: r.count,
            }))}
          />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={t('reports.demographics.towns')}
          actions={<ExportButton name="users-by-town" rows={known(d.town)} />}>
          <RankedList items={known(d.town).map((r: any) => ({ label: r.key, value: r.count }))} />
        </Panel>
        <Panel title={t('reports.demographics.villages')}
          description={t('reports.demographics.villagesHint')}
          actions={<ExportButton name="users-by-village" rows={known(d.village)} />}>
          <RankedList items={known(d.village).map((r: any) => ({ label: r.key, value: r.count }))} />
        </Panel>
      </div>

      <Panel
        title={t('reports.demographics.places')}
        description={t('reports.demographics.placesHint')}
        actions={<ExportButton name="users-by-place" rows={d.byPlace ?? []} />}
      >
        <RankTable
          rows={d.byPlace ?? []}
          columns={[
            { key: 'town', header: t('users.demographics.town') },
            {
              key: 'country', header: t('users.demographics.country'),
              render: (r) => (r.country === 'unknown'
                ? '—'
                : `${countryFlag(r.country)} ${countryName(r.country, lang)}`),
            },
            { key: 'users', header: t('users.stats.total'), align: 'end', render: (r) => n(r.users) },
            { key: 'active_30d', header: t('users.stats.active30d'), align: 'end', render: (r) => n(r.active_30d) },
            { key: 'creators', header: t('reports.distribution.creators'), align: 'end', render: (r) => n(r.creators) },
            {
              key: 'rate', header: t('reports.demographics.activeShare'), align: 'end',
              // Reach without engagement is the actionable case here: a town full of
              // accounts nobody signs into is a different problem from a small one.
              render: (r) => {
                const pct = r.users ? (r.active_30d / r.users) * 100 : 0;
                return (
                  <span className={cn(pct >= 50 ? 'text-success' : pct >= 20 ? '' : 'text-warning')}>
                    {pct.toFixed(0)}%
                  </span>
                );
              },
            },
          ]}
        />
      </Panel>
    </>
  );
}

/* =============================================================== academic */

/** A people role → the label the content form uses for it. */
const ROLE_LABEL: Record<string, string> = {
  supervisor: 'supervisor', researcher: 'researchers', lead_researcher: 'lead_researcher',
  student: 'students', translator: 'translator',
};

function Empty() {
  const { t } = useTranslation();
  return <p className="py-10 text-center text-sm text-muted-foreground">{t('common.noResults')}</p>;
}

/**
 * Academic output — what the re-partitioned model makes countable.
 *
 * Before the per-type fields existed, "which university produces the most research" had no
 * column to be answered from. Every panel here reads a field the upload form now asks for:
 * institution, faculty and specialization, degree level, the year of the work, a paper's
 * type and peer-review status, a project's technologies, and the people by role.
 */
export function AcademicSection({ d }: { d: any }) {
  const { t } = useTranslation();
  const n = useN();
  if (!d) return null;

  const opt = (ns: string, v: string) =>
    t(`content.options.${ns}.${v}`, { defaultValue: String(v).replace(/_/g, ' ') });
  const series = [
    { key: 'research', label: t('library.type.research') },
    { key: 'papers', label: t('library.type.scientific_paper') },
    { key: 'projects', label: t('library.type.graduation_project') },
    { key: 'translations', label: t('library.type.translated_paper') },
  ];
  const peak = Math.max(1, ...(d.keywords ?? []).map((k: any) => k.count));
  const pctCell = (v: number, total: number) => {
    const p = total ? Math.round((v / total) * 100) : 0;
    return <span className={cn(p >= 80 ? 'text-success' : p >= 40 ? 'text-warning' : 'text-danger')}>{p}%</span>;
  };
  const ranked = (rows: any[] | undefined) => (rows?.length
    ? <RankedList items={rows.map((r: any) => ({ label: r.key, value: r.count }))} />
    : <Empty />);

  return (
    <>
      <div className="pt-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <GraduationCap className="h-5 w-5 text-muted-foreground" /> {t('reports.academic.title')}
        </h2>
        <p className="text-sm text-muted-foreground">{t('reports.academic.subtitle')}</p>
      </div>

      <Panel
        title={t('reports.academic.byInstitution')}
        description={t('reports.academic.byInstitutionHint')}
        actions={<ExportButton name="academic-by-institution" rows={d.byInstitution ?? []} />}
      >
        {d.byInstitution?.length ? (
          <>
            <CategoryBarChart xKey="key" data={d.byInstitution} series={series} height={300} stacked />
          </>
        ) : <Empty />}
      </Panel>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title={t('reports.academic.bySpecialization')}
          actions={<ExportButton name="academic-by-specialization" rows={d.bySpecialization ?? []} />}>
          {ranked(d.bySpecialization)}
        </Panel>
        <Panel title={t('reports.academic.byFaculty')}>{ranked(d.byFaculty)}</Panel>
        <Panel title={t('reports.academic.byDegree')} description={t('reports.academic.byDegreeHint')}>
          {d.byDegree?.length ? (
            <DonutChart data={d.byDegree.map((r: any) => ({ name: opt('degree_level', r.key), value: r.count }))} height={220} />
          ) : <Empty />}
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title={t('reports.academic.paperType')}>
          {d.paperType?.length ? (
            <DonutChart data={d.paperType.map((r: any) => ({ name: opt('paper_type', r.key), value: r.count }))} height={220} />
          ) : <Empty />}
        </Panel>
        <Panel title={t('reports.academic.reviewStatus')} description={t('reports.academic.reviewStatusHint')}>
          {d.reviewStatus?.length ? (
            <SegmentBar segments={d.reviewStatus.map((r: any) => ({ label: opt('review_status', r.key), value: r.count }))} />
          ) : <Empty />}
        </Panel>
        <Panel title={t('reports.academic.videoType')}>
          {d.videoType?.length ? (
            <DonutChart data={d.videoType.map((r: any) => ({ name: opt('video_type', r.key), value: r.count }))} height={220} />
          ) : <Empty />}
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={t('reports.academic.workYear')} description={t('reports.academic.workYearHint')}>
          {d.byWorkYear?.length ? (
            <CategoryBarChart xKey="year" data={d.byWorkYear} series={[{ key: 'count', label: t('common.count') }]} height={240} />
          ) : <Empty />}
        </Panel>
        <Panel title={t('reports.academic.keywords')} description={t('reports.academic.keywordsHint')}>
          {d.keywords?.length ? (
            // Each keyword links to the library filtered by it — the chart is also a way in.
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
              {d.keywords.map((k: any, i: number) => (
                <Link
                  key={k.key}
                  to={`/content?keyword=${encodeURIComponent(k.key)}`}
                  title={`${k.key}: ${k.count}`}
                  className="rounded-full px-2 py-0.5 font-medium transition-colors hover:bg-secondary"
                  style={{
                    fontSize: `${0.75 + (k.count / peak) * 0.8}rem`,
                    color: SERIES_COLORS[i % SERIES_COLORS.length],
                  }}
                >
                  {k.key}
                </Link>
              ))}
            </div>
          ) : <Empty />}
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title={t('reports.academic.projectField')}>{ranked(d.projectField)}</Panel>
        <Panel title={t('reports.academic.technologies')}>{ranked(d.technologies)}</Panel>
        <Panel title={t('reports.academic.tools')}>{ranked(d.tools)}</Panel>
      </div>

      <Panel
        title={t('reports.academic.people')}
        description={t('reports.academic.peopleHint')}
        actions={<ExportButton name="academic-people" rows={d.people ?? []} />}
      >
        <RankTable
          rows={d.people ?? []}
          columns={[
            { key: 'name', header: t('common.name') },
            { key: 'role', header: t('reports.academic.role'),
              render: (r) => t(`content.fields.${ROLE_LABEL[r.role] ?? r.role}`) },
            { key: 'items', header: t('common.count'), align: 'end', render: (r) => n(r.items) },
            { key: 'views', header: t('library.views'), align: 'end', render: (r) => n(r.views) },
          ]}
        />
      </Panel>

      <Panel title={t('reports.academic.completeness')} description={t('reports.academic.completenessHint')}>
        <RankTable
          rows={d.completeness ?? []}
          columns={[
            { key: 'key', header: t('common.type'), render: (r) => t(`library.type.${r.key}`) },
            { key: 'total', header: t('common.count'), align: 'end', render: (r) => n(r.total) },
            { key: 'institution', header: t('content.fields.institution'), align: 'end', render: (r) => pctCell(r.institution, r.total) },
            { key: 'specialization', header: t('content.fields.specialization'), align: 'end', render: (r) => pctCell(r.specialization, r.total) },
            { key: 'keywords', header: t('content.fields.keywords'), align: 'end', render: (r) => pctCell(r.keywords, r.total) },
            { key: 'dated', header: t('reports.academic.dated'), align: 'end', render: (r) => pctCell(r.dated, r.total) },
            { key: 'described', header: t('reports.academic.described'), align: 'end', render: (r) => pctCell(r.described, r.total) },
          ]}
        />
      </Panel>
    </>
  );
}

/* =================================================== scholarships & exams */

/**
 * The two catalogue types that live outside the library, analysed for what their new
 * fields make answerable: what awards cover and whom they can reach, and how complete the
 * past-paper archive is by sitting, institution and subject.
 */
export function ScholarshipExamSection({ s, e }: { s: any; e: any }) {
  const { t, i18n } = useTranslation();
  const n = useN();
  const lang = i18n.language;
  if (!s && !e) return null;

  const st = s?.totals ?? {};
  const reach = s?.reach;
  const reachPct = reach?.users_with_country
    ? Math.round((reach.eligible / reach.users_with_country) * 100) : null;
  const month = (m: string) => {
    const [y, mo] = m.split('-').map(Number);
    return new Intl.DateTimeFormat(lang, { month: 'short', year: '2-digit' }).format(new Date(y, mo - 1, 1));
  };
  const et = e?.totals ?? {};

  return (
    <>
      <div className="pt-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Award className="h-5 w-5 text-muted-foreground" /> {t('reports.scholarships.title')}
        </h2>
        <p className="text-sm text-muted-foreground">{t('reports.scholarships.subtitle')}</p>
      </div>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label={t('reports.scholarships.total')} value={n(st.total)} icon={Award} tone="emerald" />
        <StatCard label={t('reports.scholarships.openNow')} value={n(st.open_now)} tone="success" />
        <StatCard label={t('reports.scholarships.closing30d')} value={n(st.closing_30d)} tone={st.closing_30d ? 'warning' : 'ink'} />
        <StatCard label={t('reports.scholarships.fullyFunded')} value={n(st.fully_funded)} tone="violet" />
        <StatCard label={t('reports.scholarships.avgStipend')} value={st.avg_stipend ? n(st.avg_stipend) : '—'} tone="teal" />
        <StatCard
          label={t('reports.scholarships.reach')}
          value={reachPct == null ? '—' : `${reachPct}%`}
          hint={reach ? t('reports.scholarships.reachHint', { eligible: reach.eligible, total: reach.users_with_country }) : undefined}
          tone="sky"
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title={t('reports.scholarships.coverage')}>
          <CoverageBars
            total={Number(st.total ?? 0)}
            fields={['tuition', 'housing', 'insurance', 'flight', 'stipend']
              .map((k) => ({ key: k, count: Number(st[k] ?? 0) }))}
            labelFor={(k) => t(`scholarships.covers.${k}`)}
            hint={t('reports.scholarships.coverageHint')}
          />
        </Panel>
        <Panel title={t('learn.country')} actions={<ExportButton name="scholarships-by-country" rows={s?.byCountry ?? []} />}>
          <RankedList
            items={(s?.byCountry ?? []).map((r: any) => ({
              label: r.key === 'unknown' ? '—' : `${countryFlag(r.key)} ${countryName(r.key, lang)}`,
              value: r.count,
            }))}
          />
        </Panel>
        <Panel title={t('scholarships.level')}>
          <DonutChart
            data={(s?.byDegree ?? []).map((r: any) => ({ name: (r.key === 'unknown' ? t('users.demographics.notStated') : t(`scholarships.levels.${r.key}`, { defaultValue: r.key })), value: r.count }))}
            height={220}
          />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2" title={t('reports.scholarships.deadlines')} description={t('reports.scholarships.deadlinesHint')}>
          {s?.deadlines?.length ? (
            <CategoryBarChart
              xKey="label"
              data={s.deadlines.map((r: any) => ({ ...r, label: month(r.month) }))}
              series={[{ key: 'count', label: t('common.count') }]}
              height={240}
            />
          ) : <Empty />}
        </Panel>
        <Panel title={t('scholarships.fundingType')}>
          <DonutChart
            data={(s?.byFunding ?? []).map((r: any) => ({ name: (r.key === 'unknown' ? t('users.demographics.notStated') : t(`scholarships.funding.${r.key}`, { defaultValue: r.key })), value: r.count }))}
            height={220}
          />
        </Panel>
      </div>

      <div className="pt-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <FileCheck2 className="h-5 w-5 text-muted-foreground" /> {t('reports.exams.title')}
        </h2>
        <p className="text-sm text-muted-foreground">{t('reports.exams.subtitle')}</p>
      </div>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label={t('reports.exams.total')} value={n(et.total)} icon={FileCheck2} tone="sky" />
        <StatCard
          label={t('exams.withAnswers')}
          value={n(et.with_answers)}
          hint={et.total ? `${Math.round((et.with_answers / et.total) * 100)}%` : undefined}
          tone="success"
        />
        <StatCard label={t('insights.cards.subjects')} value={n(et.subjects)} tone="violet" />
        <StatCard label={t('reports.exams.institutions')} value={n(et.institutions)} tone="amber" />
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title={t('exams.stage')}>
          <DonutChart
            data={(e?.byStage ?? []).map((r: any) => ({ name: t(`exams.stages.${r.key}`, { defaultValue: r.key }), value: r.count }))}
            height={220}
          />
        </Panel>
        <Panel title={t('exams.sitting')}>
          {e?.bySitting?.length ? (
            <SegmentBar segments={e.bySitting.map((r: any) => ({ label: t(`exams.sittings.${r.key}`, { defaultValue: r.key }), value: r.count }))} />
          ) : <Empty />}
        </Panel>
        <Panel title={t('exams.type')}>
          <DonutChart
            data={(e?.byType ?? []).map((r: any) => ({ name: t(`exams.types.${r.key}`, { defaultValue: r.key }), value: r.count }))}
            height={220}
          />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title={t('learn.year')}>
          {e?.byYear?.length ? (
            <CategoryBarChart
              xKey="key"
              data={[...e.byYear].sort((a: any, b: any) => String(a.key).localeCompare(String(b.key)))}
              series={[{ key: 'count', label: t('common.count') }, { key: 'with_answers', label: t('exams.withAnswers') }]}
              height={220}
            />
          ) : <Empty />}
        </Panel>
        <Panel title={t('exams.institution')}>
          {e?.byInstitution?.length ? <RankedList items={e.byInstitution.map((r: any) => ({ label: r.key, value: r.count }))} /> : <Empty />}
        </Panel>
        <Panel title={t('exams.specialization')}>
          {e?.bySpecialization?.length ? <RankedList items={e.bySpecialization.map((r: any) => ({ label: r.key, value: r.count }))} /> : <Empty />}
        </Panel>
      </div>

      <Panel
        title={t('reports.exams.bySubject')}
        description={t('reports.exams.bySubjectHint')}
        actions={<ExportButton name="exams-by-subject" rows={e?.bySubject ?? []} />}
      >
        <RankTable
          rows={e?.bySubject ?? []}
          columns={[
            { key: 'key', header: t('exams.subjectName') },
            { key: 'count', header: t('common.count'), align: 'end', render: (r) => n(r.count) },
            {
              key: 'with_answers', header: t('exams.withAnswers'), align: 'end',
              render: (r) => `${n(r.with_answers)} (${r.count ? Math.round((r.with_answers / r.count) * 100) : 0}%)`,
            },
          ]}
        />
      </Panel>
    </>
  );
}
