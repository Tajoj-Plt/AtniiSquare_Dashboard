import * as React from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertCircle, ChevronDown, ChevronUp, Download } from 'lucide-react';
import { useAuth } from '@/app/auth';
import { cn } from '@/lib/utils';
import { downloadCsv, toCsv } from '@/lib/csv';
import { Button } from '@/components/ui/button';

/** Every panel that shows rows can be taken away as a file, as elsewhere in reporting. */
export function CsvButton({
  name, rows, columns,
}: { name: string; rows: any[]; columns?: { key: string; header: string }[] }) {
  const { t } = useTranslation();
  if (!rows?.length) return null;
  return (
    <Button
      variant="ghost" size="sm"
      onClick={() => downloadCsv(name, toCsv(rows, columns))}
      title={t('actions.export')}
    >
      <Download className="h-4 w-4" /> CSV
    </Button>
  );
}

/**
 * The tab strip both app areas share.
 *
 * Tabs are links rather than local state so a particular view can be bookmarked and sent to
 * somebody, which is the whole reason the section lives in the URL.
 */
export function SectionTabs({
  base, tabs, active,
}: { base: string; tabs: { key: string; label: string }[]; active: string }) {
  return (
    <div className="-mx-1 overflow-x-auto pb-1">
      <nav className="flex w-max items-center gap-1 rounded-full bg-secondary p-1" aria-label={base}>
        {tabs.map((tab) => (
          <NavLink
            key={tab.key}
            to={`${base}/${tab.key}`}
            aria-current={active === tab.key ? 'page' : undefined}
            className={cn(
              'whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              active === tab.key
                ? 'bg-card text-foreground shadow-soft'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

/**
 * The app-control area's own tab strip.
 *
 * Filtered by permission, like the sidebar: an account that can curate but not broadcast
 * never sees a tab it would only be refused at.
 */
export function AppControlTabs({ active }: { active: 'flags' | 'curation' | 'broadcasts' | 'ads' }) {
  const { t } = useTranslation();
  const { can } = useAuth();
  const tabs = [
    ...(can('app.config.manage')
      ? [
          { key: 'flags', label: t('appControl.tabs.flags') },
          { key: 'curation', label: t('appControl.tabs.curation') },
          { key: 'ads', label: t('appControl.tabs.ads') },
        ]
      : []),
    ...(can('app.broadcast.send') ? [{ key: 'broadcasts', label: t('appControl.tabs.broadcasts') }] : []),
  ];
  if (tabs.length < 2) return null;
  return <SectionTabs base="/app-control" tabs={tabs} active={active} />;
}

/**
 * What a list panel shows when its fetch failed.
 *
 * Without it a failed request renders as an empty list, which reads as "there is nothing
 * here" — the one message it must not send about configuration that may well be live.
 */
export function QueryError({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl bg-danger/5 p-8 text-center">
      <AlertCircle className="h-8 w-8 text-danger" />
      <div>
        <p className="font-medium">{t('common.error')}</p>
        <p className="mt-1 text-sm text-muted-foreground">{error.message}</p>
      </div>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>{t('actions.retry')}</Button>
      ) : null}
    </div>
  );
}

/**
 * Move a row up or down in an ordered list.
 *
 * Buttons rather than drag-and-drop: every ordering in this area is a short list, and a
 * pair of buttons is reachable from the keyboard and from a screen reader without any of
 * the machinery a drag surface needs to be equally reachable.
 */
export function MoveButtons({
  index, total, onMove, disabled,
}: { index: number; total: number; onMove: (direction: -1 | 1) => void; disabled?: boolean }) {
  const { t } = useTranslation();
  return (
    <span className="inline-flex items-center gap-0.5">
      <Button
        variant="ghost" size="icon-sm"
        disabled={disabled || index === 0}
        onClick={() => onMove(-1)}
        aria-label={t('appControl.moveUp')}
        title={t('appControl.moveUp')}
      >
        <ChevronUp className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost" size="icon-sm"
        disabled={disabled || index === total - 1}
        onClick={() => onMove(1)}
        aria-label={t('appControl.moveDown')}
        title={t('appControl.moveDown')}
      >
        <ChevronDown className="h-4 w-4" />
      </Button>
    </span>
  );
}

/**
 * Swap two neighbours and hand back the whole ordering the API expects.
 *
 * The positions are renumbered in tens rather than by index so a later insertion has room
 * to land between two rows without rewriting the list, and the API is always sent the
 * complete order — see ReorderDto for why a whole list beats a stream of single moves.
 */
export function reorder<T>(rows: T[], index: number, direction: -1 | 1, idOf: (row: T) => string) {
  const next = [...rows];
  const target = index + direction;
  if (target < 0 || target >= next.length) return null;
  [next[index], next[target]] = [next[target], next[index]];
  return { rows: next, items: next.map((row, i) => ({ id: idOf(row), position: (i + 1) * 10 })) };
}
