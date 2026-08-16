/* @flow */
'use strict';

export async function loadMemberProfileData(site, username) {
  const encoded = encodeURIComponent(username);
  const self = username === site.username;
  const cardPath = self
    ? '/native/v1/profile'
    : `/native/v1/profiles/${encoded}`;
  const [profile, activity, cardPayload] = await Promise.all([
    site.jsonApi(`/u/${encoded}.json`).catch(() => null),
    site
      .jsonApi(`/user_actions.json?username=${encoded}&filter=4,5`)
      .catch(() => ({ user_actions: [] })),
    site.jsonApi(cardPath),
  ]);
  return { profile, activity, cardPayload };
}
