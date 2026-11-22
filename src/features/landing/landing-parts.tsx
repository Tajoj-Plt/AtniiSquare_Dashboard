import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowUp, BadgeCheck, Bell, BookOpen, Bookmark, Bot, Building2, Clock, Download, FileText,
  FlaskConical, GraduationCap, Languages, Layers, Library, Minus, MonitorPlay, Play, Plus,
  Radio, ScrollText, ShieldCheck, Smartphone, Sparkles, Upload, Users, WifiOff,
  type LucideIcon,
} from 'lucide-react';
import { api } from '@/lib/api';
import { cn, formatDate } from '@/lib/utils';
import { CONTENT_TONES, TONES } from '@/lib/tones';
import { Button } from '@/components/ui/button';

/**
 * Icons are referenced by name in the database so an operator can change a section's icon
 * from the dashboard without a deploy. Only names in this map are renderable — an unknown
 * name falls back rather than crashing the public page.
 */
export const ICONS: Record<string, LucideIcon> = {
  Library, ShieldCheck, GraduationCap, Bot, Radio, Languages, Layers, BadgeCheck, Building2,
  BookOpen, FileText, FlaskConical, ScrollText, Upload, Users, Sparkles,
  Play, MonitorPlay, Smartphone, Download, Bookmark, Bell, Clock, WifiOff,
};
export const ICON_NAMES = Object.keys(ICONS);

export function Icon({ name, className }: { name?: string; className?: string }) {
  const Cmp = (name && ICONS[name]) || Sparkles;
  return <Cmp className={className} />;
}

/** A thin bar showing how far down the page the reader is. */
export function ScrollProgress() {
  const [pct, setPct] = React.useState(0);
  React.useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setPct(max > 0 ? Math.min(100, (window.scrollY / max) * 100) : 0);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);
  return (
    <div className="fixed inset-x-0 top-0 z-[60] h-0.5 bg-transparent" aria-hidden>
      <div
        className="h-full bg-accent transition-[width] duration-150 ease-out"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/** Appears once the reader is past the fold. */
export function BackToTop() {
  const { t } = useTranslation();
  const [show, setShow] = React.useState(false);
  React.useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 700);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label={t('actions.back')}
      className={cn(
        'fixed bottom-6 end-6 z-40 grid h-11 w-11 place-items-center rounded-full border bg-card text-foreground shadow-raised transition-all duration-300',
        show ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0',
      )}
    >
      <ArrowUp className="h-4 w-4" />
    </button>
  );
}

/**
 * Live strip of what is actually published, pulled from the same public endpoint the
 * dashboard uses. A marketing page claiming a library should show the real one — and this
 * costs nothing extra, since the endpoint is already public for published items.
 */
export function LiveLibrary() {
  const { t, i18n } = useTranslation();
  const { data, isLoading } = useQuery({
    queryKey: ['landing', 'library-preview'],
    queryFn: () => api.get('/content', { limit: 8, sort: '-published_at', filter: { status: 'published' } }),
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const items = data?.data ?? [];
  if (!isLoading && items.length === 0) return null;

  return (
    <section className="overflow-hidden bg-card py-14">
      <div className="mx-auto mb-6 w-full max-w-6xl px-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
          {t('landing.nav.library')}
        </p>
      </div>
      {/* Edge fades so the row reads as continuous rather than clipped. */}
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 start-0 z-10 w-12 from-card to-transparent ltr:bg-gradient-to-r rtl:bg-gradient-to-l" />
        <div className="pointer-events-none absolute inset-y-0 end-0 z-10 w-12 from-card to-transparent ltr:bg-gradient-to-l rtl:bg-gradient-to-r" />
        <div className="flex gap-4 overflow-x-auto px-5 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {(isLoading ? Array.from({ length: 5 }) : items).map((item: any, i: number) => (
            <article
              key={item?.id ?? i}
              className="w-64 shrink-0 rounded-3xl border bg-background p-5 transition-transform duration-300 hover:-translate-y-0.5"
            >
              {item ? (
                <>
                  <span className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium',
                    TONES[CONTENT_TONES[item.content_type as string] ?? 'blue'].chip,
                  )}>
                    <Icon
                      name={{ book: 'BookOpen', article: 'FileText', research: 'FlaskConical',
                              scientific_paper: 'ScrollText', translated_paper: 'Languages' }[item.content_type as string]}
                      className="h-3 w-3"
                    />
                    {t(`library.type.${item.content_type}`)}
                  </span>
                  <h3 className="mt-3 line-clamp-2 text-sm font-semibold leading-snug">{item.title}</h3>
                  <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                    {item.summary ?? item.abstract ?? ''}
                  </p>
                  <p className="numeric mt-3 text-[11px] text-muted-foreground">
                    {formatDate(item.published_at, i18n.language)}
                  </p>
                </>
              ) : (
                <div className="space-y-2">
                  <div className="skeleton h-5 w-20 rounded-full" />
                  <div className="skeleton h-4 w-full" />
                  <div className="skeleton h-4 w-2/3" />
                </div>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/** FAQ row; kept here so the page file stays about composition rather than mechanics. */
export function FaqRow({
  question, answer, expanded, onToggle,
}: { question: string; answer: string; expanded: boolean; onToggle: () => void }) {
  return (
    <div>
      <button
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center gap-4 p-5 text-start transition-colors hover:bg-secondary/50"
      >
        <span className="flex-1 font-medium">{question}</span>
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border text-muted-foreground">
          {expanded ? <Minus className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
        </span>
      </button>
      {/* Animating grid-template-rows reaches the content's natural height without measuring it. */}
      <div
        className="grid transition-all duration-300 ease-out"
        style={{ gridTemplateRows: expanded ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          <p className="px-5 pb-5 text-sm leading-relaxed text-muted-foreground">{answer}</p>
        </div>
      </div>
    </div>
  );
}

export { Button };
