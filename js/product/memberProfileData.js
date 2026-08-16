/* @flow */
'use strict';

export async function loadMemberProfileData(site, username) {
  const encoded = encodeURIComponent(username);
  const profile = await site.jsonApi(`/u/${encoded}.json`);
  const [activity, cardPayload] = await Promise.all([
    site
      .jsonApi(`/user_actions.json?username=${encoded}&filter=4,5`)
      .catch(() => ({ user_actions: [] })),
    site
      .jsonApi(
        username === site.username
          ? '/native/v1/profile'
          : `/native/v1/profile/${encoded}`,
      )
      .catch(() => null),
  ]);
  return { profile, activity, cardPayload };
}
