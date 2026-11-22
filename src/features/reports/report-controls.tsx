import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { AreaChart, BarChart3, Layers, X } from 'lucide-react';
import { cn, toLocalDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge, Input } from '@/components/ui/primitives';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/overlays';

export type ChartKind = 'area' | 'bar' | 'stacked';

export interface ReportQuery {
  preset: string;
  from?: string;
  to?: string;
  groupBy: string;
  chart: ChartKind;
  filters: Record<string, string>;
}

export const PRESETS = [
  { key: '7d', days: 7 }, { key: '30d', days: 30 },
  { key: '90d', days: 90 }, { key: '365d', days: 365 },
];

/** Resolve the preset (or explicit dates) into the from/to the API expects. */
export function resolveRange(q: ReportQuery) {
  if (q.preset === 'custom' && q.from && q.to) return { from: q.from, to: q.to };
  const days = PRESETS.find((p) => p.key === q.preset)?.days ?? 90;
  const to = new Date();
  const from = new Date(to.getTime() - (days - 1) * 86_400_000);
  return { from: toLocalDate(from), to: toLocalDate(to) };
}

export interface FilterSpec {
  name: string;
  label: string;
  options: { value: string; label: string }[];
}

/**
 * The control strip every report shares: period, the dimension the main chart is split by,
 * the chart form, and a set of segment filters.
 *
 * Filters are declared per report rather than hardcoded here, so adding a new cut to a
 * report is a data change at the call site. Active filters are also shown as removable
 * chips — with five controls it is otherwise easy to forget a narrow segment is still on
 * and misread the numbers.
 */
export function ReportControls({
  query, onChange, dimensions, filters, dimensionLabels, allowNone = true,
  showDimension = true, showChart = true,
}: {
  query: ReportQuery;
  onChange: (next: Partial<ReportQuery>) => void;
  dimensions: string[];
  filters: FilterSpec[];
  dimensionLabels?: Record<string, string>;
  /** Some reports are always split by something; offering "no split" there would lie. */
  allowNone?: boolean;
  /** Analytical reports draw a fixed shape, so a split or a chart toggle has nothing to act
   *  on — but the period selector still governs them, which is why they keep this bar. */
  showDimension?: boolean;
  showChart?: boolean;
}) {
  const { t } = useTranslation();
  const active = Object.entries(query.filters).filter(([, v]) => v && v !== 'all');

  const label = (dim: string) =>
    dimensionLabels?.[dim] ?? t(`reports.dims.${dim}`, { defaultValue: dim });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={query.preset} onValueChange={(v) => onChange({ preset: v })}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            {PRESETS.map((p) => (
              <SelectItem key={p.key} value={p.key}>{t(`reports.range.${p.key}`)}</SelectItem>
            ))}
            <SelectItem value="custom">{t('reports.custom')}</SelectItem>
          </SelectContent>
        </Select>

        {query.preset === 'custom' ? (
          <>
            <Input type="date" dir="ltr" className="w-[10.5rem]" aria-label={t('reports.range.from')}
              value={query.from ?? ''} onChange={(e) => onChange({ from: e.target.value })} />
            <Input type="date" dir="ltr" className="w-[10.5rem]" aria-label={t('reports.range.to')}
              value={query.to ?? ''} onChange={(e) => onChange({ to: e.target.value })} />
          </>
        ) : null}

        {showDimension ? (
        <Select value={query.groupBy} onValueChange={(v) => onChange({ groupBy: v })}>
          <SelectTrigger className="w-48">
            <span className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-muted-foreground" />
              <SelectValue />
            </span>
          </SelectTrigger>
          <SelectContent>
            {allowNone ? <SelectItem value="none">{t('reports.none')}</SelectItem> : null}
            {dimensions.map((d) => <SelectItem key={d} value={d}>{label(d)}</SelectItem>)}
          </SelectContent>
        </Select>
        ) : null}

        {/* Chart form is a view choice, so it is a segmented control rather than a dropdown. */}
        {showChart ? (
        <div className="flex items-center gap-0.5 rounded-full bg-secondary p-1">
          {([
            { key: 'area', icon: AreaChart },
            { key: 'bar', icon: BarChart3 },
            { key: 'stacked', icon: Layers },
          ] as const).map((opt) => (
            <button
              key={opt.key}
              onClick={() => onChange({ chart: opt.key })}
              aria-pressed={query.chart === opt.key}
              aria-label={t(`reports.${opt.key}`)}
              title={t(`reports.${opt.key}`)}
              className={cn(
                'grid h-8 w-8 place-items-center rounded-full transition-colors',
                query.chart === opt.key
                  ? 'bg-card text-foreground shadow-soft'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <opt.icon className="h-4 w-4" />
            </button>
          ))}
        </div>
        ) : null}

        {filters.map((f) => (
          <Select
            key={f.name}
            value={query.filters[f.name] ?? 'all'}
            onValueChange={(v) => onChange({ filters: { ...query.filters, [f.name]: v } })}
          >
            <SelectTrigger className="w-auto min-w-[9rem]"><SelectValue placeholder={f.label} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{f.label}</SelectItem>
              {f.options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        ))}
      </div>

      {active.length ? (
        <div className="flex flex-wrap items-center gap-2">
          {active.map(([name, value]) => {
            const spec = filters.find((f) => f.name === name);
            const shown = spec?.options.find((o) => o.value === value)?.label ?? value;
            return (
              <Badge key={name} variant="secondary" className="gap-1.5 py-1 ps-2.5">
                <span className="text-muted-foreground">{spec?.label ?? name}:</span> {shown}
                <button
                  onClick={() => {
                    const next = { ...query.filters };
                    delete next[name];
                    onChange({ filters: next });
                  }}
                  aria-label={t('actions.remove')}
                  className="rounded-full p-0.5 hover:bg-foreground/10"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}
          <Button variant="ghost" size="sm" onClick={() => onChange({ filters: {} })}>
            {t('reports.clear')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Pivot the API's long-format timeline ([{day, key, count}]) into the wide rows a chart
 * wants, plus the ordered series list. Long format keeps the SQL free of dynamic columns;
 * the reshaping is trivial here and the series set is whatever the data actually contained.
 */
export function pivotTimeline(rows: { day: string; key: string; count: number }[]) {
  const series: string[] = [];
  const byDay = new Map<string, Record<string, any>>();
  for (const row of rows) {
    if (!series.includes(row.key)) series.push(row.key);
    const entry = byDay.get(row.day) ?? { day: row.day };
    entry[row.key] = row.count;
    byDay.set(row.day, entry);
  }
  return { data: [...byDay.values()], series };
}
