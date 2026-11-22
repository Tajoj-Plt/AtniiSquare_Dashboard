import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BadgeCheck, Eye, Shapes, Tag, Users } from 'lucide-react';
import { formatDate, formatNumber } from '@/lib/utils';
import { Badge } from '@/components/ui/primitives';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/overlays';
import { CrudPage } from './crud-page';
import { CrudFormPage, type CrudConfig } from './crud-form';

/** Interests — the taxonomy the feed, onboarding and library filters are built on. */
function useInterestsConfig(): CrudConfig {
  const { t } = useTranslation();
  return {
    queryKey: 'interests',
    path: '/interests',
    route: '/interests',
    title: t('taxonomy.interestsTitle'),
    tone: 'emerald',
    icon: Shapes,
    writePermission: 'interest.manage',
    fields: [
        { name: 'name', label: t('taxonomy.nameAr'), required: true },
        { name: 'name_en', label: t('taxonomy.nameEn') },
        { name: 'slug', label: t('taxonomy.slug'), required: true, dir: 'ltr', hint: 'lower-kebab-case' },
        { name: 'icon', label: t('taxonomy.icon'), dir: 'ltr' },
      ],
  };
}

export function InterestsPage() {
  const { t, i18n } = useTranslation();
  const config = useInterestsConfig();
  return (
    <CrudPage
      {...config}
      path="/interests"
      tone="emerald"
      defaultSort="name"
      columns={[
        { key: 'name', header: t('taxonomy.nameAr'), sortable: true, cell: (r: any) => <span className="font-medium">{r.name}</span> },
        { key: 'name_en', header: t('taxonomy.nameEn'), hideBelow: 'sm', cell: (r: any) => r.name_en ?? '—' },
        { key: 'slug', header: t('taxonomy.slug'), hideBelow: 'md', cell: (r: any) => <code className="text-xs text-muted-foreground">{r.slug}</code> },
        { key: 'content_count', header: t('taxonomy.items'), className: 'numeric', cell: (r: any) => formatNumber(r.content_count, i18n.language) },
        { key: 'follower_count', header: t('taxonomy.followers'), className: 'numeric', hideBelow: 'sm', cell: (r: any) => formatNumber(r.follower_count, i18n.language) },
      ]}

    />
  );
}

export function InterestsFormPage() {
  return <CrudFormPage config={useInterestsConfig()} />;
}


function useTagsConfig(): CrudConfig {
  const { t } = useTranslation();
  return {
    queryKey: 'tags',
    path: '/tags',
    route: '/tags',
    title: t('taxonomy.tagsTitle'),
    tone: 'emerald',
    icon: Tag,
    writePermission: 'interest.manage',
    fields: [
        { name: 'name', label: t('taxonomy.nameAr'), required: true },
        { name: 'name_en', label: t('taxonomy.nameEn') },
        { name: 'slug', label: t('taxonomy.slug'), required: true, dir: 'ltr' },
        { name: 'show_in_library', label: t('taxonomy.showInLibrary'), type: 'switch' },
      ],
  };
}

export function TagsPage() {
  const { t, i18n } = useTranslation();
  const config = useTagsConfig();
  return (
    <CrudPage
      {...config}
      path="/tags"
      tone="emerald"
      defaultSort="name"
      columns={[
        { key: 'name', header: t('taxonomy.nameAr'), sortable: true, cell: (r: any) => <span className="font-medium">{r.name}</span> },
        { key: 'name_en', header: t('taxonomy.nameEn'), hideBelow: 'sm', cell: (r: any) => r.name_en ?? '—' },
        { key: 'slug', header: t('taxonomy.slug'), hideBelow: 'md', cell: (r: any) => <code className="text-xs text-muted-foreground">{r.slug}</code> },
        { key: 'content_count', header: t('taxonomy.items'), className: 'numeric', cell: (r: any) => formatNumber(r.content_count, i18n.language) },
      ]}

    />
  );
}

export function TagsFormPage() {
  return <CrudFormPage config={useTagsConfig()} />;
}


function useAuthorsConfig(): CrudConfig {
  const { t } = useTranslation();
  return {
    queryKey: 'authors',
    path: '/authors',
    route: '/authors',
    title: t('taxonomy.authorsTitle'),
    tone: 'sky',
    icon: Users,
    writePermission: 'content.create',
    fields: [
        { name: 'full_name', label: t('common.name'), required: true },
        { name: 'full_name_en', label: t('taxonomy.nameEn') },
        { name: 'affiliation', label: t('taxonomy.affiliation') },
        { name: 'orcid', label: t('taxonomy.orcid'), dir: 'ltr' },
      ],
  };
}

export function AuthorsPage() {
  const { t, i18n } = useTranslation();
  const config = useAuthorsConfig();
  return (
    <CrudPage
      {...config}
      path="/authors"
      tone="sky"
      defaultSort="full_name"
      columns={[
        { key: 'full_name', header: t('common.name'), sortable: true, cell: (r: any) => <span className="font-medium">{r.full_name}</span> },
        { key: 'affiliation', header: t('taxonomy.affiliation'), hideBelow: 'sm', cell: (r: any) => r.affiliation ?? '—' },
        { key: 'orcid', header: t('taxonomy.orcid'), hideBelow: 'lg', cell: (r: any) => <code className="text-xs">{r.orcid ?? '—'}</code> },
        { key: 'content_count', header: t('taxonomy.items'), className: 'numeric', cell: (r: any) => formatNumber(r.content_count, i18n.language) },
      ]}

    />
  );
}

export function AuthorsFormPage() {
  return <CrudFormPage config={useAuthorsConfig()} />;
}


/** Institutional and publisher pages. */
function usePagesConfig(): CrudConfig {
  const { t } = useTranslation();
  return {
    queryKey: 'pages',
    path: '/pages',
    route: '/pages',
    title: t('taxonomy.pagesTitle'),
    tone: 'sky',
    icon: BadgeCheck,
    writePermission: 'page.manage',
    fields: [
        { name: 'name', label: t('common.name'), required: true },
        {
          name: 'kind', label: t('taxonomy.kind'), type: 'select',
          options: [
            { value: 'institution', label: 'Institution' },
            { value: 'publisher', label: 'Publisher' },
            { value: 'community', label: 'Community' },
          ],
        },
        { name: 'description', label: t('common.details'), type: 'textarea' },
        { name: 'website_url', label: t('taxonomy.website'), type: 'url', dir: 'ltr' },
        { name: 'verified', label: t('taxonomy.verified'), type: 'switch' },
      ],
  };
}

export function PagesPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const config = usePagesConfig();
  return (
    <CrudPage
      {...config}
      path="/pages"
      tone="sky"
      writePermission="page.manage"
      extraRowActions={() => [
        { label: t('actions.view'), icon: Eye, onSelect: (row: any) => navigate(`/pages/${row.id}`) },
      ]}
      columns={[
        {
          key: 'name', header: t('common.name'), sortable: true,
          cell: (r: any) => (
            <Link to={`/pages/${r.id}`} className="flex items-center gap-1.5 font-medium hover:underline">
              {r.name}
              {r.verified ? <BadgeCheck className="h-4 w-4 text-accent" /> : null}
            </Link>
          ),
        },
        { key: 'kind', header: t('taxonomy.kind'), cell: (r: any) => <Badge variant="secondary">{r.kind}</Badge> },
        { key: 'owner_name', header: t('common.author'), hideBelow: 'md', cell: (r: any) => r.owner_name ?? '—' },
        { key: 'content_count', header: t('taxonomy.items'), className: 'numeric', hideBelow: 'sm', cell: (r: any) => formatNumber(r.content_count, i18n.language) },
        { key: 'follower_count', header: t('taxonomy.followers'), className: 'numeric', hideBelow: 'lg', cell: (r: any) => formatNumber(r.follower_count, i18n.language) },
        { key: 'created_at', header: t('common.createdAt'), sortable: true, hideBelow: 'xl', className: 'numeric', cell: (r: any) => formatDate(r.created_at, i18n.language) },
      ]}


      filters={(list) => (
        <Select value={list.state.filter.kind ?? 'all'} onValueChange={(v) => list.setFilter('kind', v)}>
          <SelectTrigger className="w-[10rem]"><SelectValue placeholder={t('taxonomy.kind')} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('common.all')}</SelectItem>
            <SelectItem value="institution">Institution</SelectItem>
            <SelectItem value="publisher">Publisher</SelectItem>
            <SelectItem value="community">Community</SelectItem>
          </SelectContent>
        </Select>
      )}
    />
  );
}

export function PagesFormPage() {
  return <CrudFormPage config={usePagesConfig()} />;
}
