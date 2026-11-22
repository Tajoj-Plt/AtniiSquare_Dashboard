import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
  CartesianGrid, ComposedChart, Bar, Line, PolarAngleAxis, PolarGrid, PolarRadiusAxis,
  Radar, RadarChart as ReRadarChart, ResponsiveContainer, Scatter, ScatterChart,
  Tooltip, Treemap as ReTreemap, XAxis, YAxis, ZAxis,
} from 'recharts';
import { cn, formatNumber } from '@/lib/utils';
import { SERIES_COLORS } from './charts';

/**
 * The analytical chart set: relationship, distribution and comparison forms.
 *
 * These answer a different question from the trend charts next door. A line says how much;
 * these say what shape, what relates to what, and how two things stack up. That difference
 * drives the implementation choice too — anything with a conventional cartesian frame goes
 * through Recharts, while the fixed-geometry forms (a box plot, a correlation grid, a
 * cohort triangle) are hand-drawn, because bending a charting library into those shapes
 * costs more code than drawing them and loses RTL and theme correctness on the way.
 *
 * Everything here reads colour from the shared `SERIES_COLORS` palette or from CSS tokens,
 * so a dimension keeps its colour across the whole dashboard and dark mode needs no
 * special casing.
 */

const axisProps = {
  stroke: 'hsl(var(--muted-foreground))',
  fontSize: 11,
  tickLine: false,
  axisLine: false,
};

/** Shared surface for every hand-drawn tooltip and Recharts override. */
function TipShell({ title, rows }: { title?: React.ReactNode; rows: [string, React.ReactNode][] }) {
  return (
    <div className="pointer-events-none rounded-lg border bg-popover px-3 py-2 text-xs shadow-raised">
      {title ? <p className="mb-1 max-w-[16rem] truncate font-medium text-popover-foreground">{title}</p> : null}
      {rows.map(([label, value]) => (
        <p key={label} className="flex items-center gap-3 text-muted-foreground">
          <span>{label}</span>
          <span className="numeric ms-auto font-medium text-popover-foreground">{value}</span>
        </p>
      ))}
    </div>
  );
}

export function useNum() {
  const { i18n } = useTranslation();
  return React.useCallback((v: any) => formatNumber(Number(v ?? 0), i18n.language), [i18n.language]);
}

/* ==========================================================  relationship */

export interface Point {
  id?: string; title?: string; series?: string;
  x: number | string; y: number | string; size?: number | string;
}

/**
 * Scatter of individual records, with the least-squares fit drawn through them.
 *
 * The regression line and Pearson's r are computed here rather than asked of the server:
 * the points are already on the client, r over a few hundred of them is free, and keeping
 * it local means the line always describes exactly the points being displayed — including
 * after the series legend is used to hide one.
 */
export function ScatterPlot({
  points, xLabel, yLabel, height = 320, showFit = true, logY = false, seriesLabel,
}: {
  points: Point[];
  xLabel: string; yLabel: string;
  height?: number; showFit?: boolean; logY?: boolean;
  /** Series keys arrive as raw column values; this turns them into the reader's language. */
  seriesLabel?: (key: string) => string;
}) {
  const { t } = useTranslation();
  const n = useNum();
  const data = React.useMemo(
    () => points.map((p) => ({ ...p, x: Number(p.x), y: Number(p.y), size: Number(p.size ?? 1) })),
    [points],
  );
  const groups = React.useMemo(() => {
    const map = new Map<string, typeof data>();
    for (const p of data) {
      const key = p.series ?? 'all';
      map.set(key, [...(map.get(key) ?? []), p]);
    }
    return [...map.entries()];
  }, [data]);

  const fit = React.useMemo(() => {
    if (!showFit || data.length < 3) return null;
    const N = data.length;
    const sx = data.reduce((s, p) => s + p.x, 0);
    const sy = data.reduce((s, p) => s + p.y, 0);
    const sxy = data.reduce((s, p) => s + p.x * p.y, 0);
    const sxx = data.reduce((s, p) => s + p.x * p.x, 0);
    const syy = data.reduce((s, p) => s + p.y * p.y, 0);
    const denom = N * sxx - sx * sx;
    if (!denom) return null;
    const slope = (N * sxy - sx * sy) / denom;
    const intercept = (sy - slope * sx) / N;
    const rDenom = Math.sqrt(denom * (N * syy - sy * sy));
    const r = rDenom ? (N * sxy - sx * sy) / rDenom : 0;
    const xs = data.map((p) => p.x);
    const lo = Math.min(...xs);
    const hi = Math.max(...xs);
    return {
      r,
      line: [
        { x: lo, y: slope * lo + intercept },
        { x: hi, y: slope * hi + intercept },
      ],
    };
  }, [data, showFit]);

  if (!data.length) {
    return <p className="py-12 text-center text-sm text-muted-foreground">{t('common.noResults')}</p>;
  }

  return (
    <div>
      {/* Numeric axes are not mirrored in Arabic — a scatter's origin stays bottom-left. */}
      <div dir="ltr">
        <ResponsiveContainer width="100%" height={height}>
          <ScatterChart margin={{ top: 10, right: 16, bottom: 24, left: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              type="number" dataKey="x" name={xLabel} {...axisProps}
              label={{ value: xLabel, position: 'insideBottom', offset: -14, fontSize: 11,
                       fill: 'hsl(var(--muted-foreground))' }}
            />
            <YAxis
              type="number" dataKey="y" name={yLabel} width={44} {...axisProps}
              scale={logY ? 'sqrt' : 'auto'}
            />
            <ZAxis type="number" dataKey="size" range={[24, 320]} />
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              content={({ payload }: any) => {
                const p = payload?.[0]?.payload;
                if (!p) return null;
                return (
                  <TipShell
                    title={p.title}
                    rows={[
                      [xLabel, n(p.x)],
                      [yLabel, n(p.y)],
                      ...(p.size > 1 ? ([[t('reports.charts.size'), n(p.size)]] as [string, React.ReactNode][]) : []),
                    ]}
                  />
                );
              }}
            />
            {groups.map(([key, rows], i) => (
              <Scatter
                key={key} name={seriesLabel?.(key) ?? key} data={rows}
                fill={SERIES_COLORS[i % SERIES_COLORS.length]} fillOpacity={0.6}
              />
            ))}
            {fit ? (
              <Scatter
                data={fit.line} line={{ stroke: 'hsl(var(--foreground))', strokeWidth: 1.5, strokeDasharray: '5 4' }}
                shape={() => <g />} legendType="none" isAnimationActive={false}
              />
            ) : null}
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        {groups.length > 1
          ? groups.map(([key], i) => (
              <span key={key} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full"
                  style={{ background: SERIES_COLORS[i % SERIES_COLORS.length] }} />
                {seriesLabel?.(key) ?? key}
              </span>
            ))
          : null}
        {fit ? (
          <span className="numeric ms-auto" title={t('reports.charts.rHint')}>
            r = {fit.r.toFixed(2)} · {t(strengthKey(fit.r))}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/** Conventional wording for a correlation's strength, so the number is never read alone. */
function strengthKey(r: number) {
  const a = Math.abs(r);
  if (a >= 0.7) return 'reports.charts.strong';
  if (a >= 0.4) return 'reports.charts.moderate';
  if (a >= 0.2) return 'reports.charts.weak';
  return 'reports.charts.none';
}

/**
 * Correlation matrix.
 *
 * Diverging colour, because the sign matters as much as the magnitude: negative reads red,
 * positive reads blue, and a null — a pair with no variance to correlate — is drawn as an
 * explicit dash rather than a neutral zero, which would be a different claim entirely.
 */
export function CorrelationMatrix({
  metrics, matrix, labelFor,
}: {
  metrics: string[];
  matrix: (number | null)[][];
  labelFor?: (key: string) => string;
}) {
  const { t } = useTranslation();
  const label = (k: string) => labelFor?.(k) ?? k;
  const cellColor = (r: number | null) => {
    if (r === null) return undefined;
    const a = Math.min(1, Math.abs(r));
    return r >= 0
      ? `hsl(217 91% 55% / ${0.08 + a * 0.85})`
      : `hsl(0 72% 55% / ${0.08 + a * 0.85})`;
  };

  return (
    <div dir="ltr" className="overflow-x-auto">
      <table className="w-full min-w-[34rem] border-separate border-spacing-[2px] text-[11px]">
        <thead>
          <tr>
            <th />
            {/* Vertical headers via writing-mode rather than a rotate: a rotated inline span
                keeps its unrotated box, so the row collapsed to nothing and the labels were
                clipped away entirely. Writing-mode reserves the right box for the glyphs. */}
            {metrics.map((m) => (
              <th key={m} className="h-24 pb-1 align-bottom font-medium text-muted-foreground">
                <span
                  className="mx-auto block whitespace-nowrap"
                  style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                >
                  {label(m)}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {metrics.map((row, i) => (
            <tr key={row}>
              <th className="whitespace-nowrap pe-2 text-end font-medium text-muted-foreground">{label(row)}</th>
              {metrics.map((col, j) => {
                const r = matrix[i]?.[j] ?? null;
                return (
                  <td
                    key={col}
                    title={`${label(row)} × ${label(col)}: ${r === null ? '—' : r.toFixed(3)}`}
                    className={cn(
                      'numeric h-8 rounded text-center tabular-nums',
                      r !== null && Math.abs(r) > 0.55 ? 'font-semibold text-white' : 'text-foreground',
                      r === null && 'bg-muted text-muted-foreground',
                    )}
                    style={{ backgroundColor: cellColor(r) }}
                  >
                    {r === null ? '—' : r.toFixed(2)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 flex items-center gap-2 text-[10px] text-muted-foreground">
        <span>−1</span>
        <span className="h-2 flex-1 rounded-full"
          style={{ background: 'linear-gradient(to right, hsl(0 72% 55%), hsl(var(--muted)), hsl(217 91% 55%))' }} />
        <span>+1</span>
        <span className="ms-2">{t('reports.charts.corrLegend')}</span>
      </p>
    </div>
  );
}

/** Any row × column count grid, shaded by value. Used for interest × type. */
export function MatrixHeatmap({
  rows, columns, cells, labelForColumn,
}: {
  rows: string[]; columns: string[];
  cells: Map<string, number>;
  labelForColumn?: (key: string) => string;
}) {
  const { t } = useTranslation();
  const n = useNum();
  const max = Math.max(1, ...[...cells.values()]);
  if (!rows.length) {
    return <p className="py-10 text-center text-sm text-muted-foreground">{t('common.noResults')}</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[30rem] border-separate border-spacing-[2px] text-xs">
        <thead>
          <tr>
            <th />
            {columns.map((c) => (
              <th key={c} className="pb-1 text-center font-medium text-muted-foreground">
                {labelForColumn?.(c) ?? c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r}>
              <th className="max-w-[10rem] truncate pe-2 text-start font-medium">{r}</th>
              {columns.map((c) => {
                const v = cells.get(`${r}||${c}`) ?? 0;
                return (
                  <td
                    key={c}
                    title={`${r} × ${labelForColumn?.(c) ?? c}: ${n(v)}`}
                    className={cn('numeric h-8 rounded text-center', v === 0 && 'bg-muted text-muted-foreground')}
                    style={v ? {
                      backgroundColor: `hsl(var(--accent) / ${0.15 + (v / max) * 0.85})`,
                      color: v / max > 0.55 ? 'white' : undefined,
                    } : undefined}
                  >
                    {v || '·'}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ==========================================================  distribution */

/**
 * Histogram with mean and median marked.
 *
 * Both markers, always: on the long-tailed metrics this dashboard deals in they can sit
 * far apart, and that gap *is* the finding — a mean well right of the median is what a
 * few runaway items look like.
 */
export function Histogram({
  bins, stats, height = 220, unit, log,
}: {
  bins: { start: number; end: number; count: number; overflow?: boolean }[];
  stats?: { n: number; mean: number; median: number; peak: number };
  height?: number;
  unit?: string;
  /** Bin widths grow geometrically; said plainly so the bars are not misread as uniform. */
  log?: boolean;
}) {
  const { t } = useTranslation();
  const n = useNum();
  if (!bins?.length) {
    return <p className="py-10 text-center text-sm text-muted-foreground">{t('common.noResults')}</p>;
  }
  const max = Math.max(1, ...bins.map((b) => b.count));
  const total = bins.reduce((s, b) => s + b.count, 0) || 1;

  return (
    <div>
      {/* The columns must stretch to the full height, not hug their content: a bar sized
          with a percentage height inside an auto-height parent resolves to zero, which is
          how this chart first shipped with axis labels, stats and no bars at all. */}
      <div dir="ltr" className="flex items-stretch gap-[3px]" style={{ height }}>
        {bins.map((b, i) => (
          <div key={i} className="group relative flex flex-1 flex-col justify-end">
            <div
              className={cn(
                'w-full rounded-t transition-[height] duration-500',
                b.overflow ? 'bg-accent/50' : 'bg-accent',
              )}
              style={{ height: `${Math.max((b.count / max) * 100, b.count ? 2 : 0)}%` }}
            />
            <div className="pointer-events-none absolute bottom-full start-1/2 z-10 mb-1 hidden -translate-x-1/2 group-hover:block">
              <TipShell
                title={`${n(b.start)} – ${n(b.end)}${b.overflow ? '+' : ''}${unit ? ` ${unit}` : ''}`}
                rows={[
                  [t('common.count'), n(b.count)],
                  [t('reports.charts.share'), `${((b.count / total) * 100).toFixed(1)}%`],
                ]}
              />
            </div>
          </div>
        ))}
      </div>
      <div dir="ltr" className="numeric mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>{n(bins[0].start)}</span>
        {log ? <span className="numeric-none">{t('reports.charts.logScale')}</span> : null}
        <span>{n(bins[bins.length - 1].end)}{bins[bins.length - 1].overflow ? '+' : ''}</span>
      </div>
      {stats ? (
        <dl className="mt-3 grid grid-cols-4 gap-2 text-center">
          {([
            ['n', stats.n], ['median', stats.median], ['mean', stats.mean], ['peak', stats.peak],
          ] as const).map(([key, value]) => (
            <div key={key} className="rounded-lg bg-secondary/60 py-1.5">
              <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {t(`reports.charts.${key}`)}
              </dt>
              <dd className="numeric text-sm font-semibold">{n(value)}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}

/**
 * Box plot — the five-number summary per category.
 *
 * Categories share one scale so they can be compared, and the whiskers run to the true
 * min and max rather than to a Tukey fence: for this data the extremes are the interesting
 * part, and hiding them as "outliers" would hide the point.
 */
export function BoxPlot({
  rows, labelFor, height = 24, scale = 'linear',
}: {
  rows: { key: string; n: number; min: string | number; q1: string | number; median: string | number;
          q3: string | number; max: string | number; mean: string | number }[];
  labelFor?: (key: string) => string;
  height?: number;
  /**
   * `sqrt` compresses the axis for long-tailed measures. On a linear axis a single item
   * with 10,000 views pushes an interquartile range of 4–165 into less than two pixels,
   * so the box — the part of a box plot that carries the information — disappears.
   */
  scale?: 'linear' | 'sqrt';
}) {
  const { t } = useTranslation();
  const n = useNum();
  if (!rows?.length) {
    return <p className="py-10 text-center text-sm text-muted-foreground">{t('common.noResults')}</p>;
  }
  const num = (v: any) => Number(v ?? 0);
  const warp = (v: number) => (scale === 'sqrt' ? Math.sqrt(Math.max(v, 0)) : v);
  const hi = warp(Math.max(1, ...rows.map((r) => num(r.max))));
  const pct = (v: any) => (warp(num(v)) / hi) * 100;

  return (
    <div className="space-y-3">
      {rows.map((r, i) => (
        <div key={r.key}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
            <span className="truncate font-medium">{labelFor?.(r.key) ?? r.key}</span>
            <span className="numeric shrink-0 text-muted-foreground">
              {t('reports.charts.median')} {n(r.median)} · n={n(r.n)}
            </span>
          </div>
          <div dir="ltr" className="relative w-full rounded bg-muted/60" style={{ height }}>
            {/* whisker */}
            <div
              className="absolute top-1/2 h-px -translate-y-1/2 bg-muted-foreground/50"
              style={{ left: `${pct(r.min)}%`, width: `${Math.max(pct(r.max) - pct(r.min), 0.5)}%` }}
            />
            {/* interquartile box */}
            <div
              className="absolute top-1/2 -translate-y-1/2 rounded-sm"
              style={{
                left: `${pct(r.q1)}%`,
                width: `${Math.max(pct(r.q3) - pct(r.q1), 0.8)}%`,
                height: height - 8,
                background: SERIES_COLORS[i % SERIES_COLORS.length],
                opacity: 0.35,
                border: `1px solid ${SERIES_COLORS[i % SERIES_COLORS.length]}`,
              }}
              title={`Q1 ${n(r.q1)} — Q3 ${n(r.q3)}`}
            />
            {/* median */}
            <div
              className="absolute top-1/2 w-[2px] -translate-y-1/2 rounded-full"
              style={{ left: `${pct(r.median)}%`, height: height - 6, background: SERIES_COLORS[i % SERIES_COLORS.length] }}
              title={`${t('reports.charts.median')} ${n(r.median)}`}
            />
            {/* mean, as a hollow marker so it is never confused with the median line */}
            <div
              className="absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rotate-45 border border-foreground/70 bg-background"
              style={{ left: `${pct(r.mean)}%` }}
              title={`${t('reports.charts.mean')} ${n(r.mean)}`}
            />
          </div>
        </div>
      ))}
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-sm border border-accent bg-accent/35" /> {t('reports.charts.iqr')}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-[2px] bg-accent" /> {t('reports.charts.median')}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rotate-45 border border-foreground/70" /> {t('reports.charts.mean')}
        </span>
        {scale === 'sqrt' ? <span className="ms-auto">{t('reports.charts.sqrtScale')}</span> : null}
      </p>
    </div>
  );
}

/**
 * Lorenz curve with the equality diagonal, plus the Gini coefficient.
 *
 * The area between the curve and the diagonal is the inequality; drawing the diagonal is
 * what makes the coefficient legible to somebody who has never met one.
 */
export function LorenzCurve({
  points, gini, height = 240, xLabel, yLabel,
}: {
  points: { population_pct: string | number; value_pct: string | number }[];
  gini: number | null;
  height?: number; xLabel: string; yLabel: string;
}) {
  const { t } = useTranslation();
  if (!points?.length) {
    return <p className="py-10 text-center text-sm text-muted-foreground">{t('common.noResults')}</p>;
  }
  const path = ['M 0 100', ...points.map((p) => `L ${Number(p.population_pct)} ${100 - Number(p.value_pct)}`)].join(' ');
  const area = `${path} L 100 100 Z`;

  return (
    <div>
      <div dir="ltr" className="relative w-full" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full overflow-visible">
          <rect x="0" y="0" width="100" height="100" fill="hsl(var(--muted) / 0.4)" rx="1" />
          {/* Perfect equality: every contributor gives the same share. */}
          <line x1="0" y1="100" x2="100" y2="0"
            stroke="hsl(var(--muted-foreground))" strokeWidth="0.5" strokeDasharray="2 2"
            vectorEffect="non-scaling-stroke" />
          <path d={area} fill="hsl(217 91% 55% / 0.18)" />
          <path d={path} fill="none" stroke={SERIES_COLORS[0]} strokeWidth="2" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
      <div dir="ltr" className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>{xLabel}</span>
        <span>{yLabel}</span>
      </div>
      {gini != null ? (
        <div className="mt-3 rounded-xl bg-secondary/60 p-3">
          <p className="flex items-baseline gap-2">
            <span className="text-xs text-muted-foreground">{t('reports.charts.gini')}</span>
            <span className="numeric text-xl font-semibold">{gini.toFixed(3)}</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t(gini >= 0.6 ? 'reports.charts.giniHigh' : gini >= 0.35
              ? 'reports.charts.giniMid' : 'reports.charts.giniLow')}
          </p>
        </div>
      ) : null}
    </div>
  );
}

/** Ranked bars with the cumulative share drawn over them — the 80/20 read. */
export function ParetoChart({
  rows, height = 300, valueLabel,
}: {
  rows: { name: string; value: number; cumulative_pct: string | number }[];
  height?: number; valueLabel: string;
}) {
  const { t } = useTranslation();
  const n = useNum();
  if (!rows?.length) {
    return <p className="py-10 text-center text-sm text-muted-foreground">{t('common.noResults')}</p>;
  }
  const data = rows.map((r) => ({ ...r, cumulative: Number(r.cumulative_pct) }));

  return (
    <div dir="ltr">
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 46 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis dataKey="name" {...axisProps} interval={0} angle={-40} textAnchor="end" height={54} />
          <YAxis yAxisId="left" {...axisProps} width={36} allowDecimals={false} />
          <YAxis yAxisId="right" orientation="right" {...axisProps} width={36} domain={[0, 100]} unit="%" />
          <Tooltip
            content={({ payload, label }: any) => {
              if (!payload?.length) return null;
              return (
                <TipShell
                  title={label}
                  rows={[
                    [valueLabel, n(payload[0]?.payload?.value)],
                    [t('reports.charts.cumulative'), `${payload[0]?.payload?.cumulative?.toFixed(1)}%`],
                  ]}
                />
              );
            }}
          />
          <Bar yAxisId="left" dataKey="value" name={valueLabel} fill={SERIES_COLORS[0]} radius={[4, 4, 0, 0]} />
          <Line
            yAxisId="right" type="monotone" dataKey="cumulative" name={t('reports.charts.cumulative')}
            stroke={SERIES_COLORS[6]} strokeWidth={2} dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Nested rectangles — composition where the parts differ by orders of magnitude. */
export function Treemap({
  data, height = 300,
}: {
  data: { name: string; size: number; group?: string }[];
  height?: number;
}) {
  const { t } = useTranslation();
  const n = useNum();
  if (!data?.length) {
    return <p className="py-10 text-center text-sm text-muted-foreground">{t('common.noResults')}</p>;
  }
  return (
    <div dir="ltr">
      <ResponsiveContainer width="100%" height={height}>
        <ReTreemap
          data={data} dataKey="size" nameKey="name" stroke="hsl(var(--background))" isAnimationActive={false}
          content={<TreemapCell />}
        >
          <Tooltip
            content={({ payload }: any) => {
              const p = payload?.[0]?.payload;
              if (!p?.name) return null;
              return <TipShell title={p.name} rows={[[t('common.count'), n(p.size)]]} />;
            }}
          />
        </ReTreemap>
      </ResponsiveContainer>
    </div>
  );
}

/** Recharts hands the content renderer raw geometry; labels are only drawn where they fit. */
function TreemapCell(props: any) {
  const { x, y, width, height, index, name, size } = props;
  if (width == null) return null;
  const fill = SERIES_COLORS[(index ?? 0) % SERIES_COLORS.length];
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={fill} fillOpacity={0.85} stroke="hsl(var(--background))" strokeWidth={2} rx={3} />
      {width > 72 && height > 30 ? (
        <>
          <text x={x + 8} y={y + 18} fill="white" fontSize={11} fontWeight={600}>
            {String(name ?? '').slice(0, Math.floor(width / 7))}
          </text>
          {height > 44 ? (
            <text x={x + 8} y={y + 33} fill="white" fontSize={10} fillOpacity={0.85}>{size}</text>
          ) : null}
        </>
      ) : null}
    </g>
  );
}

/* ===========================================================  comparison */

/**
 * Diverging bars around a shared zero line.
 *
 * Growth and decline must be distinguishable pre-attentively, so direction carries both
 * side and colour. Bars are scaled against the largest *absolute* change on the list, which
 * keeps a single dramatic mover from flattening everything else into invisibility while
 * still making it obvious which one it was.
 */
export function DivergingBars({
  rows, labelFor,
}: {
  rows: { key: string; current: number; previous: number; change: number; delta: number | null }[];
  labelFor?: (key: string) => string;
}) {
  const { t } = useTranslation();
  const n = useNum();
  const visible = rows.filter((r) => r.current || r.previous);
  if (!visible.length) {
    return <p className="py-10 text-center text-sm text-muted-foreground">{t('common.noResults')}</p>;
  }
  const scale = Math.max(1, ...visible.map((r) => Math.abs(r.change)));

  return (
    <ul className="space-y-2.5">
      {visible.map((r) => {
        const width = (Math.abs(r.change) / scale) * 50;
        const up = r.change >= 0;
        return (
          <li key={r.key} className="grid grid-cols-[7.5rem_1fr_5.5rem] items-center gap-2 text-sm">
            <span className="truncate text-muted-foreground">{labelFor?.(r.key) ?? r.key}</span>
            <div dir="ltr" className="relative h-5">
              <span className="absolute inset-y-0 left-1/2 w-px bg-border" />
              <span
                className={cn('absolute inset-y-[3px] rounded-sm', up ? 'bg-success/80' : 'bg-danger/80')}
                style={up
                  ? { left: '50%', width: `${Math.max(width, r.change ? 0.6 : 0)}%` }
                  : { right: '50%', width: `${Math.max(width, r.change ? 0.6 : 0)}%` }}
                title={`${n(r.previous)} → ${n(r.current)}`}
              />
            </div>
            <span className="numeric text-end">
              <span className="font-medium">{n(r.current)}</span>
              {r.delta != null ? (
                <span className={cn('ms-1.5 text-xs', up ? 'text-success' : 'text-danger')}>
                  {up ? '+' : ''}{r.delta}%
                </span>
              ) : (
                <span className="ms-1.5 text-xs text-muted-foreground">{t('reports.charts.new')}</span>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Slope chart: two periods, one line each, so direction is the whole message.
 *
 * Values are plotted on a shared scale rather than per-row, which is what allows a reader
 * to see not just that everything rose but which rows rose from where.
 */
export function SlopeChart({
  rows, labelFor, fromLabel, toLabel, height = 300,
}: {
  rows: { key: string; current: number; previous: number }[];
  labelFor?: (key: string) => string;
  fromLabel: string; toLabel: string; height?: number;
}) {
  const { t } = useTranslation();
  const n = useNum();
  const visible = rows.filter((r) => r.current || r.previous).slice(0, 10);
  if (!visible.length) {
    return <p className="py-10 text-center text-sm text-muted-foreground">{t('common.noResults')}</p>;
  }
  const hi = Math.max(1, ...visible.flatMap((r) => [r.current, r.previous]));
  const y = (v: number) => 92 - (v / hi) * 84;

  /**
   * Push overlapping labels apart.
   *
   * Slope charts routinely start several rows at almost the same value — five content types
   * that each published two items last quarter sit within a percent of each other — and the
   * labels then stack into an unreadable smear. The line endpoints stay exactly where the
   * data puts them; only the text is nudged, top-down, to hold a minimum gap.
   */
  const spread = (values: number[]) => {
    const GAP = 4.5;
    const order = values.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
    const out = new Array(values.length).fill(0);
    let last = -Infinity;
    for (const { v, i } of order) {
      const placed = Math.max(v, last + GAP);
      out[i] = placed;
      last = placed;
    }
    return out;
  };
  const leftY = spread(visible.map((r) => y(r.previous)));
  const rightY = spread(visible.map((r) => y(r.current)));

  return (
    <div>
      <div dir="ltr" className="relative w-full" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full overflow-visible">
          <line x1="18" y1="4" x2="18" y2="94" stroke="hsl(var(--border))" strokeWidth="0.4" vectorEffect="non-scaling-stroke" />
          <line x1="82" y1="4" x2="82" y2="94" stroke="hsl(var(--border))" strokeWidth="0.4" vectorEffect="non-scaling-stroke" />
          {visible.map((r, i) => {
            const color = SERIES_COLORS[i % SERIES_COLORS.length];
            return (
              <g key={r.key}>
                <line
                  x1="18" y1={y(r.previous)} x2="82" y2={y(r.current)}
                  stroke={color} strokeWidth="1.6" vectorEffect="non-scaling-stroke"
                  strokeOpacity={0.85}
                />
                <circle cx="18" cy={y(r.previous)} r="1" fill={color} vectorEffect="non-scaling-stroke" />
                <circle cx="82" cy={y(r.current)} r="1" fill={color} vectorEffect="non-scaling-stroke" />
              </g>
            );
          })}
        </svg>
        {/* Labels live in HTML, not SVG: a non-uniform viewBox scale would stretch text. */}
        <div className="pointer-events-none absolute inset-0">
          {visible.map((r, i) => (
            <React.Fragment key={r.key}>
              <span
                className="numeric absolute -translate-y-1/2 text-[10px] text-muted-foreground"
                style={{ right: '84%', top: `${leftY[i]}%` }}
              >
                {n(r.previous)}
              </span>
              <span
                className="absolute max-w-[30%] -translate-y-1/2 truncate text-[10px] font-medium"
                style={{ left: '84%', top: `${rightY[i]}%`, color: SERIES_COLORS[i % SERIES_COLORS.length] }}
              >
                {n(r.current)} · {labelFor?.(r.key) ?? r.key}
              </span>
            </React.Fragment>
          ))}
        </div>
      </div>
      <div dir="ltr" className="mt-1 flex justify-between px-[16%] text-[10px] uppercase tracking-wide text-muted-foreground">
        <span>{fromLabel}</span>
        <span>{toLabel}</span>
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground">{t('reports.charts.slopeHint')}</p>
    </div>
  );
}

/**
 * Radar of several metrics for several segments.
 *
 * Every metric is rescaled to 0–100 against the strongest segment on that axis, because raw
 * counts cannot share a radius — downloads outnumber courses by orders of magnitude and the
 * shape would be decided entirely by the largest one. What is readable here is the profile:
 * which segment leans towards creating and which towards consuming.
 */
export function RadarProfile({
  segments, metrics, labelFor, metricLabelFor, height = 320,
}: {
  segments: { key: string; [metric: string]: any }[];
  metrics: string[];
  labelFor?: (key: string) => string;
  metricLabelFor?: (key: string) => string;
  height?: number;
}) {
  const { t } = useTranslation();
  const n = useNum();
  const shown = segments.slice(0, 5);

  const data = React.useMemo(() => metrics.map((m) => {
    const peak = Math.max(1, ...shown.map((s) => Number(s[m] ?? 0)));
    const row: any = { metric: metricLabelFor?.(m) ?? m, __raw: {} as Record<string, number> };
    for (const s of shown) {
      row[s.key] = Math.round((Number(s[m] ?? 0) / peak) * 100);
      row.__raw[s.key] = Number(s[m] ?? 0);
    }
    return row;
  }), [shown, metrics, metricLabelFor]);

  if (!shown.length) {
    return <p className="py-10 text-center text-sm text-muted-foreground">{t('common.noResults')}</p>;
  }

  return (
    <div>
      <div dir="ltr">
        <ResponsiveContainer width="100%" height={height}>
          <ReRadarChart data={data} outerRadius="72%">
            <PolarGrid stroke="hsl(var(--border))" />
            <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
            <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
            <Tooltip
              content={({ payload, label }: any) => {
                if (!payload?.length) return null;
                const raw = payload[0]?.payload?.__raw ?? {};
                return (
                  <TipShell
                    title={label}
                    rows={payload.map((p: any) => [p.name, n(raw[p.name] ?? p.value)])}
                  />
                );
              }}
            />
            {shown.map((s, i) => (
              <Radar
                key={s.key} name={s.key} dataKey={s.key}
                stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                fill={SERIES_COLORS[i % SERIES_COLORS.length]}
                fillOpacity={0.14} strokeWidth={2}
              />
            ))}
          </ReRadarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-1 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {shown.map((s, i) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: SERIES_COLORS[i % SERIES_COLORS.length] }} />
            {labelFor?.(s.key) ?? s.key}
          </span>
        ))}
      </div>
      <p className="mt-2 text-center text-[10px] text-muted-foreground">{t('reports.charts.radarHint')}</p>
    </div>
  );
}

/** Bullet chart: a measure, its scale, and a benchmark marker. */
export function BulletChart({
  rows, benchmarkLabel, labelFor,
}: {
  rows: { key: string; value: number; benchmark: number; count?: number }[];
  benchmarkLabel: string;
  labelFor?: (key: string) => string;
}) {
  const { t } = useTranslation();
  const n = useNum();
  if (!rows?.length) {
    return <p className="py-10 text-center text-sm text-muted-foreground">{t('common.noResults')}</p>;
  }
  const hi = Math.max(1, ...rows.flatMap((r) => [r.value, r.benchmark]));

  return (
    <div className="space-y-3">
      {rows.map((r) => {
        const ahead = r.value >= r.benchmark;
        return (
          <div key={r.key}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
              <span className="truncate">{labelFor?.(r.key) ?? r.key}</span>
              <span className="numeric shrink-0">
                <span className="font-medium">{n(r.value)}</span>
                <span className={cn('ms-1.5', ahead ? 'text-success' : 'text-muted-foreground')}>
                  {ahead ? '▲' : '▼'} {n(Math.abs(r.value - r.benchmark))}
                </span>
              </span>
            </div>
            <div dir="ltr" className="relative h-4 rounded bg-muted/70">
              <div
                className={cn('absolute inset-y-1 rounded-sm', ahead ? 'bg-accent' : 'bg-accent/55')}
                style={{ left: 0, width: `${Math.max((r.value / hi) * 100, 1)}%` }}
              />
              <div
                className="absolute inset-y-0 w-[2px] bg-foreground"
                style={{ left: `${(r.benchmark / hi) * 100}%` }}
                title={`${benchmarkLabel}: ${n(r.benchmark)}`}
              />
            </div>
          </div>
        );
      })}
      <p className="flex items-center gap-1.5 pt-1 text-[10px] text-muted-foreground">
        <span className="h-3 w-[2px] bg-foreground" /> {benchmarkLabel}
        <span className="ms-2">{t('reports.charts.bulletHint')}</span>
      </p>
    </div>
  );
}

/* ============================================================  behaviour */

/**
 * Cohort retention triangle.
 *
 * Rows are signup months, columns are months elapsed, and each cell is the share of that
 * cohort still active. Percentages rather than counts, because cohorts differ in size and
 * only the rate is comparable down a column — reading counts here is the classic way to
 * conclude that retention is improving when the platform has merely grown.
 */
export function CohortGrid({
  sizes, activity, periods = 8,
}: {
  sizes: { cohort: string; size: number }[];
  activity: { cohort: string; period: number; users: number }[];
  periods?: number;
}) {
  const { t, i18n } = useTranslation();
  const n = useNum();
  const cells = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const a of activity) map.set(`${a.cohort}|${a.period}`, Number(a.users));
    return map;
  }, [activity]);

  const rows = React.useMemo(() => [...sizes].sort((a, b) => b.cohort.localeCompare(a.cohort)), [sizes]);
  if (!rows.length) {
    return <p className="py-10 text-center text-sm text-muted-foreground">{t('common.noResults')}</p>;
  }

  const monthLabel = (cohort: string) => {
    const [y, m] = cohort.split('-');
    const date = new Date(Number(y), Number(m) - 1, 1);
    return new Intl.DateTimeFormat(i18n.language, { month: 'short', year: '2-digit' }).format(date);
  };

  return (
    <div dir="ltr" className="overflow-x-auto">
      <table className="w-full min-w-[36rem] border-separate border-spacing-[2px] text-[11px]">
        <thead>
          <tr className="text-muted-foreground">
            <th className="text-start font-medium">{t('reports.charts.cohort')}</th>
            <th className="px-1 text-end font-medium">{t('reports.charts.size')}</th>
            {Array.from({ length: periods }, (_, i) => (
              <th key={i} className="font-medium">{t('reports.charts.month')}&nbsp;{i}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.cohort}>
              <td className="whitespace-nowrap font-medium">{monthLabel(row.cohort)}</td>
              <td className="numeric px-1 text-end text-muted-foreground">{n(row.size)}</td>
              {Array.from({ length: periods }, (_, p) => {
                const users = cells.get(`${row.cohort}|${p}`);
                if (users === undefined) return <td key={p} className="rounded bg-muted/40" />;
                const rate = row.size ? users / row.size : 0;
                return (
                  <td
                    key={p}
                    title={`${monthLabel(row.cohort)} · ${t('reports.charts.month')} ${p}: ${n(users)} / ${n(row.size)}`}
                    className={cn('numeric h-7 rounded text-center', rate > 0.5 && 'font-semibold text-white')}
                    style={{ backgroundColor: `hsl(var(--accent) / ${0.1 + Math.min(rate, 1) * 0.85})` }}
                  >
                    {Math.round(rate * 100)}%
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * 100% stacked area — composition over time, with volume deliberately removed.
 *
 * Hand-drawn rather than a Recharts `stackOffset="expand"` because the normalisation has to
 * survive buckets where every series is zero: expand mode divides by the stack total and
 * produces NaN there, which silently breaks the polygon for the rest of the series.
 */
export function ShareArea({
  rows, series, labelFor, height = 260,
}: {
  rows: { day: string; key: string; count: number }[];
  series: string[];
  labelFor?: (key: string) => string;
  height?: number;
}) {
  const { t } = useTranslation();
  const buckets = React.useMemo(() => {
    const byDay = new Map<string, Record<string, number>>();
    for (const r of rows) {
      const entry = byDay.get(r.day) ?? {};
      entry[r.key] = (entry[r.key] ?? 0) + Number(r.count ?? 0);
      byDay.set(r.day, entry);
    }
    return [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows]);

  if (!buckets.length) {
    return <p className="py-10 text-center text-sm text-muted-foreground">{t('common.noResults')}</p>;
  }

  const width = Math.max(buckets.length - 1, 1);
  /*
   * Cumulative upper edge per series, as a share of that bucket's total.
   *
   * A bucket where nothing happened has no composition — the mix is unobserved, not zero.
   * Collapsing those to the baseline is what a naive implementation does, and on daily
   * buckets it drew the whole chart as a row of spikes to the floor. Carrying the previous
   * bucket's shares forward keeps the bands continuous and says the honest thing: the last
   * known mix still stands.
   */
  const edges: Record<string, number[]> = {};
  const shares: number[][] = buckets.map(([, values], i) => {
    const total = series.reduce((s, k) => s + (values[k] ?? 0), 0);
    if (total) return series.map((k) => ((values[k] ?? 0) / total) * 100);
    // Look back for the most recent bucket that had any activity.
    for (let j = i - 1; j >= 0; j -= 1) {
      const prev = buckets[j][1];
      const prevTotal = series.reduce((s, k) => s + (prev[k] ?? 0), 0);
      if (prevTotal) return series.map((k) => ((prev[k] ?? 0) / prevTotal) * 100);
    }
    return series.map(() => 100 / Math.max(series.length, 1));
  });
  series.forEach((key, si) => {
    let running = 0;
    edges[key] = shares.map((row, i) => {
      running = si === 0 ? row[0] : edges[series[si - 1]][i] + row[si];
      return running;
    });
  });

  return (
    <div>
      <div dir="ltr" style={{ height }}>
        <svg viewBox={`0 0 ${width} 100`} preserveAspectRatio="none" className="h-full w-full">
          {series.map((key, i) => {
            const upper = edges[key];
            const lower = i === 0 ? new Array(buckets.length).fill(0) : edges[series[i - 1]];
            const top = upper.map((v, x) => `${x === 0 ? 'M' : 'L'} ${x} ${100 - v}`).join(' ');
            const bottom = [...lower].reverse().map((v, x) => `L ${width - x} ${100 - v}`).join(' ');
            return (
              <path key={key} d={`${top} ${bottom} Z`}
                fill={SERIES_COLORS[i % SERIES_COLORS.length]} fillOpacity={0.85} />
            );
          })}
        </svg>
      </div>
      <div dir="ltr" className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>{buckets[0][0]}</span>
        <span>{buckets[buckets.length - 1][0]}</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {series.map((key, i) => (
          <span key={key} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: SERIES_COLORS[i % SERIES_COLORS.length] }} />
            {labelFor?.(key) ?? key}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Compact grid of "N% of X" tiles — the segment read for RFM and lifecycle states. */
export function SegmentGrid({
  segments, total, labelFor, hintFor, toneFor,
}: {
  segments: { key: string; users: number; avg_events?: number; avg_recency_days?: number | null }[];
  total: number;
  labelFor?: (key: string) => string;
  hintFor?: (row: any) => React.ReactNode;
  toneFor?: (key: string) => string;
}) {
  const n = useNum();
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
      {segments.map((s) => (
        <div key={s.key} className={cn('rounded-xl border p-3', toneFor?.(s.key))}>
          <p className="truncate text-xs font-medium">{labelFor?.(s.key) ?? s.key}</p>
          <p className="numeric mt-1 text-xl font-semibold">{n(s.users)}</p>
          <p className="numeric text-[11px] text-muted-foreground">
            {total ? ((s.users / total) * 100).toFixed(1) : '0.0'}%
          </p>
          {hintFor ? <p className="mt-1 text-[11px] text-muted-foreground">{hintFor(s)}</p> : null}
        </div>
      ))}
    </div>
  );
}

/**
 * Population pyramid — two cohorts mirrored around a shared age axis.
 *
 * The conventional demographic chart, and conventional for a reason: back-to-back bars on
 * one axis make an imbalance at a particular age visible at a glance, which stacked or
 * grouped bars do not. Both sides are scaled against the single largest bar rather than
 * each against its own maximum, so a smaller cohort reads as smaller instead of being
 * silently stretched to fill the same width.
 */
export function PopulationPyramid({
  bands, left, right, cells, labelFor, leftLabel, rightLabel,
}: {
  /** Age bands, youngest last — the base of a pyramid is at the bottom. */
  bands: string[];
  left: string; right: string;
  cells: Map<string, number>;
  labelFor?: (band: string) => string;
  leftLabel: string; rightLabel: string;
}) {
  const { t } = useTranslation();
  const n = useNum();
  const at = (band: string, side: string) => cells.get(`${band}||${side}`) ?? 0;
  const peak = Math.max(1, ...bands.flatMap((b) => [at(b, left), at(b, right)]));
  const total = bands.reduce((s, b) => s + at(b, left) + at(b, right), 0);

  if (!total) {
    return <p className="py-10 text-center text-sm text-muted-foreground">{t('common.noResults')}</p>;
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: SERIES_COLORS[0] }} />
          {leftLabel}
        </span>
        <span className="flex items-center gap-1.5">
          {rightLabel}
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: SERIES_COLORS[6] }} />
        </span>
      </div>

      <ul className="space-y-1">
        {bands.map((band) => {
          const l = at(band, left);
          const r = at(band, right);
          return (
            <li key={band} className="flex items-center gap-2 text-xs">
              {/* Bars are laid out LTR in both languages: the mirror is the chart's whole
                  structure, and flipping it under RTL would swap the two cohorts. */}
              <div dir="ltr" className="flex flex-1 items-center gap-1">
                <div className="flex flex-1 justify-end">
                  <span
                    className="h-4 rounded-s-sm transition-[width] duration-500"
                    style={{ width: `${(l / peak) * 100}%`, background: SERIES_COLORS[0], opacity: 0.85 }}
                    title={`${leftLabel} · ${labelFor?.(band) ?? band}: ${n(l)}`}
                  />
                </div>
                <span className="numeric w-16 shrink-0 text-center text-[10px] text-muted-foreground">
                  {labelFor?.(band) ?? band}
                </span>
                <div className="flex flex-1 justify-start">
                  <span
                    className="h-4 rounded-e-sm transition-[width] duration-500"
                    style={{ width: `${(r / peak) * 100}%`, background: SERIES_COLORS[6], opacity: 0.85 }}
                    title={`${rightLabel} · ${labelFor?.(band) ?? band}: ${n(r)}`}
                  />
                </div>
              </div>
              <span className="numeric w-20 shrink-0 text-end text-[10px] text-muted-foreground">
                {n(l)} / {n(r)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * How much of a population a field is actually recorded for.
 *
 * Every demographic panel is a claim about the user base, and a claim resting on a third of
 * it is a different claim. Coverage sits beside them so the reader can weigh what they are
 * looking at instead of assuming the denominator is everyone.
 */
export function CoverageBars({
  fields, total, labelFor, hint,
}: {
  fields: { key: string; count: number }[];
  total: number;
  labelFor?: (key: string) => string;
  /** Caption under the bars; defaults to the demographic wording. */
  hint?: string;
}) {
  const { t } = useTranslation();
  const n = useNum();
  return (
    <ul className="space-y-2.5">
      {fields.map((f) => {
        const pct = total ? (f.count / total) * 100 : 0;
        return (
          <li key={f.key}>
            <div className="flex items-baseline justify-between gap-3 text-xs">
              <span>{labelFor?.(f.key) ?? f.key}</span>
              <span className="numeric text-muted-foreground">
                {n(f.count)} / {n(total)}
                <span className={cn(
                  'ms-2 font-medium',
                  pct >= 80 ? 'text-success' : pct >= 40 ? 'text-warning' : 'text-danger',
                )}>
                  {pct.toFixed(0)}%
                </span>
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className={cn('h-full rounded-full', pct >= 80 ? 'bg-success' : pct >= 40 ? 'bg-warning' : 'bg-danger')}
                style={{ width: `${Math.max(pct, pct ? 1.5 : 0)}%` }}
              />
            </div>
          </li>
        );
      })}
      <li className="pt-1 text-[10px] text-muted-foreground">{hint ?? t('reports.demographics.coverageHint')}</li>
    </ul>
  );
}
