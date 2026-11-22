import * as React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft, Ban, Check, Copy, KeyRound, Save, ShieldCheck, Trash2,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/app/auth';
import { useApiMutation } from '@/lib/hooks';
import { formatDate, formatRelative } from '@/lib/utils';
import { DetailList, PageHeader, Panel, StatusPill } from '@/components/data/page-parts';
import { Button } from '@/components/ui/button';
import { Badge, Checkbox, Field, Input, Label, Skeleton } from '@/components/ui/primitives';
import { ConfirmDialog, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/overlays';

/**
 * One dashboard (staff) account — identity, status and the role that grants access, plus
 * the API tokens that can be issued on it. No demographics, interests or social graph
 * here: those belong to `AppMemberDetailPage`, the mobile-member half of what used to be
 * one combined `/users/:id` (see db/16_account_kind.sql).
 */
export function DashboardUserDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { can, user: me } = useAuth();
  const [suspending, setSuspending] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [resetting, setResetting] = React.useState(false);
  const [newPassword, setNewPassword] = React.useState('');

  const { data: user, isLoading } = useQuery({
    queryKey: ['dashboardUsers', id],
    queryFn: () => api.get(`/dashboard-users/${id}`),
  });
  const { data: roles } = useQuery({ queryKey: ['roles'], queryFn: () => api.get('/roles') });
  const { i18n } = useTranslation();
  const lang = i18n.language;

  const [selectedRoles, setSelectedRoles] = React.useState<string[]>([]);
  React.useEffect(() => {
    if (user) setSelectedRoles((user.roles ?? []).map((r: any) => r.slug));
  }, [user]);

  const invalidate = [['dashboardUsers', id!], ['dashboardUsers']];

  const assign = useApiMutation(
    () => api.post(`/dashboard-users/${id}/roles`, { roles: selectedRoles }),
    { successMessage: t('users.rolesUpdated'), invalidate },
  );

  const setStatus = useApiMutation(
    (status: 'active' | 'suspended') => api.post(`/dashboard-users/${id}/status`, { status }),
    { successMessage: t('users.updated'), invalidate, onSuccess: () => setSuspending(false) },
  );

  const resetPassword = useApiMutation(
    () => api.post(`/dashboard-users/${id}/password`, { password: newPassword }),
    { successMessage: t('auth.passwordChanged'), onSuccess: () => { setResetting(false); setNewPassword(''); } },
  );

  const remove = useApiMutation(() => api.delete(`/dashboard-users/${id}`), {
    successMessage: t('library.deleted'),
    invalidate: [['dashboardUsers']],
    onSuccess: () => navigate('/dashboard-users'),
  });

  if (isLoading || !user) return <><Skeleton className="h-8 w-64" /><Skeleton className="h-64" /></>;

  const dirty =
    JSON.stringify([...selectedRoles].sort()) !==
    JSON.stringify((user.roles ?? []).map((r: any) => r.slug).sort());
  const isSelf = user.id === me?.id;

  return (
    <>
      <PageHeader
        title={user.full_name ?? user.email ?? '—'}
        subtitle={user.email ?? user.phone ?? undefined}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {can('user.manage') && user.status === 'active' && !isSelf ? (
              <Button variant="outline" onClick={() => setSuspending(true)}><Ban /> {t('actions.suspend')}</Button>
            ) : null}
            {can('user.manage') && user.status !== 'active' ? (
              <Button variant="outline" onClick={() => setStatus.mutate('active')} loading={setStatus.isPending}>
                <ShieldCheck /> {t('actions.restore')}
              </Button>
            ) : null}
            {can('user.manage') && !isSelf ? (
              <Button variant="outline" onClick={() => setDeleting(true)}><Trash2 className="text-danger" /> {t('actions.delete')}</Button>
            ) : null}
            <Button variant="outline" onClick={() => navigate('/dashboard-users')}>
              <ArrowLeft className="rtl:rotate-180" /> {t('actions.back')}
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={t('common.details')}>
          <DetailList
            items={[
              { label: t('common.email'), value: <span dir="ltr">{user.email ?? '—'}</span> },
              { label: t('common.phone'), value: <span dir="ltr">{user.phone ?? '—'}</span> },
              { label: t('common.status'), value: <StatusPill status={user.status} label={t(`users.status.${user.status}`)} /> },
              { label: t('settings.language'), value: user.locale?.toUpperCase() },
              { label: t('users.lastLogin'), value: formatDate(user.last_login_at, lang, true) },
              { label: t('common.createdAt'), value: formatDate(user.created_at, lang, true) },
            ]}
          />
          {can('user.manage') ? (
            <div className="mt-4 flex justify-end border-t pt-4">
              <Button variant="outline" size="sm" onClick={() => setResetting(true)}>
                <KeyRound /> {t('users.resetPassword')}
              </Button>
            </div>
          ) : null}
        </Panel>

        <Panel
          title={t('users.assignRoles')}
          description={t('roles.subtitle')}
          actions={
            can('role.manage') ? (
              <Button size="sm" disabled={!dirty} loading={assign.isPending} onClick={() => assign.mutate(undefined)}>
                <Save /> {t('actions.save')}
              </Button>
            ) : null
          }
        >
          <div className="grid gap-2 sm:grid-cols-2">
            {(roles ?? []).map((role: any) => (
              <label
                key={role.slug}
                className="flex cursor-pointer items-start gap-2.5 rounded-md border p-2.5 transition-colors hover:bg-secondary/50"
              >
                <Checkbox
                  className="mt-0.5"
                  disabled={!can('role.manage')}
                  checked={selectedRoles.includes(role.slug)}
                  onCheckedChange={(checked) =>
                    setSelectedRoles((prev) =>
                      checked ? [...prev, role.slug] : prev.filter((s) => s !== role.slug))
                  }
                />
                <span className="min-w-0">
                  <Label className="cursor-pointer">{lang === 'ar' ? role.name : (role.name_en ?? role.slug)}</Label>
                  <p className="line-clamp-2 text-xs text-muted-foreground">{role.description ?? role.slug}</p>
                </span>
              </label>
            ))}
          </div>
        </Panel>
      </div>

      {can('user.manage') ? <TokensPanel userId={id!} /> : null}

      <Dialog open={resetting} onOpenChange={setResetting}>
        <DialogContent size="sm">
          <DialogHeader><DialogTitle>{t('users.resetPassword')}</DialogTitle></DialogHeader>
          <Field label={t('auth.newPassword')} required hint="10+ chars, upper + lower + digit">
            <Input type="password" dir="ltr" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetting(false)}>{t('actions.cancel')}</Button>
            <Button loading={resetPassword.isPending} onClick={() => resetPassword.mutate(undefined)}>
              {t('actions.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={suspending}
        onOpenChange={setSuspending}
        title={t('users.suspendTitle')}
        description={t('users.suspendBody')}
        confirmLabel={t('actions.suspend')}
        cancelLabel={t('actions.cancel')}
        loading={setStatus.isPending}
        onConfirm={() => setStatus.mutate('suspended')}
      />
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={t('common.confirmDelete')}
        description={user.email}
        confirmLabel={t('actions.delete')}
        cancelLabel={t('actions.cancel')}
        loading={remove.isPending}
        onConfirm={() => remove.mutate(undefined)}
      />
    </>
  );
}

/** API tokens on a staff account. The secret appears once, when it is minted. */
function TokensPanel({ userId }: { userId: string }) {
  const { t, i18n } = useTranslation();
  const [name, setName] = React.useState('');
  const [fresh, setFresh] = React.useState<any | null>(null);
  const [copied, setCopied] = React.useState(false);

  const { data: tokens, refetch } = useQuery({
    queryKey: ['dashboardUsers', userId, 'tokens'],
    queryFn: () => api.get(`/dashboard-users/${userId}/tokens`),
  });

  const issue = useApiMutation(
    () => api.post(`/dashboard-users/${userId}/tokens`, { name: name || undefined }),
    {
      successMessage: t('users.tokens.issued'),
      onSuccess: (row: any) => { setFresh(row); setName(''); setCopied(false); void refetch(); },
    },
  );
  const revoke = useApiMutation(
    (tokenId: string) => api.delete(`/dashboard-users/${userId}/tokens/${tokenId}`),
    { successMessage: t('users.tokens.revoked'), onSuccess: () => { void refetch(); } },
  );

  return (
    <Panel title={t('users.tokens.title')} description={t('users.tokens.explainer')}>
      {fresh ? (
        <div className="mb-4 space-y-2 rounded-2xl border border-warning/40 bg-warning/10 p-4">
          <p className="text-sm font-medium">{t('users.tokens.onceWarning')}</p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-xl bg-card px-3 py-2 font-mono text-sm" dir="ltr">
              {fresh.token}
            </code>
            <Button
              variant="outline" size="sm"
              onClick={() => { void navigator.clipboard?.writeText(fresh.token); setCopied(true); }}
            >
              {copied ? <Check /> : <Copy />} {t(copied ? 'users.tokens.copied' : 'actions.copy')}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap items-end gap-2">
        <Field className="min-w-[14rem] flex-1" label={t('users.tokens.name')}>
          <Input value={name} placeholder={t('users.tokens.namePlaceholder')} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Button loading={issue.isPending} onClick={() => issue.mutate(undefined)}>
          <KeyRound /> {t('users.tokens.issueNow')}
        </Button>
      </div>

      {(tokens ?? []).length ? (
        <ul className="divide-y rounded-2xl border">
          {tokens.map((token: any) => (
            <li key={token.id} className="flex flex-wrap items-center gap-3 p-3">
              <code className="rounded-lg bg-secondary px-2 py-1 font-mono text-xs" dir="ltr">{token.prefix}…</code>
              <span className="text-sm font-medium">{token.name}</span>
              <span className="text-xs text-muted-foreground">
                {t('users.tokens.lastUsed')}:{' '}
                {token.last_used_at ? formatRelative(token.last_used_at, i18n.language) : t('users.tokens.never')}
              </span>
              {token.inactive ? <Badge variant="muted">{t('users.tokens.revokedLabel')}</Badge> : null}
              {!token.inactive ? (
                <Button
                  variant="ghost" size="sm" className="ms-auto"
                  loading={revoke.isPending}
                  onClick={() => revoke.mutate(token.id)}
                >
                  <Trash2 className="text-danger" /> {t('users.tokens.revoke')}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{t('users.tokens.none')}</p>
      )}
    </Panel>
  );
}
