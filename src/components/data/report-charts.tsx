import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { cn, formatNumber } from '@/lib/utils';
import { SERIES_COLORS } from './charts';

/**
 * Chart forms the reporting screens need that the general chart set does not cover.
 * Each is deliberately plain SVG/CSS rather than a charting library: they are small, fixed
 * shapes, and hand-drawing them keeps them theme-aware and RTL-correct without fighting a
 * library's own layout engine.
 */

/** Weekday × hour density. Reads when an audience actually shows up. */
export function ActivityHeatmap({
  data, title,
}: { data: { weekday: number; hour: number; count: number }[]; title?: string }) {
  const { t, i18n } = useTranslation();
  const grid = React.useMemo(() => {
    const cells = new Map<string, number>();
    for (const d of data) cells.set(`${d.weekday}-${d.hour}`, d.count);
    return cells;
  }, [data]);
  const max = Math.max(1, ...data.map((d) => d.count));

  const days = i18n.language === 'ar'
    ? ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
    : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    // Hours run left-to-right in both languages — a clock is not mirrored.
    <div dir="ltr" className="overflow-x-auto">
      {title ? <p className="mb-2 text-xs text-muted-foreground">{title}</p> : null}
      <div className="min-w-[34rem]">
        <div className="flex">
          <div className="w-10 shrink-0" />
          {Array.from({ length: 24 }, (_, h) => (
            <div key={h} className="numeric flex-1 text-center text-[9px] text-muted-foreground">
              {h % 3 === 0 ? h : ''}
            </div>
          ))}
        </div>
        {days.map((label, wd) => (
          <div key={wd} className="flex items-center">
            <div className="w-10 shrink-0 truncate pe-1 text-[10px] text-muted-foreground">{label}</div>
            {Array.from({ length: 24 }, (_, h) => {
              const value = grid.get(`${wd}-${h}`) ?? 0;
              const intensity = value === 0 ? 0 : 0.15 + (value / max) * 0.85;
              return (
                <div key={h} className="flex-1 p-[1px]">
                  <div
                    title={`${label} ${h}:00 — ${formatNumber(value, i18n.language)}`}
                    className={cn('aspect-square w-full rounded-[3px]', value === 0 && 'bg-muted')}
                    style={value ? { backgroundColor: `hsl(var(--accent) / ${intensity})` } : undefined}
                  />
                </div>
              );
            })}
          </div>
        ))}
        <div className="mt-2 flex items-center justify-end gap-1.5 text-[10px] text-muted-foreground">
          <span>{t('reports.less')}</span>
          {[0.15, 0.4, 0.65, 1].map((o) => (
            <span key={o} className="h-3 w-3 rounded-[3px]" style={{ backgroundColor: `hsl(var(--accent) / ${o})` }} />
          ))}
          <span>{t('reports.more')}</span>
        </div>
      </div>
    </div>
  );
}

/** Stage-by-stage drop-off, with each stage shown as a share of the first. */
export function Funnel({ stages }: { stages: { label: string; value: number }[] }) {
  const { i18n } = useTranslation();
  const top = Math.max(1, stages[0]?.value ?? 1);
  return (
    <ol className="space-y-3">
      {stages.map((stage, i) => {
        const pct = (stage.value / top) * 100;
        const prev = i > 0 ? stages[i - 1].value : stage.value;
        const step = prev > 0 ? (stage.value / prev) * 100 : 0;
        return (
          <li key={stage.label}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate">{stage.label}</span>
              <span className="numeric shrink-0 font-medium">
                {formatNumber(stage.value, i18n.language)}
                {i > 0 ? (
                  <span className={cn('ms-2 text-xs', step >= 80 ? 'text-success' : step >= 50 ? 'text-warning' : 'text-danger')}>
                    {step.toFixed(0)}%
                  </span>
                ) : null}
              </span>
            </div>
            <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{ width: `${Math.max(pct, 2)}%`, background: SERIES_COLORS[i % SERIES_COLORS.length] }}
              />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * A single proportion split into labelled segments — compact alternative to a pie.
 *
 * `total` is the size of the population being described, which is not always the sum of the
 * segments: a "top 6 towns" cut covers a fraction of the accounts, and dividing by the six
 * shown values turns "19% of all users are in El Obeid" into a number about the six towns
 * instead. When a total is given and the segments fall short, the difference is drawn as an
 * explicit remainder rather than quietly rescaling the rest to fill the bar.
 */
export function SegmentBar({
  segments, total: population, restLabel,
}: {
  segments: { label: string; value: number; color?: string }[];
  total?: number;
  restLabel?: string;
}) {
  const { t, i18n } = useTranslation();
  const shown = segments.reduce((sum, s) => sum + s.value, 0);
  const total = Math.max(population ?? shown, shown) || 1;
  const rest = total - shown;
  const pct = (v: number) => ((v / total) * 100);

  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
        {segments.map((s, i) => (
          <div
            key={s.label}
            title={`${s.label}: ${s.value}`}
            style={{ width: `${pct(s.value)}%`, background: s.color ?? SERIES_COLORS[i % SERIES_COLORS.length] }}
          />
        ))}
      </div>
      <ul className="mt-3 space-y-1.5">
        {segments.map((s, i) => (
          <li key={s.label} className="flex items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: s.color ?? SERIES_COLORS[i % SERIES_COLORS.length] }} />
            <span className="truncate text-muted-foreground">{s.label}</span>
            <span className="numeric ms-auto font-medium">
              {formatNumber(s.value, i18n.language)}
              <span className="ms-1.5 text-xs text-muted-foreground">{pct(s.value).toFixed(0)}%</span>
            </span>
          </li>
        ))}
        {rest > 0 ? (
          <li className="flex items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-muted" />
            <span className="truncate text-muted-foreground">{restLabel ?? t('insights.otherOrNone')}</span>
            <span className="numeric ms-auto text-muted-foreground">
              {formatNumber(rest, i18n.language)}
              <span className="ms-1.5 text-xs">{pct(rest).toFixed(0)}%</span>
            </span>
          </li>
        ) : null}
      </ul>
    </div>
  );
}

/** Compact table for the "top N" panels every report ends with. */
export function RankTable({
  columns, rows, empty,
}: {
  columns: { key: string; header: string; align?: 'start' | 'end'; render?: (row: any) => React.ReactNode }[];
  rows: any[];
  empty?: string;
}) {
  const { t } = useTranslation();
  if (!rows.length) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{empty ?? t('common.noResults')}</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
            <th className="w-8 py-2 text-start font-semibold">#</th>
            {columns.map((c) => (
              <th key={c.key} className={cn('py-2 font-semibold', c.align === 'end' ? 'text-end' : 'text-start')}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.id ?? i} className="border-b last:border-0">
              <td className="numeric py-2 text-muted-foreground">{i + 1}</td>
              {columns.map((c) => (
                <td key={c.key} className={cn('py-2', c.align === 'end' ? 'numeric text-end' : 'max-w-[18rem] truncate')}>
                  {c.render ? c.render(row) : row[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
