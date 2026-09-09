/* @flow */
'use strict';

import DiscourseUtils from './DiscourseUtils';
import { classifyFirstPartyMemberRoute } from './nativeMemberRouting';

export const GRANTED_BADGE = 12;

// Longest badge name we will render. Discourse badge names are short; this only
// bounds a hostile or corrupted payload, it is not a product limit.
const MAX_BADGE_NAME = 120;

// Intent resolution starts from the notification payload, not from the URL
// DiscourseUtils builds. That conversion is lossy: a granted_badge becomes
// /badges/:id/basic?username=:u and badge_name is discarded. Reading the
// payload first is what makes a native badge destination possible at all.
export function notificationIntent(
  site,
  notification,
  { authenticated = false, isStaff = false } = {},
) {
  if (!authenticated || !notification) return { kind: 'unavailable' };

  if (notification.notification_type === GRANTED_BADGE) {
    const name = badgeName(notification);
    // A badge notification with no usable name has nothing to present
    // natively, so it takes the same bounded state as any other gap.
    return name ? { kind: 'badge', badge: { name } } : { kind: 'unavailable' };
  }

  const url = DiscourseUtils.endpointForSiteNotification(site, notification);
  const route = classifyFirstPartyMemberRoute(url, { authenticated, isStaff });
  switch (route.disposition) {
    case 'native':
      return { kind: 'native', screen: route.screen, params: route.params };
    case 'privileged_external':
      // Staff-only /admin. Admin has no native surface and the boundary is
      // enforced in classifyFirstPartyMemberRoute, which returns this
      // disposition only when isStaff is true. This is the single documented
      // external handoff; it does not widen external navigation for members.
      return { kind: 'staff_external', url: route.url };
    default:
      return { kind: 'unavailable' };
  }
}

function badgeName(notification) {
  const value = notification?.data?.badge_name;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_BADGE_NAME) return null;
  return trimmed;
}
