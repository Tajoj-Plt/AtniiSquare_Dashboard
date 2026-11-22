import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CornerDownLeft, Search } from 'lucide-react';
import { NAVIGATION } from '@/app/navigation';
import { useAuth } from '@/app/auth';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/overlays';

/** ⌘K / Ctrl+K jump-to-page, filtered by the caller's permissions. */
export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { canAny } = useAuth();
  const [query, setQuery] = React.useState('');
  const [active, setActive] = React.useState(0);

  const entries = React.useMemo(() => {
    const all = NAVIGATION.flatMap((section) =>
      section.items
        .filter((item) => !item.permissions?.length || canAny(...item.permissions))
        .map((item) => ({ ...item, section: t(section.titleKey), label: t(item.labelKey) })),
    );
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter((e) => e.label.toLowerCase().includes(q) || e.to.includes(q));
  }, [query, canAny, t]);

  React.useEffect(() => setActive(0), [query]);
  React.useEffect(() => { if (open) setQuery(''); }, [open]);

  const go = (to: string) => {
    onOpenChange(false);
    navigate(to);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-24 translate-y-0 p-0" size="md">
        <DialogTitle className="sr-only">{t('search.placeholder')}</DialogTitle>
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, entries.length - 1)); }
              if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
              if (e.key === 'Enter' && entries[active]) { e.preventDefault(); go(entries[active].to); }
            }}
            placeholder={t('search.placeholder')}
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {entries.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">{t('search.noMatches')}</p>
          ) : (
            entries.map((entry, i) => (
              <button
                key={entry.to}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(entry.to)}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
                  i === active ? 'bg-secondary' : 'hover:bg-secondary/60',
                )}
              >
                <entry.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="font-medium">{entry.label}</span>
                <span className="ms-auto text-xs text-muted-foreground">{entry.section}</span>
                {i === active ? <CornerDownLeft className="h-3.5 w-3.5 text-muted-foreground" /> : null}
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
