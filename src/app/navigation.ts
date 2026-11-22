import {
  Activity, AudioLines, BadgeCheck, BookOpen, Bot, Bell, Briefcase, CalendarClock, ClipboardCheck,
  FileText, Film,
  FlaskConical, Flag, BarChart3, GraduationCap, Image, Languages, LayoutDashboard,
  LayoutTemplate, Library, ListChecks, ListMusic, MessageSquare, ScrollText, Settings, Shapes,
  ShieldCheck, Tag, Users, UserCog, Video, Award, FileCheck2,
  LayoutGrid, Megaphone, Smartphone, ToggleLeft, UsersRound, Trophy, PenLine, BookOpenCheck,
  type LucideIcon,
} from 'lucide-react';
import type { Tone } from '@/lib/tones';

export interface NavItem {
  to: string;
  labelKey: string;
  icon: LucideIcon;
  /** Categorical hue for this destination — see lib/tones.ts. */
  tone?: Tone;
  /** Any one of these permissions reveals the item. Empty means always visible. */
  permissions?: string[];
  badgeKey?: 'pendingReview' | 'openReports' | 'unreadNotifications';
}

export interface NavSection {
  titleKey: string;
  items: NavItem[];
}

/**
 * The single source of truth for navigation, the command palette and breadcrumbs.
 * Items are filtered by the signed-in user's permissions, so an account that cannot
 * moderate never sees a moderation link it would only be refused at.
 */
export const NAVIGATION: NavSection[] = [
  {
    titleKey: 'nav.sections.main',
    items: [
      { to: '/', labelKey: 'nav.overview', icon: LayoutDashboard, tone: 'indigo', permissions: ['analytics.read'] },
      { to: '/reports', labelKey: 'nav.analytics', icon: BarChart3, tone: 'violet', permissions: ['analytics.read'] },
    ],
  },
  {
    // The mobile app as its own area: what it is allowed to do, what it puts first, what it
    // tells members, and what members then did. Everything here changes the app without a
    // release, which is a different kind of authority from editing a record.
    titleKey: 'nav.sections.app',
    items: [
      { to: '/app-control/flags', labelKey: 'nav.appFlags', icon: ToggleLeft, tone: 'indigo', permissions: ['app.config.manage'] },
      { to: '/app-control/curation', labelKey: 'nav.appCuration', icon: LayoutGrid, tone: 'violet', permissions: ['app.config.manage'] },
      { to: '/app-control/broadcasts', labelKey: 'nav.appBroadcasts', icon: Megaphone, tone: 'orange', permissions: ['app.broadcast.send'] },
      { to: '/app-reports', labelKey: 'nav.appReports', icon: Smartphone, tone: 'sky', permissions: ['analytics.read'] },
    ],
  },
  {
    // The questions of the app's Activities tab: one page per slider, each item a question
    // with a cover and a sponsor that members answer from the app.
    titleKey: 'nav.sections.activities',
    items: [
      { to: '/activities/challenge', labelKey: 'nav.activitiesChallenge', icon: Trophy, tone: 'amber', permissions: ['app.config.manage'] },
      { to: '/activities/writing', labelKey: 'nav.activitiesWriting', icon: PenLine, tone: 'violet', permissions: ['app.config.manage'] },
      { to: '/activities/reading', labelKey: 'nav.activitiesReading', icon: BookOpenCheck, tone: 'teal', permissions: ['app.config.manage'] },
    ],
  },
  {
    // Who the platform is for and about, pulled out of the administration list and the
    // taxonomy/community screens it used to hide in: app members are the audience the app
    // exists for, and pages are the institutions and publishers that audience follows.
    // Sits directly above Content, since both feed it.
    titleKey: 'nav.sections.audience',
    items: [
      { to: '/app-members', labelKey: 'nav.appMembers', icon: Users, tone: 'sky', permissions: ['user.read'] },
      // The request trail behind a member's blue tick (profiles.verified) — sits with the
      // audience it is about, not under Administration's moderation tools: this reviews
      // member identity claims, not content or reports.
      { to: '/verification-requests', labelKey: 'nav.verification', icon: ShieldCheck, tone: 'sky', permissions: ['user.manage'] },
      { to: '/pages', labelKey: 'nav.pages', icon: BadgeCheck, tone: 'sky', permissions: ['content.read'] },
    ],
  },
  {
    titleKey: 'nav.sections.content',
    items: [
      { to: '/content', labelKey: 'nav.content', icon: Library, tone: 'blue', permissions: ['content.read'] },
      { to: '/content/books', labelKey: 'nav.books', icon: BookOpen, tone: 'amber', permissions: ['content.read'] },
      { to: '/content/articles', labelKey: 'nav.articles', icon: FileText, tone: 'blue', permissions: ['content.read'] },
      { to: '/content/research', labelKey: 'nav.research', icon: FlaskConical, tone: 'violet', permissions: ['content.read'] },
      { to: '/content/scientific_papers', labelKey: 'nav.scientific_papers', icon: ScrollText, tone: 'teal', permissions: ['content.read'] },
      { to: '/content/translated_papers', labelKey: 'nav.translated_papers', icon: Languages, tone: 'rose', permissions: ['content.read'] },
      { to: '/content/graduation_projects', labelKey: 'nav.graduation_projects', icon: GraduationCap, tone: 'orange', permissions: ['content.read'] },
      { to: '/content/video', labelKey: 'nav.video', icon: Film, tone: 'indigo', permissions: ['content.read'] },
      { to: '/content/audio', labelKey: 'nav.audio', icon: AudioLines, tone: 'emerald', permissions: ['content.read'] },
      // Playlists and reading series: the ordered sets the items above are filed under.
      { to: '/content/groups', labelKey: 'nav.groups', icon: ListMusic, tone: 'violet', permissions: ['content.read'] },
      // Short videos, past papers and funding calls are catalogued material too — they were
      // filed under community and learning, where nobody looking for content would find them.
      { to: '/content/shorts', labelKey: 'nav.shorts', icon: Video, tone: 'rose', permissions: ['content.read'] },
      { to: '/content/exams', labelKey: 'nav.exams', icon: FileCheck2, tone: 'sky', permissions: ['content.read'] },
      { to: '/content/scholarships', labelKey: 'nav.scholarships', icon: Award, tone: 'emerald', permissions: ['content.read'] },
      { to: '/media', labelKey: 'nav.media', icon: Image, tone: 'orange', permissions: ['media.upload'] },
    ],
  },
  {
    titleKey: 'nav.sections.community',
    items: [
      { to: '/posts', labelKey: 'nav.posts', icon: MessageSquare, tone: 'violet', permissions: ['content.read'] },
      { to: '/comments', labelKey: 'nav.comments', icon: MessageSquare, tone: 'violet', permissions: ['content.read'] },
      // "Events" is what a member sees in the app; "rooms" was the table's name.
      { to: '/events', labelKey: 'nav.events', icon: CalendarClock, tone: 'rose', permissions: ['content.read'] },
      // Reading groups and discussion spaces members create in the app (one `spaces` table).
      { to: '/spaces', labelKey: 'nav.spaces', icon: UsersRound, tone: 'teal', permissions: ['space.moderate'] },
    ],
  },
  {
    titleKey: 'nav.sections.learning',
    items: [
      { to: '/courses', labelKey: 'nav.courses', icon: GraduationCap, tone: 'amber', permissions: ['content.read'] },
      { to: '/enrollments', labelKey: 'nav.enrollments', icon: ListChecks, tone: 'amber', permissions: ['enrollment.read.any'] },
      { to: '/assistant', labelKey: 'nav.assistant', icon: Bot, tone: 'teal', permissions: ['ai.use'] },
    ],
  },
  {
    titleKey: 'nav.sections.administration',
    items: [
      { to: '/moderation/queue', labelKey: 'nav.queue', icon: ClipboardCheck, tone: 'rose', permissions: ['content.moderate'], badgeKey: 'pendingReview' },
      { to: '/moderation/reports', labelKey: 'nav.reports', icon: Flag, tone: 'rose', permissions: ['report.read'], badgeKey: 'openReports' },
      { to: '/moderation/actions', labelKey: 'nav.actions', icon: Activity, tone: 'rose', permissions: ['report.read'] },
      // Split from one flat "Users" list: dashboard staff (who run the platform) and
      // app members (who registered in the app) are different populations that no
      // longer share an RBAC role — see db/16_account_kind.sql. App members moved to
      // their own "Audience" section, above, alongside Pages.
      { to: '/dashboard-users', labelKey: 'nav.dashboardUsers', icon: Briefcase, tone: 'indigo', permissions: ['user.read'] },
      { to: '/roles', labelKey: 'nav.roles', icon: UserCog, tone: 'indigo', permissions: ['user.read'] },
      { to: '/interests', labelKey: 'nav.interests', icon: Shapes, tone: 'emerald', permissions: ['content.read'] },
      { to: '/tags', labelKey: 'nav.tags', icon: Tag, tone: 'emerald', permissions: ['content.read'] },
      { to: '/authors', labelKey: 'nav.authors', icon: Users, tone: 'sky', permissions: ['content.read'] },
      { to: '/notifications', labelKey: 'nav.notifications', icon: Bell, tone: 'orange', permissions: ['notification.send'] },
      { to: '/landing-editor', labelKey: 'nav.landingEditor', icon: LayoutTemplate, tone: 'violet', permissions: ['landing.manage'] },
      { to: '/audit', labelKey: 'nav.audit', icon: ScrollText, tone: 'ink', permissions: ['audit.read'] },
      { to: '/settings', labelKey: 'nav.settings', icon: Settings },
    ],
  },
];

export function flattenNavigation(): NavItem[] {
  return NAVIGATION.flatMap((s) => s.items);
}
