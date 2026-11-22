import * as React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bell, Check, ChevronRight, Languages, LogOut, Menu, Monitor, Moon, Search, Settings, Sun, User,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/app/auth';
import { useTheme, type Theme } from '@/app/theme';
import { applyLanguage, LANGUAGES } from '@/lib/i18n';
import { flattenNavigation } from '@/app/navigation';
import { cn, formatRelative } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, Badge } from '@/components/ui/primitives';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
  DropdownMenuTrigger, Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/overlays';

export function Topbar({ onMenu, onSearch }: { onMenu: () => void; onSearch: () => void }) {
  const { t } = useTranslation();
  const location = useLocation();

  const crumb = React.useMemo(() => {
    const items = flattenNavigation();
    const match = items
      .filter((i) => i.to !== '/' && location.pathname.startsWith(i.to))
      .sort((a, b) => b.to.length - a.to.length)[0];
    return match ? t(match.labelKey) : t('nav.overview');
  }, [location.pathname, t]);

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 bg-card/90 px-4 backdrop-blur-md sm:px-6">
      <Button variant="ghost" size="icon-sm" className="lg:hidden" onClick={onMenu} aria-label={t('app.dashboard')}>
        <Menu />
      </Button>

      <nav aria-label="breadcrumb" className="hidden min-w-0 items-center gap-1.5 text-sm text-muted-foreground sm:flex">
        <Link to="/" className="hover:text-foreground">{t('app.name')}</Link>
        <ChevronRight className="h-3.5 w-3.5 shrink-0 rtl:rotate-180" />
        <span className="truncate font-medium text-foreground">{crumb}</span>
      </nav>

      <button
        onClick={onSearch}
        className="ms-auto flex h-10 items-center gap-2 rounded-full bg-secondary px-4 text-sm text-muted-foreground transition-colors hover:bg-secondary/70 sm:w-60"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="hidden truncate sm:inline">{t('search.placeholder')}</span>
        <kbd className="ms-auto hidden rounded-md bg-card px-1.5 py-0.5 font-mono text-[10px] sm:inline">⌘K</kbd>
      </button>

      <LanguageToggle />
      <ThemeToggle />
      <NotificationsMenu />
      <UserMenu />
    </header>
  );
}

function LanguageToggle() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();

  const change = async (code: string) => {
    applyLanguage(code);
    // Persist the choice on the account so it follows the user to another device.
    if (user) await api.patch('/auth/me/preferences', { locale: code }).catch(() => undefined);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={t('settings.language')}>
          <Languages />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {LANGUAGES.map((lang) => (
          <DropdownMenuItem key={lang.code} onSelect={() => void change(lang.code)}>
            {i18n.language === lang.code ? <Check className="h-4 w-4" /> : <span className="w-4" />}
            {lang.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ThemeToggle() {
  const { t } = useTranslation();
  const { theme, resolved, setTheme } = useTheme();
  const { user } = useAuth();

  const change = async (next: Theme) => {
    setTheme(next);
    if (user) await api.patch('/auth/me/preferences', { theme: next }).catch(() => undefined);
  };

  const options: { value: Theme; icon: typeof Sun; labelKey: string }[] = [
    { value: 'light', icon: Sun, labelKey: 'settings.themes.light' },
    { value: 'dark', icon: Moon, labelKey: 'settings.themes.dark' },
    { value: 'system', icon: Monitor, labelKey: 'settings.themes.system' },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={t('settings.theme')}>
          {resolved === 'dark' ? <Moon /> : <Sun />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {options.map((opt) => (
          <DropdownMenuItem key={opt.value} onSelect={() => void change(opt.value)}>
            {theme === opt.value ? <Check className="h-4 w-4" /> : <opt.icon className="h-4 w-4" />}
            {t(opt.labelKey)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NotificationsMenu() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ['notifications', 'me'],
    queryFn: () => api.get('/notifications/me', { limit: 12 }),
    refetchInterval: 60_000,
  });

  const markRead = useMutation({
    mutationFn: () => api.post('/notifications/me/read', {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications', 'me'] }),
  });

  const unread = data?.unread ?? 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="relative" aria-label={t('notifications.title')}>
          <Bell />
          {unread > 0 ? (
            <span className="numeric absolute -end-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-semibold text-danger-foreground">
              {unread > 9 ? '9+' : unread}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0">
        <div className="flex items-center justify-between border-b p-3">
          <p className="text-sm font-semibold">{t('notifications.title')}</p>
          {unread > 0 ? (
            <Button variant="ghost" size="sm" onClick={() => markRead.mutate()} loading={markRead.isPending}>
              {t('notifications.markAllRead')}
            </Button>
          ) : null}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {!data?.data?.length ? (
            <p className="p-6 text-center text-sm text-muted-foreground">{t('notifications.empty')}</p>
          ) : (
            data.data.map((n: any) => (
              <div key={n.id} className={cn('border-b p-3 last:border-0', !n.read_at && 'bg-accent/5')}>
                <div className="flex items-start justify-between gap-2">
                  <Badge variant="secondary" className="shrink-0">{n.type}</Badge>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {formatRelative(n.created_at, i18n.language)}
                  </span>
                </div>
                {n.payload?.title ? <p className="mt-1.5 text-sm">{n.payload.title}</p> : null}
                {n.payload?.reason ? (
                  <p className="mt-0.5 text-xs text-muted-foreground">{n.payload.reason}</p>
                ) : null}
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function UserMenu() {
  const { t } = useTranslation();
  const { user, signOut } = useAuth();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 rounded-full bg-secondary py-1 pe-3 ps-1 transition-colors hover:bg-secondary/70">
          <Avatar src={user?.avatar_url} name={user?.full_name ?? user?.email} />
          <span className="hidden max-w-[8rem] truncate text-sm font-medium sm:inline">
            {user?.full_name ?? user?.email}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <p className="truncate text-sm font-medium text-foreground">{user?.full_name ?? '—'}</p>
          <p className="truncate text-xs font-normal">{user?.email}</p>
        </DropdownMenuLabel>
        <div className="flex flex-wrap gap-1 px-2 pb-2">
          {user?.roles.map((role) => (
            <Badge key={role} variant="secondary" className="text-[10px]">{role}</Badge>
          ))}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/settings"><User className="h-4 w-4" />{t('settings.profile')}</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/settings"><Settings className="h-4 w-4" />{t('nav.settings')}</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem destructive onSelect={() => void signOut()}>
          <LogOut className="h-4 w-4" />{t('actions.signOut')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
