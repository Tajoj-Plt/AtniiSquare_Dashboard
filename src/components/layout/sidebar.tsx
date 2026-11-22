import * as React from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import { NAVIGATION } from '@/app/navigation';
import { useAuth } from '@/app/auth';
import { cn, formatNumber } from '@/lib/utils';
import { TONES } from '@/lib/tones';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/overlays';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  /** Icon-only rail. Desktop only — the mobile drawer always shows labels. */
  collapsed: boolean;
  onToggleCollapse: () => void;
  badges: { pendingReview?: number; openReports?: number; unreadNotifications?: number };
}

export function Sidebar({ open, onClose, collapsed, onToggleCollapse, badges }: SidebarProps) {
  const { t, i18n } = useTranslation();
  const { canAny } = useAuth();

  const sections = React.useMemo(
    () =>
      NAVIGATION.map((section) => ({
        ...section,
        items: section.items.filter((item) => !item.permissions?.length || canAny(...item.permissions)),
      })).filter((section) => section.items.length > 0),
    [canAny],
  );

  // Collapsing is a desktop affordance: the mobile rail is a drawer that is either fully
  // open or gone, so squeezing it to icons there would trade labels for nothing.
  const iconOnly = collapsed;

  return (
    <>
      {/* Scrim for the mobile drawer. */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-foreground/40 backdrop-blur-[1px] transition-opacity lg:hidden',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={onClose}
        aria-hidden
      />
      <aside
        className={cn(
          'fixed inset-y-0 start-0 z-50 flex w-64 flex-col bg-sidebar text-sidebar-foreground',
          'transition-[transform,width] duration-200 lg:static lg:inset-y-auto lg:h-[calc(100vh-2rem)] lg:rounded-panel lg:border lg:shadow-panel',
          iconOnly && 'lg:w-[4.75rem]',
          open ? 'translate-x-0' : 'max-lg:ltr:-translate-x-full max-lg:rtl:translate-x-full',
        )}
      >
        <div className={cn('flex h-16 shrink-0 items-center gap-2 px-4', iconOnly && 'lg:justify-center lg:px-0')}>
          <NavLink to="/" className="flex items-center gap-2.5" onClick={onClose}>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-accent text-lg font-bold text-white">
              س
            </span>
            <span className={cn('leading-tight', iconOnly && 'lg:hidden')}>
              <span className="block text-sm font-semibold text-foreground">{t('app.name')}</span>
              <span className="block text-[11px] text-sidebar-foreground/60">{t('app.dashboard')}</span>
            </span>
          </NavLink>
          <Button variant="ghost" size="icon-sm" className="ms-auto lg:hidden" onClick={onClose} aria-label={t('actions.close')}>
            <X />
          </Button>
        </div>

        <nav className={cn('flex-1 overflow-y-auto px-3 py-3', iconOnly && 'lg:px-2')} aria-label={t('app.dashboard')}>
          {sections.map((section) => (
            <div key={section.titleKey} className="mb-4 last:mb-0">
              {/* A section header would not fit the rail, so collapsed mode marks the same
                  grouping with a rule — the structure survives, the words do not. */}
              <p className={cn(
                'px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-foreground/40',
                iconOnly && 'lg:hidden',
              )}>
                {t(section.titleKey)}
              </p>
              {iconOnly ? <div className="mx-2 mb-2 hidden h-px bg-border lg:block" aria-hidden /> : null}

              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const badge = item.badgeKey ? badges[item.badgeKey] : undefined;
                  const row = (
                    <NavLink
                      to={item.to}
                      end={item.to === '/' || item.to === '/content'}
                      onClick={onClose}
                      className={({ isActive }) =>
                        cn(
                          'group relative flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                          iconOnly && 'lg:justify-center lg:px-0',
                          isActive
                            ? 'bg-foreground/[0.07] text-foreground'
                            : 'text-sidebar-foreground/80 hover:bg-foreground/5 hover:text-foreground',
                        )
                      }
                    >
                      {({ isActive }: { isActive: boolean }) => (
                        <>
                          {isActive ? (
                            <span
                              aria-hidden
                              className={cn(
                                'absolute inset-y-1.5 start-0 w-1 rounded-full',
                                TONES[item.tone ?? 'blue'].dot,
                              )}
                            />
                          ) : null}
                          <span className="relative shrink-0">
                            <item.icon
                              className={cn(
                                'h-[18px] w-[18px] transition-colors',
                                isActive
                                  ? TONES[item.tone ?? 'blue'].chip.split(' ').filter((c) => c.startsWith('text-')).join(' ')
                                  : 'text-sidebar-foreground/50 group-hover:text-foreground',
                              )}
                            />
                            {/* Collapsed, there is no room for a count — a dot still says
                                "something is waiting here", which is the actionable part. */}
                            {badge && iconOnly ? (
                              <span className="absolute -end-1 -top-1 hidden h-2 w-2 rounded-full bg-danger ring-2 ring-sidebar lg:block" />
                            ) : null}
                          </span>
                          <span className={cn('truncate', iconOnly && 'lg:hidden')}>{t(item.labelKey)}</span>
                          {badge ? (
                            <span className={cn(
                              'numeric ms-auto rounded-full bg-danger px-1.5 py-0.5 text-[10px] font-semibold text-danger-foreground',
                              iconOnly && 'lg:hidden',
                            )}>
                              {formatNumber(badge, i18n.language)}
                            </span>
                          ) : null}
                        </>
                      )}
                    </NavLink>
                  );

                  return (
                    <li key={item.to}>
                      {iconOnly ? (
                        // The label has to remain reachable when it is not on screen.
                        <Tooltip>
                          <TooltipTrigger asChild>{row}</TooltipTrigger>
                          <TooltipContent side={i18n.dir() === 'rtl' ? 'left' : 'right'}>
                            {t(item.labelKey)}
                            {badge ? ` · ${formatNumber(badge, i18n.language)}` : ''}
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        row
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className={cn('shrink-0 p-3', iconOnly && 'lg:px-2')}>
          <button
            onClick={onToggleCollapse}
            aria-label={collapsed ? t('nav.expand') : t('nav.collapse')}
            title={collapsed ? t('nav.expand') : t('nav.collapse')}
            className={cn(
              'hidden w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-sidebar-foreground/70',
              'transition-colors hover:bg-foreground/5 hover:text-foreground lg:flex',
              iconOnly && 'lg:justify-center lg:px-0',
            )}
          >
            {collapsed
              ? <PanelLeftOpen className="h-[18px] w-[18px] shrink-0 rtl:rotate-180" />
              : <PanelLeftClose className="h-[18px] w-[18px] shrink-0 rtl:rotate-180" />}
            <span className={cn(iconOnly && 'lg:hidden')}>{t('nav.collapse')}</span>
          </button>
          <p className={cn('px-1 pt-2 text-[11px] text-sidebar-foreground/40', iconOnly && 'lg:hidden')}>
            {t('app.tagline')}
          </p>
        </div>
      </aside>
    </>
  );
}
