import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  AreaChart, BarChart3, Compass, Grid2x2, Layers, PieChart, Radar, Table2,
} from 'lucide-react';
import { api } from '@/lib/api';
import { cn, formatDate, formatNumber } from '@/lib/utils';
import { downloadCsv, toCsv } from '@/lib/csv';
import { Button } from '@/components/ui/button';
import { Panel, StatCard } from '@/components/data/page-parts';
import { Skeleton } from '@/components/ui/primitives';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/overlays';
import { CategoryBarChart, DonutChart, SERIES_COLORS, TrendChart } from '@/components/data/charts';
import { RankTable } from '@/components/data/report-charts';
import { RadarProfile, ShareArea, Treemap } from '@/components/data/analytic-charts';

/**
 * The ad-hoc query builder.
 *
 * The whole point of this screen is that it is not a fixed report: pick a dataset, a
 * measure, what to break it down by, and how to draw it. The option lists come from the
 * API's own `explore/schema`, not from a table in this file — the server owns which
 * combinations are legal, and a metric added there shows up here without a client change.
 *
 * Chart forms are filtered by mode rather than by data: a donut of a time series is a
 * category error, and offering it and then rendering something misleading is worse than
 * not offering it.
 */

type Mode = 'timeline' | 'category';
type Chart = 'area' | 'bar' | 'stacked' | 'share' | 'donut' | 'treemap' | 'radar' | 'table';

const CHART_ICONS: Record<Chart, typeof AreaChart> = {
  area: AreaChart, bar: BarChart3, stacked: Layers, share: Layers,
  donut: PieChart, treemap: Grid2x2, radar: Radar, table: Table2,
};

const CHARTS_FOR: Record<Mode, Chart[]> = {
  timeline: ['area', 'bar', 'stacked', 'share', 'table'],
  category: ['bar', 'stacked', 'donut', 'treemap', 'radar', 'table'],
};

export interface ExploreState {
  dataset: string;
  metric: string;
  dimension: string;
  split: string;
  mode: Mode;
  chart: Chart;
}

export const DEFAULT_EXPLORE: ExploreState = {
  dataset: 'content', metric: 'count', dimension: 'type', split: 'none',
  mode: 'timeline', chart: 'area',
};

export function ExplorePanel({ range }: { range: { from: string; to: string } }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [state, setState] = React.useState<ExploreState>(DEFAULT_EXPLORE);

  const { data: schema } = useQuery({
    queryKey: ['explore-schema'],
    queryFn: () => api.get('/reports/explore/schema'),
    staleTime: 30 * 60_000,
  });

  const dataset = React.useMemo(
    () => (schema?.datasets ?? []).find((d: any) => d.key === state.dataset),
    [schema, state.dataset],
  );

  /**
   * Keep the selection legal for the chosen dataset.
   *
   * Derived rather than corrected in an effect: an effect lands a render *after* the
   * dataset changes, and in that gap a request goes out pairing the new dataset with the
   * old dataset's metric, which the API rightly rejects with a 400.
   */
  const metric = dataset && !dataset.metrics.includes(state.metric) ? dataset.defaultMetric : state.metric;
  const dimension = dataset && state.dimension !== 'none' && !dataset.dimensions.includes(state.dimension)
    ? dataset.defaultDimension : state.dimension;
  const split = dataset && state.split !== 'none' && !dataset.dimensions.includes(state.split)
    ? 'none' : state.split;
  const chart = CHARTS_FOR[state.mode].includes(state.chart) ? state.chart : CHARTS_FOR[state.mode][0];

  const params = { ...range, dataset: state.dataset, metric, dimension, split, mode: state.mode };
  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ['explore', params],
    queryFn: () => api.get('/reports/explore', params),
    placeholderData: (prev) => prev,
  });

  const update = (next: Partial<ExploreState>) => setState((s) => ({ ...s, ...next }));

  const label = (kind: string, key: string) =>
    t(`reports.explore.${kind}.${key}`, { defaultValue: String(key).replace(/_/g, ' ') });
  const valueLabel = (key: string) =>
    t(`library.type.${key}`, {
      defaultValue: t(`library.status.${key}`, {
        defaultValue: t(`reports.behaviour.kind.${key}`, {
          defaultValue: key === 'ar' ? 'العربية' : key === 'en' ? 'English'
            : key === 'other' ? t('reports.explore.other') : String(key).replace(/_/g, ' '),
        }),
      }),
    });

  /*
   * Long rows → the wide shape a cartesian chart wants.
   *
   * Missing combinations are filled with zero rather than left undefined. The API returns
   * only the rows that exist, and Recharts breaks a line wherever its key is absent — so a
   * series that simply had nothing on a Tuesday came back as a hole in the line, which
   * reads as missing data instead of as none.
   */
  const wide = React.useMemo(() => {
    const rows = data?.rows ?? [];
    const keys: string[] = data?.series ?? [];
    if (state.mode === 'timeline') {
      const byDay = new Map<string, any>();
      for (const r of rows) {
        const entry = byDay.get(r.day) ?? { day: r.day };
        entry[r.key] = Number(r.value ?? 0);
        byDay.set(r.day, entry);
      }
      return [...byDay.values()]
        .sort((a, b) => a.day.localeCompare(b.day))
        .map((r) => ({
          ...Object.fromEntries(keys.map((k) => [k, 0])),
          ...r,
          day: formatDate(r.day, lang).replace(/\s\d{4}$/, ''),
        }));
    }
    const byKey = new Map<string, any>();
    for (const r of rows) {
      const entry = byKey.get(r.key) ?? { key: valueLabel(r.key), __key: r.key };
      entry[r.series] = Number(r.value ?? 0);
      byKey.set(r.key, entry);
    }
    return [...byKey.values()].map((r) => ({
      ...Object.fromEntries(keys.map((k) => [k, 0])),
      ...r,
    }));
  }, [data, state.mode, lang, t]);

  const series = React.useMemo(() => {
    const keys = state.mode === 'timeline' ? (data?.series ?? []) : (data?.series ?? []);
    return keys.map((k: string) => ({ key: k, label: valueLabel(k) }));
  }, [data, state.mode, t]);

  const total = React.useMemo(
    () => (data?.rows ?? []).reduce((s: number, r: any) => s + Number(r.value ?? 0), 0),
    [data],
  );

  const csvRows = React.useMemo(
    () => (data?.rows ?? []).map((r: any) => ({
      ...(state.mode === 'timeline' ? { date: r.day } : {}),
      dimension: valueLabel(String(state.mode === 'timeline' ? r.key : r.key)),
      ...(state.mode === 'category' ? { series: valueLabel(String(r.series)) } : {}),
      value: r.value,
    })),
    [data, state.mode, t],
  );

  return (
    <>
      <Panel
        title={t('reports.explore.builder')}
        description={t('reports.explore.builderHint')}
        actions={
          <Button
            variant="ghost" size="sm" disabled={!csvRows.length}
            onClick={() => downloadCsv(`explore-${state.dataset}-${metric}`, toCsv(csvRows))}
          >
            CSV
          </Button>
        }
      >
        <div className="flex flex-wrap items-end gap-3">
          <Field label={t('reports.explore.datasetLabel')}>
            <Select value={state.dataset} onValueChange={(v) => update({ dataset: v })}>
              <SelectTrigger className="w-[11rem]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(schema?.datasets ?? []).map((d: any) => (
                  <SelectItem key={d.key} value={d.key}>{label('dataset', d.key)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label={t('reports.explore.measure')}>
            <Select value={metric} onValueChange={(v) => update({ metric: v })}>
              <SelectTrigger className="w-[11rem]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(dataset?.metrics ?? []).map((m: string) => (
                  <SelectItem key={m} value={m}>{label('metric', m)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label={t('reports.explore.breakdown')}>
            <Select value={dimension} onValueChange={(v) => update({ dimension: v })}>
              <SelectTrigger className="w-[11rem]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t('reports.none')}</SelectItem>
                {(dataset?.dimensions ?? []).map((m: string) => (
                  <SelectItem key={m} value={m}>{label('dimension', m)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {state.mode === 'category' ? (
            <Field label={t('reports.explore.split')}>
              <Select value={split} onValueChange={(v) => update({ split: v })}>
                <SelectTrigger className="w-[11rem]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('reports.none')}</SelectItem>
                  {(dataset?.dimensions ?? []).filter((m: string) => m !== dimension).map((m: string) => (
                    <SelectItem key={m} value={m}>{label('dimension', m)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : null}

          <Field label={t('reports.explore.view')}>
            <div className="flex items-center gap-0.5 rounded-full bg-secondary p-1">
              {(['timeline', 'category'] as Mode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => update({ mode: m })}
                  aria-pressed={state.mode === m}
                  className={cn(
                    'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                    state.mode === m ? 'bg-card text-foreground shadow-soft' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {t(`reports.explore.mode.${m}`)}
                </button>
              ))}
            </div>
          </Field>

          <Field label={t('reports.chartType')}>
            <div className="flex items-center gap-0.5 rounded-full bg-secondary p-1">
              {CHARTS_FOR[state.mode].map((c) => {
                const Icon = CHART_ICONS[c];
                return (
                  <button
                    key={c}
                    onClick={() => update({ chart: c })}
                    aria-pressed={chart === c}
                    aria-label={t(`reports.explore.chart.${c}`)}
                    title={t(`reports.explore.chart.${c}`)}
                    className={cn(
                      'grid h-8 w-8 place-items-center rounded-full transition-colors',
                      chart === c ? 'bg-card text-foreground shadow-soft' : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                );
              })}
            </div>
          </Field>
        </div>
      </Panel>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          label={t('reports.explore.total')}
          value={formatNumber(Math.round(total), lang)}
          icon={Compass}
          tone="indigo"
          hint={label('metric', metric)}
        />
        <StatCard label={t('reports.explore.series')} value={String(data?.series?.length ?? 0)} tone="violet" />
        <StatCard label={t('reports.explore.points')} value={String(data?.rows?.length ?? 0)} tone="sky" />
        <StatCard
          label={t('reports.range.label')}
          value={`${data?.range?.days ?? 0}`}
          hint={lang === 'ar' ? 'يوماً' : 'days'}
          tone="teal"
        />
      </section>

      <Panel
        title={`${label('metric', metric)} · ${label('dataset', state.dataset)}`}
        description={
          dimension === 'none'
            ? undefined
            : `${t('reports.groupBy')}: ${label('dimension', dimension)}${
                state.mode === 'category' && split !== 'none' ? ` × ${label('dimension', split)}` : ''}`
        }
      >
        {isLoading ? (
          <Skeleton className="h-72 rounded-2xl" />
        ) : error ? (
          <p className="py-12 text-center text-sm text-danger">{(error as any)?.message ?? t('common.error')}</p>
        ) : !wide.length ? (
          <p className="py-12 text-center text-sm text-muted-foreground">{t('common.noResults')}</p>
        ) : (
          <div className={cn(isFetching && 'opacity-60 transition-opacity')}>
            <ExploreChart
              chart={chart} mode={state.mode} wide={wide} series={series}
              rows={data?.rows ?? []} valueLabel={valueLabel}
              metricLabel={label('metric', metric)}
            />
          </div>
        )}
      </Panel>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function ExploreChart({
  chart, mode, wide, series, rows, valueLabel, metricLabel,
}: {
  chart: Chart; mode: Mode; wide: any[];
  series: { key: string; label: string }[];
  rows: any[];
  valueLabel: (k: string) => string;
  metricLabel: string;
}) {
  const { t, i18n } = useTranslation();
  const xKey = mode === 'timeline' ? 'day' : 'key';

  if (chart === 'table') {
    return (
      <RankTable
        rows={wide}
        columns={[
          { key: xKey, header: mode === 'timeline' ? t('common.date') : t('reports.dimension') },
          ...series.map((s) => ({
            key: s.key, header: s.label, align: 'end' as const,
            render: (r: any) => formatNumber(r[s.key] ?? 0, i18n.language),
          })),
        ]}
      />
    );
  }

  if (chart === 'share') {
    return (
      <ShareArea
        rows={rows.map((r: any) => ({ day: r.day, key: r.key, count: Number(r.value ?? 0) }))}
        series={series.map((s) => s.key)}
        labelFor={valueLabel}
        height={320}
      />
    );
  }

  if (chart === 'donut') {
    return (
      <DonutChart
        data={wide.map((r) => ({
          name: r.key,
          value: series.reduce((sum, s) => sum + Number(r[s.key] ?? 0), 0),
        }))}
        height={320}
      />
    );
  }

  if (chart === 'treemap') {
    return (
      <Treemap
        data={wide.map((r) => ({
          name: r.key,
          size: series.reduce((sum, s) => sum + Number(r[s.key] ?? 0), 0),
        }))}
        height={340}
      />
    );
  }

  if (chart === 'radar') {
    // Transposed: each dimension value becomes an axis, each series a shape.
    return (
      <RadarProfile
        segments={series.map((s) => ({
          key: s.label,
          ...Object.fromEntries(wide.map((r) => [r.__key ?? r.key, Number(r[s.key] ?? 0)])),
        }))}
        metrics={wide.map((r) => r.__key ?? r.key)}
        metricLabelFor={valueLabel}
        height={360}
      />
    );
  }

  const spec = series.length ? series : [{ key: 'value', label: metricLabel }];
  return (
    <div>
      {chart === 'area' ? (
        <TrendChart data={wide} series={spec} xKey={xKey} height={340} />
      ) : (
        <CategoryBarChart
          xKey={xKey} data={wide} series={spec} height={340} stacked={chart === 'stacked'}
        />
      )}
      {/* Five unlabelled lines are decoration; the legend is what makes them a chart. */}
      {spec.length > 1 ? (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {spec.map((s, i) => (
            <span key={s.key} className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full"
                style={{ background: SERIES_COLORS[i % SERIES_COLORS.length] }} />
              {s.label}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
