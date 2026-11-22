import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Bot, BookOpen, Plus, RefreshCcw, Send, Sparkles, Trash2, User } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/app/auth';
import { useApiMutation } from '@/lib/hooks';
import { cn, formatNumber, formatRelative } from '@/lib/utils';
import { EmptyState, PageHeader, Panel, StatCard } from '@/components/data/page-parts';
import { Button } from '@/components/ui/button';
import { Badge, Card, Skeleton, Textarea } from '@/components/ui/primitives';
import { AssistantTabs } from './assistant-tabs';

/**
 * The assistant console. Every answer renders the library items it was grounded in, which
 * is the point of a RAG assistant over a curated corpus — an answer without citations is
 * not verifiable by the librarian reading it.
 */
export function AssistantPage() {
  const { t, i18n } = useTranslation();
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const lang = i18n.language;

  const [conversationId, setConversationId] = React.useState<string | undefined>();
  const [draft, setDraft] = React.useState('');
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const { data: stats } = useQuery({ queryKey: ['ai', 'stats'], queryFn: () => api.get('/ai/stats') });
  const { data: conversations } = useQuery({
    queryKey: ['ai', 'conversations'],
    queryFn: () => api.get('/ai/conversations'),
  });
  const { data: conversation, isLoading: loadingConversation } = useQuery({
    queryKey: ['ai', 'conversations', conversationId],
    queryFn: () => api.get(`/ai/conversations/${conversationId}`),
    enabled: Boolean(conversationId),
  });

  const send = useApiMutation(
    (message: string) => api.post('/ai/chat', { message, conversationId }),
    {
      onSuccess: (res: any) => {
        setConversationId(res.conversationId);
        setDraft('');
        void queryClient.invalidateQueries({ queryKey: ['ai'] });
      },
    },
  );

  const reindex = useApiMutation(() => api.post('/ai/reindex', {}), {
    onSuccess: (res: any) =>
      queryClient.invalidateQueries({ queryKey: ['ai', 'stats'] }).then(() => res),
    successMessage: undefined,
  });

  const removeConversation = useApiMutation((id: string) => api.delete(`/ai/conversations/${id}`), {
    invalidate: [['ai', 'conversations']],
    onSuccess: () => setConversationId(undefined),
  });

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [conversation?.messages?.length, send.isPending]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const message = draft.trim();
    if (message.length < 2 || send.isPending) return;
    send.mutate(message);
  };

  return (
    <>
      <PageHeader
        icon={Bot}
        tone="teal"
        title={t('assistant.title')}
        subtitle={t('assistant.subtitle')}
        actions={
          <>
            <Button variant="outline" onClick={() => { setConversationId(undefined); setDraft(''); }}>
              <Plus /> {t('assistant.newChat')}
            </Button>
            {can('ai.manage') ? (
              <Button variant="outline" loading={reindex.isPending} onClick={() => reindex.mutate(undefined)}>
                <RefreshCcw /> {t('assistant.reindex')}
              </Button>
            ) : null}
          </>
        }
      />

      <AssistantTabs active="chat" />

      {stats ? (
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label={t('assistant.conversations')} value={formatNumber(stats.conversations, lang)} icon={Bot} />
          <StatCard label={t('assistant.messages')} value={formatNumber(stats.messages, lang)} />
          <StatCard label={t('assistant.chunks')} value={formatNumber(stats.chunks, lang)} icon={BookOpen} />
          <StatCard label={t('assistant.corpus')} value={formatNumber(stats.indexed_items, lang)} />
        </section>
      ) : null}

      {stats && !stats.generationEnabled ? (
        <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <p>{t('assistant.fallbackNotice')}</p>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
        <Panel title={t('assistant.conversations')} contentClassName="p-2">
          {!conversations?.length ? (
            <p className="p-4 text-center text-sm text-muted-foreground">{t('common.noResults')}</p>
          ) : (
            <ul className="space-y-0.5">
              {conversations.map((c: any) => (
                <li key={c.id} className="group flex items-center gap-1">
                  <button
                    onClick={() => setConversationId(c.id)}
                    className={cn(
                      'min-w-0 flex-1 rounded-md px-2.5 py-2 text-start text-sm transition-colors',
                      conversationId === c.id ? 'bg-accent/10 text-accent' : 'hover:bg-secondary',
                    )}
                  >
                    <span className="line-clamp-1 font-medium">{c.title ?? '—'}</span>
                    <span className="block text-xs text-muted-foreground">
                      {formatRelative(c.created_at, lang)} · {c.message_count}
                    </span>
                  </button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={() => removeConversation.mutate(c.id)}
                    aria-label={t('actions.delete')}
                  >
                    <Trash2 className="text-danger" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Card className="flex h-[36rem] flex-col overflow-hidden">
          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
            {loadingConversation ? (
              <Skeleton className="h-32" />
            ) : !conversation?.messages?.length ? (
              <EmptyState icon={Bot} title={t('assistant.emptyChat')} hint={t('assistant.emptyChatHint')} />
            ) : (
              conversation.messages.map((m: any) => (
                <div key={m.id} className={cn('flex gap-3', m.role === 'user' && 'flex-row-reverse')}>
                  <span
                    className={cn(
                      'grid h-8 w-8 shrink-0 place-items-center rounded-full',
                      m.role === 'user' ? 'bg-secondary' : 'bg-primary text-primary-foreground',
                    )}
                  >
                    {m.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                  </span>
                  <div className={cn('max-w-[80%] min-w-0', m.role === 'user' && 'text-end')}>
                    <div
                      className={cn(
                        'inline-block whitespace-pre-wrap rounded-lg px-3.5 py-2.5 text-start text-sm leading-relaxed',
                        m.role === 'user' ? 'bg-secondary' : 'bg-muted',
                      )}
                    >
                      {m.content}
                    </div>
                    {m.sources?.length ? (
                      <div className="mt-2 space-y-1 text-start">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {t('assistant.sources')}
                        </p>
                        {m.sources.map((s: any, i: number) => (
                          <div key={s.id} className="rounded-md border bg-card p-2 text-xs">
                            <p className="flex items-center gap-1.5 font-medium">
                              <Badge variant="secondary" className="numeric text-[10px]">{i + 1}</Badge>
                              {s.title ?? '—'}
                            </p>
                            <p className="mt-1 line-clamp-2 text-muted-foreground">{s.chunk}</p>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))
            )}
            {send.isPending ? (
              <div className="flex gap-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
                  <Bot className="h-4 w-4" />
                </span>
                <div className="flex items-center gap-1 rounded-lg bg-muted px-3.5 py-3">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground"
                      style={{ animationDelay: `${i * 150}ms` }}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <form onSubmit={submit} className="flex items-end gap-2 border-t p-3">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(e); }
              }}
              rows={1}
              placeholder={t('assistant.placeholder')}
              className="min-h-[2.5rem] resize-none"
            />
            <Button type="submit" size="icon" loading={send.isPending} disabled={draft.trim().length < 2}>
              <Send className="rtl:rotate-180" />
            </Button>
          </form>
        </Card>
      </div>
    </>
  );
}
