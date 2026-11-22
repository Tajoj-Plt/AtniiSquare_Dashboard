import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * A free-text list entered as chips — keywords, people, technologies.
 *
 * Enter, Tab or a comma commits the current text; the Arabic comma "،" does too, because
 * an operator typing names in Arabic reaches for it without thinking and would otherwise
 * produce one chip holding three names. Pasting a comma-separated list splits it.
 * Backspace on an empty input removes the last chip.
 */
export function ChipInput({
  value, onChange, placeholder, max, dir, id, invalid,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  max?: number;
  dir?: 'ltr' | 'rtl';
  id?: string;
  invalid?: boolean;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = React.useState('');
  const list = Array.isArray(value) ? value : [];
  const full = max != null && list.length >= max;

  const commit = (text: string) => {
    const parts = text.split(/[,،\n]/).map((s) => s.trim()).filter(Boolean);
    if (!parts.length) return;
    const next = [...list];
    for (const p of parts) {
      if (max != null && next.length >= max) break;
      if (!next.some((x) => x.toLowerCase() === p.toLowerCase())) next.push(p);
    }
    onChange(next);
    setDraft('');
  };

  return (
    <div
      className={cn(
        'flex min-h-10 flex-wrap items-center gap-1.5 rounded-xl border bg-secondary/40 px-2 py-1.5',
        'focus-within:ring-2 focus-within:ring-ring',
        invalid && 'border-danger',
      )}
    >
      {list.map((chip, i) => (
        <span key={`${chip}-${i}`} className="inline-flex items-center gap-1 rounded-full bg-card px-2.5 py-0.5 text-sm shadow-soft">
          <span dir={dir}>{chip}</span>
          <button
            type="button"
            aria-label={t('actions.remove')}
            onClick={() => onChange(list.filter((_, j) => j !== i))}
            className="rounded-full p-0.5 text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        id={id}
        dir={dir}
        value={draft}
        disabled={full}
        placeholder={list.length ? undefined : placeholder}
        onChange={(e) => {
          const v = e.target.value;
          // A separator typed at the end commits immediately, like a tag field should.
          if (/[,،]$/.test(v)) commit(v);
          else setDraft(v);
        }}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === 'Tab') && draft.trim()) {
            e.preventDefault();
            commit(draft);
          } else if (e.key === 'Backspace' && !draft && list.length) {
            onChange(list.slice(0, -1));
          }
        }}
        onPaste={(e) => {
          const text = e.clipboardData.getData('text');
          if (/[,،\n]/.test(text)) {
            e.preventDefault();
            commit(draft + text);
          }
        }}
        onBlur={() => draft.trim() && commit(draft)}
        className="min-w-[8rem] flex-1 bg-transparent px-1 py-0.5 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
      />
      {max != null ? (
        <span className="numeric ms-auto text-[11px] text-muted-foreground">{list.length}/{max}</span>
      ) : null}
    </div>
  );
}
