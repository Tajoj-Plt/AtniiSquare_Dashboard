import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDownRight, ArrowUpRight, ShieldAlert, type LucideIcon } from 'lucide-react';
import { cn, formatNumber } from '@/lib/utils';
import { TONES, type Tone } from '@/lib/tones';
import { Card, CardContent, CardHeader, CardTitle, Skeleton } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';

/** Page title, subtitle and the primary action for a screen. */
export function PageHeader({
  title, subtitle, actions, icon: Icon, tone = 'blue',
}: { title: string; subtitle?: string; actions?: React.ReactNode; icon?: LucideIcon; tone?: Tone }) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-3">
        {Icon ? (
          <span className={cn('mt-0.5 grid h-11 w-11 shrink-0 place-items-center rounded-xl', TONES[tone].chip)}>
            <Icon className="h-5 w-5" />
          </span>
        ) : null}
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-[28px]">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

/** A single KPI tile. `delta` is a percentage change, rendered with direction and colour. */
export function StatCard({
  label, value, icon: Icon, delta, hint, loading, tone = 'blue', onClick,
}: {
  label: string;
  value: React.ReactNode;
  icon?: LucideIcon;
  delta?: number | null;
  hint?: string;
  loading?: boolean;
  /** A categorical hue, or one of the three status meanings. */
  tone?: Tone | 'success' | 'warning' | 'danger';
  onClick?: () => void;
}) {
  const STATUS: Record<string, string> = {
    success: 'text-success bg-success/10',
    warning: 'text-warning bg-warning/15',
    danger: 'text-danger bg-danger/10',
  };
  const toneClass = STATUS[tone] ?? TONES[tone as Tone].chip;

  const Wrapper = onClick ? 'button' : 'div';

  return (
    // Plain card surface; the tinted icon chip is what carries the category.
    <Card className={cn('transition-shadow', onClick && 'cursor-pointer hover:shadow-raised')}>
      <Wrapper onClick={onClick} className={cn('w-full text-start', onClick && 'block')}>
        <CardContent className="flex items-start justify-between gap-3 p-5">
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
            {loading ? (
              <Skeleton className="mt-2 h-8 w-20" />
            ) : (
              <p className="numeric mt-1.5 text-[26px] font-bold leading-none tracking-tight">{value}</p>
            )}
            {typeof delta === 'number' ? (
              <p
                className={cn(
                  'numeric mt-2 inline-flex items-center gap-0.5 text-xs font-medium',
                  delta >= 0 ? 'text-success' : 'text-danger',
                )}
              >
                {delta >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                {Math.abs(delta).toFixed(1)}%
              </p>
            ) : hint ? (
              <p className="mt-2 truncate text-xs text-muted-foreground">{hint}</p>
            ) : null}
          </div>
          {Icon ? (
            <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-2xl', toneClass)}>
              <Icon className="h-[18px] w-[18px]" />
            </span>
          ) : null}
        </CardContent>
      </Wrapper>
    </Card>
  );
}

/**
 * Chart or list panel with a consistent header.
 *
 * Panels are plain card surfaces — white on light, near-black on dark. Colour on this
 * screen comes from icons, pills and chart series, not from the card itself.
 */
export function Panel({
  title, description, actions, children, className, contentClassName,
}: {
  title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode;
  children: React.ReactNode; className?: string; contentClassName?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0 pb-4">
        <div>
          <CardTitle>{title}</CardTitle>
          {description ? <p className="mt-0.5 text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {actions}
      </CardHeader>
      <CardContent className={contentClassName}>{children}</CardContent>
    </Card>
  );
}

export function EmptyState({
  icon: Icon, title, hint, action,
}: { icon?: LucideIcon; title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl bg-secondary/50 p-12 text-center">
      {Icon ? <Icon className="h-10 w-10 text-muted-foreground/40" /> : null}
      <p className="mt-3 font-medium">{title}</p>
      {hint ? <p className="mt-1 max-w-sm text-sm text-muted-foreground">{hint}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

/** Rendered when a route's permission check fails. */
export function ForbiddenState() {
  const { t } = useTranslation();
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <div className="text-center">
        <ShieldAlert className="mx-auto h-12 w-12 text-warning" />
        <h2 className="mt-4 text-lg font-semibold">{t('auth.forbidden')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('auth.forbiddenHint')}</p>
        <Button variant="outline" className="mt-6" onClick={() => window.history.back()}>
          {t('actions.back')}
        </Button>
      </div>
    </div>
  );
}

/** Compact key/value rows used on every detail screen. */
export function DetailList({ items }: { items: { label: React.ReactNode; value: React.ReactNode }[] }) {
  return (
    <dl className="divide-y text-sm">
      {items.map((item, i) => (
        <div key={i} className="grid grid-cols-3 gap-3 py-2.5">
          <dt className="col-span-1 text-muted-foreground">{item.label}</dt>
          <dd className="col-span-2 min-w-0 break-words font-medium">{item.value ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Status pill whose colour is derived from a shared map, so states read the same everywhere. */
const STATUS_TONE: Record<string, string> = {
  published: 'bg-success/10 text-success',
  active: 'bg-success/10 text-success',
  ready: 'bg-success/10 text-success',
  live: 'bg-danger/10 text-danger',
  pending_review: 'bg-warning/15 text-warning',
  pending: 'bg-warning/15 text-warning',
  scanning: 'bg-warning/15 text-warning',
  open: 'bg-warning/15 text-warning',
  scheduled: 'bg-accent/10 text-accent',
  draft: 'bg-muted text-muted-foreground',
  archived: 'bg-muted text-muted-foreground',
  ended: 'bg-muted text-muted-foreground',
  dismissed: 'bg-muted text-muted-foreground',
  rejected: 'bg-danger/10 text-danger',
  suspended: 'bg-danger/10 text-danger',
  deleted: 'bg-danger/10 text-danger',
  actioned: 'bg-accent/10 text-accent',
  approved: 'bg-success/10 text-success',
};

export function StatusPill({ status, label }: { status: string; label?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium',
        STATUS_TONE[status] ?? 'bg-muted text-muted-foreground',
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {label ?? status}
    </span>
  );
}

export function MetricRow({ items }: { items: { label: string; value: number | string }[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="rounded-lg bg-muted/50 p-3">
          <p className="text-xs text-muted-foreground">{item.label}</p>
          <p className="numeric mt-0.5 text-lg font-semibold">
            {typeof item.value === 'number' ? formatNumber(item.value) : item.value}
          </p>
        </div>
      ))}
    </div>
  );
}
