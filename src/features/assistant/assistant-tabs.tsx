import { useTranslation } from 'react-i18next';
import { useAuth } from '@/app/auth';
import { SectionTabs } from '@/features/app-control/app-control-parts';

/**
 * The assistant area's tab strip: the chat console and the knowledge index.
 *
 * Only someone who can manage the index has a second tab to go to, so everybody else sees
 * no strip at all — the same rule the app-control tabs follow.
 */
export function AssistantTabs({ active }: { active: 'chat' | 'index' }) {
  const { t } = useTranslation();
  const { can } = useAuth();
  if (!can('ai.manage')) return null;
  return (
    <SectionTabs
      base="/assistant"
      active={active}
      tabs={[
        { key: 'chat', label: t('assistant.tabs.chat') },
        { key: 'index', label: t('assistant.tabs.index') },
      ]}
    />
  );
}
