import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowRight, Check, Copy, KeyRound, Save, ShieldCheck, UserPlus } from 'lucide-react';
import { api } from '@/lib/api';
import { useApiMutation, useForm } from '@/lib/hooks';
import { PageHeader } from '@/components/data/page-parts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, Field, Input, Label, Switch } from '@/components/ui/primitives';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/overlays';

/**
 * Creating a dashboard (staff) account — the dashboard's "Add user".
 *
 * Deliberately one short form, not the member wizard: identity, the role that grants
 * access, and credentials. No demographic or interest steps — those exist for the
 * reporting layer to segment app members by, and a staff account is never part of
 * that population.
 */
export function DashboardUserFormPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const lang = i18n.language;
  const [result, setResult] = React.useState<any | null>(null);
  const [copied, setCopied] = React.useState<string | null>(null);

  const { data: roles } = useQuery({ queryKey: ['roles'], queryFn: () => api.get('/roles') });

  const form = useForm<Record<string, any>>({
    full_name: '', email: '', phone: '', password: '', locale: 'ar',
    role: 'academic_supervisor',
    issue_token: false, token_name: '',
  });

  const create = useApiMutation(
    () => api.post('/dashboard-users', {
      full_name: form.values.full_name.trim(),
      email: form.values.email.trim(),
      phone: form.values.phone || undefined,
      password: form.values.password || undefined,
      locale: form.values.locale,
      roles: [form.values.role],
      issue_token: form.values.issue_token,
      token_name: form.values.token_name || undefined,
    }),
    {
      successMessage: t('users.created'),
      invalidate: [['dashboardUsers']],
      onSuccess: (row: any) => {
        // Either credential that only exists once (a generated password, an issued API
        // token) has to be shown before anything navigates away.
        if (row?.generated_password || row?.api_token) setResult(row);
        else navigate(`/dashboard-users/${row.id}`);
      },
    },
  );

  const copy = (label: string, value: string) => {
    void navigator.clipboard?.writeText(value);
    setCopied(label);
  };

  if (result) {
    return (
      <>
        <PageHeader
          icon={KeyRound}
          tone="emerald"
          title={t('users.tokens.issuedTitle')}
          subtitle={t('users.tokens.issuedSubtitle')}
        />
        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="rounded-2xl border border-warning/40 bg-warning/10 p-4 text-sm">
              {t('users.tokens.onceWarning')}
            </div>
            {result.generated_password ? (
              <div>
                <p className="mb-1.5 text-sm font-medium">{t('users.generatedPassword')}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded-xl bg-secondary px-3 py-2.5 font-mono text-sm" dir="ltr">
                    {result.generated_password}
                  </code>
                  <Button variant="outline" onClick={() => copy('password', result.generated_password)}>
                    {copied === 'password' ? <Check /> : <Copy />} {t(copied === 'password' ? 'users.tokens.copied' : 'actions.copy')}
                  </Button>
                </div>
              </div>
            ) : null}
            {result.api_token ? (
              <div>
                <p className="mb-1.5 text-sm font-medium">{t('users.tokens.title')}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded-xl bg-secondary px-3 py-2.5 font-mono text-sm" dir="ltr">
                    {result.api_token.token}
                  </code>
                  <Button variant="outline" onClick={() => copy('token', result.api_token.token)}>
                    {copied === 'token' ? <Check /> : <Copy />} {t(copied === 'token' ? 'users.tokens.copied' : 'actions.copy')}
                  </Button>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
        <div className="flex justify-end">
          <Button onClick={() => navigate(`/dashboard-users/${result.id}`)}>
            {t('users.tokens.goToAccount')} <ArrowRight className="rtl:rotate-180" />
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        icon={UserPlus}
        tone="indigo"
        title={t('users.newUser')}
        subtitle={t('nav.dashboardUsers')}
        actions={
          <Button variant="outline" onClick={() => navigate('/dashboard-users')}>
            <ArrowLeft className="rtl:rotate-180" /> {t('actions.back')}
          </Button>
        }
      />

      <Card>
        <CardContent className="space-y-6 p-5 sm:p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <Field className="md:col-span-2" label={t('common.name')} required error={form.errors.full_name}>
              <Input value={form.values.full_name} onChange={(e) => form.set('full_name', e.target.value)} autoFocus />
            </Field>
            <Field label={t('common.email')} required error={form.errors.email}>
              <Input type="email" dir="ltr" value={form.values.email} onChange={(e) => form.set('email', e.target.value)} />
            </Field>
            <Field label={t('common.phone')} error={form.errors.phone}>
              <Input dir="ltr" placeholder="+249…" value={form.values.phone} onChange={(e) => form.set('phone', e.target.value)} />
            </Field>
            <Field label={t('users.role')} required hint={t('users.dashboardRoleHint')}>
              <Select value={form.values.role} onValueChange={(v) => form.set('role', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(roles ?? []).map((r: any) => (
                    <SelectItem key={r.slug} value={r.slug}>{lang === 'ar' ? r.name : (r.name_en ?? r.slug)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={t('common.language')}>
              <Select value={form.values.locale} onValueChange={(v) => form.set('locale', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ar">العربية</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field
              className="md:col-span-2"
              label={t('auth.password')}
              error={form.errors.password}
              hint={t('users.passwordHint')}
            >
              <Input type="password" dir="ltr" value={form.values.password} onChange={(e) => form.set('password', e.target.value)} />
            </Field>
          </div>

          <div className="space-y-3 border-t pt-5">
            <div className="flex items-start gap-3 rounded-2xl border bg-secondary/40 p-4">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{t('users.tokens.explainer')}</p>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id="issue-token"
                checked={Boolean(form.values.issue_token)}
                onCheckedChange={(v) => form.set('issue_token', v)}
              />
              <Label htmlFor="issue-token" className="cursor-pointer text-sm font-normal">
                {t('users.tokens.issueNow')}
              </Label>
            </div>
            {form.values.issue_token ? (
              <Field label={t('users.tokens.name')} hint={t('users.tokens.nameHint')}>
                <Input
                  value={form.values.token_name}
                  placeholder={t('users.tokens.namePlaceholder')}
                  onChange={(e) => form.set('token_name', e.target.value)}
                />
              </Field>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          loading={create.isPending}
          onClick={() => create.mutate(undefined, { onError: (err) => form.applyApiError(err) })}
        >
          <Save /> {t('actions.save')}
        </Button>
      </div>
    </>
  );
}
