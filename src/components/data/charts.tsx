import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { formatNumber } from '@/lib/utils';

/**
 * A small, deliberately narrow chart layer.
 *
 * Series colours come from a fixed, ordered palette rather than per-chart choices, so the
 * same dimension keeps the same colour across the dashboard, and every colour is defined
 * to hold contrast in both themes. Axes and grids read from the CSS tokens, so charts
 * follow the theme switch without a re-render hack.
 */
export const SERIES_COLORS = [
  'hsl(217 91% 55%)',   // blue — the platform accent, always the first series
  'hsl(222 16% 38%)',   // graphite
  'hsl(199 89% 48%)',   // sky
  'hsl(243 70% 63%)',   // indigo
  'hsl(189 82% 42%)',   // cyan
  'hsl(215 20% 62%)',   // slate
  'hsl(268 66% 63%)',   // violet
  'hsl(210 30% 25%)',   // near-ink
];

const axisProps = {
  stroke: 'hsl(var(--muted-foreground))',
  fontSize: 11,
  tickLine: false,
  axisLine: false,
};

function ChartTooltip({ active, payload, label }: any) {
  const { i18n } = useTranslation();
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-raised">
      {label ? <p className="mb-1 font-medium text-popover-foreground">{label}</p> : null}
      {payload.map((entry: any) => (
        <p key={entry.dataKey ?? entry.name} className="flex items-center gap-2 text-muted-foreground">
          <span className="h-2 w-2 rounded-full" style={{ background: entry.color ?? entry.fill }} />
          <span>{entry.name}</span>
          <span className="numeric ms-auto font-medium text-popover-foreground">
            {formatNumber(entry.value, i18n.language)}
          </span>
        </p>
      ))}
    </div>
  );
}

export function TrendChart({
  data, series, xKey = 'day', height = 260,
}: {
  data: any[];
  series: { key: string; label: string }[];
  xKey?: string;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          {series.map((s, i) => (
            <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={SERIES_COLORS[i % SERIES_COLORS.length]} stopOpacity={0.28} />
              <stop offset="100%" stopColor={SERIES_COLORS[i % SERIES_COLORS.length]} stopOpacity={0.02} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey={xKey} {...axisProps} minTickGap={24} />
        <YAxis {...axisProps} width={36} allowDecimals={false} />
        <Tooltip content={<ChartTooltip />} />
        {series.map((s, i) => (
          <Area
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
            strokeWidth={2}
            fill={`url(#grad-${s.key})`}
            dot={false}
            activeDot={{ r: 4 }}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function CategoryBarChart({
  data, xKey, series, height = 260, stacked,
}: {
  data: any[];
  xKey: string;
  series: { key: string; label: string }[];
  height?: number;
  stacked?: boolean;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        {/*
          A handful of named categories should all be labelled, but a 90-day timeline must
          not: forcing interval={0} there renders every date on top of the next and the axis
          becomes an unreadable smear. Past a dozen points, let the axis thin the labels and
          keep a minimum gap between them.
        */}
        <XAxis
          dataKey={xKey}
          {...axisProps}
          interval={data.length > 12 ? 'preserveStartEnd' : 0}
          minTickGap={data.length > 12 ? 28 : 0}
          height={40}
        />
        <YAxis {...axisProps} width={36} allowDecimals={false} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.5 }} />
        {series.length > 1 ? <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} /> : null}
        {series.map((s, i) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.label}
            stackId={stacked ? 'a' : undefined}
            fill={SERIES_COLORS[i % SERIES_COLORS.length]}
            radius={stacked && i < series.length - 1 ? 0 : [4, 4, 0, 0]}
            maxBarSize={44}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DonutChart({
  data, nameKey = 'name', valueKey = 'value', height = 240,
}: {
  data: any[]; nameKey?: string; valueKey?: string; height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          dataKey={valueKey}
          nameKey={nameKey}
          innerRadius="58%"
          outerRadius="82%"
          paddingAngle={2}
          strokeWidth={0}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={SERIES_COLORS[i % SERIES_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip content={<ChartTooltip />} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

/** Horizontal ranked list — better than a bar chart for long Arabic category labels. */
export function RankedList({
  items, valueLabel,
}: { items: { label: string; value: number }[]; valueLabel?: string }) {
  const { i18n } = useTranslation();
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <ul className="space-y-2.5">
      {items.map((item, i) => (
        <li key={item.label}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate">{item.label}</span>
            <span className="numeric shrink-0 font-medium tabular-nums">
              {formatNumber(item.value, i18n.language)}
              {valueLabel ? <span className="ms-1 text-xs text-muted-foreground">{valueLabel}</span> : null}
            </span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{
                width: `${(item.value / max) * 100}%`,
                background: SERIES_COLORS[i % SERIES_COLORS.length],
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
