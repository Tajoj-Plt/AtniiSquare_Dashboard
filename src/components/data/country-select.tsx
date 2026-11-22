import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ChevronsUpDown, Globe, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { COUNTRY_CODES, COUNTRY_PRIORITY_COUNT, countryFlag, countryName } from '@/lib/countries';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/primitives';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/overlays';

/**
 * A searchable country picker.
 *
 * The plain Select in this kit is fine for five options and unusable for two hundred and
 * fifty, so this pairs a popover with a filter box. Matching is on the localised name *and*
 * the code, because an operator who knows the country types "Sudan", "السودان" or "SD"
 * depending on which keyboard is in front of them and all three should work.
 */
export function CountrySelect({
  value, onChange, allowClear = true, placeholder, id,
}: {
  value?: string | null;
  onChange: (code: string | null) => void;
  allowClear?: boolean;
  placeholder?: string;
  id?: string;
}) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [open, setOpen] = React.useState(false);
  const [term, setTerm] = React.useState('');

  const options = React.useMemo(
    () => COUNTRY_CODES.map((code, i) => ({
      code,
      name: countryName(code, lang),
      flag: countryFlag(code),
      priority: i < COUNTRY_PRIORITY_COUNT,
    })),
    [lang],
  );

  const shown = React.useMemo(() => {
    const q = term.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.name.toLowerCase().includes(q) || o.code.toLowerCase().includes(q));
  }, [options, term]);

  const selected = value ? options.find((o) => o.code === value) : undefined;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setTerm('');
      }}
    >
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className="flex min-w-0 items-center gap-2">
            {selected ? (
              <>
                <span aria-hidden>{selected.flag}</span>
                <span className="truncate">{selected.name}</span>
              </>
            ) : (
              <>
                <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate text-muted-foreground">
                  {placeholder ?? t('users.demographics.countryPlaceholder')}
                </span>
              </>
            )}
          </span>
          <span className="flex items-center gap-1">
            {selected && allowClear ? (
              <span
                role="button"
                tabIndex={-1}
                aria-label={t('actions.clear', { defaultValue: 'Clear' })}
                onClick={(e) => {
                  // Stops the popover opening on the same click that clears the value.
                  e.preventDefault();
                  e.stopPropagation();
                  onChange(null);
                }}
                className="grid h-5 w-5 place-items-center rounded-full hover:bg-foreground/10"
              >
                <X className="h-3 w-3" />
              </span>
            ) : null}
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </span>
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <div className="flex items-center gap-2 border-b px-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Input
            autoFocus
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder={t('search.placeholder', { defaultValue: 'Search…' })}
            className="h-10 border-0 px-0 shadow-none focus-visible:ring-0"
          />
        </div>
        <ul className="max-h-72 overflow-y-auto p-1" role="listbox">
          {shown.length ? shown.map((o, i) => (
            <React.Fragment key={o.code}>
              {/* One rule under the shortlist, but only when nothing is being searched —
                  mid-search the split is meaningless and the line just adds noise. */}
              {!term && i === COUNTRY_PRIORITY_COUNT ? <li className="my-1 border-t" aria-hidden /> : null}
              <li>
                <button
                  type="button"
                  role="option"
                  aria-selected={value === o.code}
                  onClick={() => {
                    onChange(o.code);
                    setOpen(false);
                  }}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-start text-sm transition-colors',
                    value === o.code ? 'bg-accent/10 text-accent' : 'hover:bg-secondary',
                  )}
                >
                  <span aria-hidden>{o.flag}</span>
                  <span className="min-w-0 flex-1 truncate">{o.name}</span>
                  <span className="numeric text-xs text-muted-foreground">{o.code}</span>
                  {value === o.code ? <Check className="h-4 w-4" /> : null}
                </button>
              </li>
            </React.Fragment>
          )) : (
            <li className="px-2 py-6 text-center text-sm text-muted-foreground">{t('common.noResults')}</li>
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
