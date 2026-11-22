/**
 * Where a polymorphic (target_type, target_id) pair actually opens in the dashboard.
 * Shared by the member and page detail pages so a comment, a like or a share always
 * lands on the same route a moderator browsing that surface directly would use.
 * Returns null for a target kind with nowhere sensible to go (e.g. a reaction on a
 * comment) — the caller renders that row as plain text rather than a dead link.
 */
export function targetRoute(targetType: string, targetId: string): string | null {
  switch (targetType) {
    case 'post': return `/posts/${targetId}`;
    case 'content_item': return `/content/item/${targetId}`;
    case 'reel': return `/content/shorts/${targetId}/edit`;
    case 'course': return `/courses/${targetId}`;
    case 'event':
    case 'live_room': return `/events/${targetId}/edit`;
    default: return null;
  }
}
