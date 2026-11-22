import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Check, Monitor, Moon, Settings as SettingsIcon, Sun, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/app/auth';
import { useTheme, type Theme } from '@/app/theme';
import { applyLanguage, LANGUAGES } from '@/lib/i18n';
import { useApiMutation, useForm } from '@/lib/hooks';
import { cn, formatDate } from '@/lib/utils';
import { DetailList, PageHeader, Panel } from '@/components/data/page-parts';
import { Button } from '@/components/ui/button';
import { Avatar, Badge, Field, Input } from '@/components/ui/primitives';

export function SettingsPage() {
  const { t, i18n } = useTranslation();
  const { user, refreshIdentity } = useAuth();
  const { theme, setTheme } = useTheme();
  const lang = i18n.language;

  const { data: sessions, refetch: refetchSessions } = useQuery({
    queryKey: ['auth', 'sessions'],
    queryFn: () => api.get('/auth/me/sessions'),
  });

  const password = useForm({ currentPassword: '', newPassword: '' });
  const changePassword = useApiMutation(() => api.post('/auth/me/password', password.values), {
    successMessage: t('auth.passwordChanged'),
    onSuccess: () => { password.reset(); void refetchSessions(); },
  });

  const savePreference = useApiMutation(
    (prefs: { locale?: string; theme?: string }) => api.patch('/auth/me/preferences', prefs),
    { successMessage: t('settings.saved'), onSuccess: () => void refreshIdentity() },
  );

  const revoke = useApiMutation((id: string) => api.delete(`/auth/me/sessions/${id}`), {
    onSuccess: () => void refetchSessions(),
  });

  const themes: { value: Theme; icon: typeof Sun; labelKey: string }[] = [
    { value: 'light', icon: Sun, labelKey: 'settings.themes.light' },
    { value: 'dark', icon: Moon, labelKey: 'settings.themes.dark' },
    { value: 'system', icon: Monitor, labelKey: 'settings.themes.system' },
  ];

  return (
    <>
      <PageHeader icon={SettingsIcon} tone="ink" title={t('settings.title')} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={t('settings.profile')}>
          <div className="mb-4 flex items-center gap-3">
            <Avatar src={user?.avatar_url} name={user?.full_name ?? user?.email} className="h-12 w-12" />
            <div className="min-w-0">
              <p className="truncate font-medium">{user?.full_name ?? '—'}</p>
              <p className="truncate text-sm text-muted-foreground" dir="ltr">{user?.email}</p>
            </div>
          </div>
          <div className="mb-4 flex flex-wrap gap-1.5">
            {user?.roles.map((role) => <Badge key={role} variant="secondary">{role}</Badge>)}
          </div>
          <DetailList
            items={[
              { label: t('common.phone'), value: <span dir="ltr">{user?.phone ?? '—'}</span> },
              { label: t('users.lastLogin'), value: formatDate(user?.last_login_at, lang, true) },
              { label: t('roles.permissionCount', { count: user?.permissions.length ?? 0 }), value: user?.permissions.length ?? 0 },
            ]}
          />
        </Panel>

        <Panel title={t('settings.appearance')}>
          <Field label={t('settings.theme')}>
            <div className="grid grid-cols-3 gap-2">
              {themes.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => { setTheme(opt.value); savePreference.mutate({ theme: opt.value }); }}
                  className={cn(
                    'flex flex-col items-center gap-2 rounded-lg border p-3 text-sm transition-all',
                    theme === opt.value ? 'border-accent bg-accent/5 shadow-soft' : 'hover:bg-secondary',
                  )}
                >
                  <opt.icon className="h-5 w-5" />
                  {t(opt.labelKey)}
                  {theme === opt.value ? <Check className="h-3.5 w-3.5 text-accent" /> : null}
                </button>
              ))}
            </div>
          </Field>

          <Field className="mt-5" label={t('settings.language')}>
            <div className="grid grid-cols-2 gap-2">
              {LANGUAGES.map((l) => (
                <button
                  key={l.code}
                  onClick={() => { applyLanguage(l.code); savePreference.mutate({ locale: l.code }); }}
                  className={cn(
                    'flex items-center justify-center gap-2 rounded-lg border p-3 text-sm transition-all',
                    lang === l.code ? 'border-accent bg-accent/5 shadow-soft' : 'hover:bg-secondary',
                  )}
                >
                  {l.label}
                  {lang === l.code ? <Check className="h-3.5 w-3.5 text-accent" /> : null}
                </button>
              ))}
            </div>
          </Field>
        </Panel>

        <Panel title={t('auth.changePassword')}>
          <div className="grid gap-4">
            <Field label={t('auth.currentPassword')} required error={password.errors.currentPassword}>
              <Input
                type="password" dir="ltr" autoComplete="current-password"
                value={password.values.currentPassword}
                onChange={(e) => password.set('currentPassword', e.target.value)}
              />
            </Field>
            <Field
              label={t('auth.newPassword')} required error={password.errors.newPassword}
              hint="10+ characters, mixing upper case, lower case and digits"
            >
              <Input
                type="password" dir="ltr" autoComplete="new-password"
                value={password.values.newPassword}
                onChange={(e) => password.set('newPassword', e.target.value)}
              />
            </Field>
            <Button
              className="justify-self-start"
              loading={changePassword.isPending}
              disabled={!password.values.currentPassword || !password.values.newPassword}
              onClick={() => changePassword.mutate(undefined, { onError: password.applyApiError })}
            >
              {t('auth.changePassword')}
            </Button>
          </div>
        </Panel>

        <Panel title={t('auth.sessions')}>
          <ul className="divide-y text-sm">
            {(sessions ?? []).slice(0, 10).map((s: any) => (
              <li key={s.id} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-xs" dir="ltr">{s.user_agent ?? t('common.unknown')}</p>
                  <p className="numeric text-xs text-muted-foreground" dir="ltr">
                    {s.ip ?? '—'} · {formatDate(s.issued_at, lang, true)}
                  </p>
                </div>
                {s.revoked_at ? (
                  <Badge variant="muted" className="shrink-0">revoked</Badge>
                ) : (
                  <Button
                    variant="ghost" size="icon-sm"
                    onClick={() => revoke.mutate(s.id)}
                    aria-label={t('auth.revokeSession')}
                  >
                    <Trash2 className="text-danger" />
                  </Button>
                )}
              </li>
            ))}
            {!sessions?.length ? <li className="py-4 text-muted-foreground">{t('common.noResults')}</li> : null}
          </ul>
        </Panel>
      </div>
    </>
  );
}
