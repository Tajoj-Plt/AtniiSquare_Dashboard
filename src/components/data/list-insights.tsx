import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { BarChart3, ChevronDown } from 'lucide-react';
import { api } from '@/lib/api';
import { cn, formatNumber } from '@/lib/utils';
import type { Tone } from '@/lib/tones';
import { StatCard } from '@/components/data/page-parts';
import { TrendChart } from '@/components/data/charts';
import { RankTable, SegmentBar } from '@/components/data/report-charts';
import { Card, CardContent, Skeleton } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';

export interface InsightCard {
  /** Key in the stats `totals` object. */
  key: string;
  label: string;
  tone?: Tone | 'success' | 'warning' | 'danger';
  /** Renders the raw value; defaults to a localised number. */
  format?: (value: any) => React.ReactNode;
}

export interface InsightCut {
  /** Key in the stats `breakdown` object. */
  key: string;
  label: string;
  /** Maps a raw group key to something a reader recognises. */
  labelFor?: (key: string) => string;
}

/**
 * The summary that sits above a list.
 *
 * It asks the resource's own `/stats` with **the same query the table is showing**, so the
 * figures describe the rows on screen rather than the whole table — a headline that
 * disagrees with the list under it is worse than no headline. Collapsible, and the state
 * sticks per screen, because the people who live in these tables all day should not have to
 * scroll past a chart they have already read.
 */
export function ListInsights({
  queryKey, path, params, cards, cuts, storageKey, timelineLabel,
}: {
  queryKey: string;
  path: string;
  /** The list's active filters — cursor and limit excluded. */
  params: Record<string, any>;
  cards: InsightCard[];
  cuts?: InsightCut[];
  /** Where the open/closed choice is remembered. Defaults to the query key. */
  storageKey?: string;
  timelineLabel?: string;
}) {
  const { t, i18n } = useTranslation();
  const key = `sudamind.insights.${storageKey ?? queryKey}`;
  const [open, setOpen] = React.useState(() => {
    try { return localStorage.getItem(key) !== '0'; } catch { return true; }
  });

  const toggle = () => {
    setOpen((o) => {
      try { localStorage.setItem(key, o ? '0' : '1'); } catch { /* private window */ }
      return !o;
    });
  };

  const { data, isLoading } = useQuery({
    queryKey: [queryKey, 'stats', params],
    queryFn: () => api.get(`${path}/stats`, params),
    staleTime: 30_000,
  });

  const totals = data?.totals ?? {};
  const timeline = (data?.timeline ?? []).map((row: any) => ({
    day: String(row.day).slice(5),
    count: Number(row.count),
  }));

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={toggle} className="-ms-2 gap-2">
          <BarChart3 className="h-4 w-4" />
          {t('insights.title')}
          <ChevronDown className={cn('h-4 w-4 transition-transform', !open && 'rtl:rotate-90 ltr:-rotate-90')} />
        </Button>
        {/* The count is the one number worth showing even when the panel is shut. */}
        {!open && !isLoading ? (
          <span className="numeric text-sm text-muted-foreground">
            {formatNumber(totals.total ?? 0, i18n.language)} · {t('insights.matching')}
          </span>
        ) : null}
      </div>

      {open ? (
        isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {cards.slice(0, 4).map((c) => <Skeleton key={c.key} className="h-24" />)}
          </div>
        ) : (
          <>
            <div className={cn(
              'grid gap-3 sm:grid-cols-2',
              cards.length >= 6 ? 'lg:grid-cols-3 xl:grid-cols-6' : 'lg:grid-cols-4',
            )}>
              {cards.map((card) => (
                <StatCard
                  key={card.key}
                  label={card.label}
                  tone={card.tone}
                  value={card.format
                    ? card.format(totals[card.key])
                    : formatNumber(Number(totals[card.key] ?? 0), i18n.language)}
                />
              ))}
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
              <Card>
                <CardContent className="p-4">
                  <p className="mb-1 text-sm font-medium">
                    {timelineLabel ?? t('insights.added', { days: data?.days ?? 30 })}
                  </p>
                  {timeline.length ? (
                    <TrendChart data={timeline} series={[{ key: 'count', label: t('insights.added_short') }]} height={180} />
                  ) : (
                    <p className="py-10 text-center text-sm text-muted-foreground">{t('common.noResults')}</p>
                  )}
                </CardContent>
              </Card>

              {cuts?.length ? (
                <Card>
                  <CardContent className="space-y-4 p-4">
                    {cuts.map((cut) => {
                      const rows = (data?.breakdown?.[cut.key] ?? []) as { key: string; count: number }[];
                      if (!rows.length) return null;
                      return (
                        <div key={cut.key}>
                          <p className="mb-2 text-sm font-medium">{cut.label}</p>
                          <SegmentBar
                            // The whole filtered population, not the six rows shown — see
                            // SegmentBar. A cut like "top towns" covers only part of it.
                            total={Number(totals.total ?? 0) || undefined}
                            segments={rows.slice(0, 6).map((r) => ({
                              label: cut.labelFor?.(r.key) ?? r.key,
                              value: r.count,
                            }))}
                          />
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              ) : null}
            </div>
          </>
        )
      ) : null}
    </section>
  );
}

/** A ranked list from a stats payload, for pages that want one. */
export function InsightRanking({
  rows, title, labelKey = 'key', valueKey = 'count',
}: { rows: any[]; title: string; labelKey?: string; valueKey?: string }) {
  const { t } = useTranslation();
  if (!rows?.length) return null;
  return (
    <Card>
      <CardContent className="p-4">
        <p className="mb-2 text-sm font-medium">{title}</p>
        <RankTable
          columns={[
            { key: 'label', header: t('common.name') },
            { key: 'value', header: t('insights.count'), align: 'end' },
          ]}
          rows={rows.map((r) => ({ label: r[labelKey] ?? '—', value: Number(r[valueKey] ?? 0) }))}
        />
      </CardContent>
    </Card>
  );
}
