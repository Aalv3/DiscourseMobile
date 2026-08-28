/* @flow */
'use strict';

export async function consumePendingShareIntent({
  siteManager,
  navigation,
  navigationReady,
  nativeModule,
  openUrl,
}) {
  const authenticated = siteManager
    .listSites()
    .find(candidate => candidate.authToken);
  if (!authenticated) return { disposition: 'deferred_auth' };
  if (!navigationReady || !navigation)
    return { disposition: 'deferred_navigation' };
  const intent = await nativeModule?.consumeShareIntent?.();
  if (!intent) return { disposition: 'empty' };
  if (intent.kind === 'url') {
    openUrl(intent.value);
    return { disposition: 'opened_url', id: intent.id };
  }
  if (intent.kind === 'text') {
    navigation.navigate('HomeWrapper', {
      screen: 'Ask',
      params: { sharedText: intent.value, shareIntentId: intent.id },
    });
    return { disposition: 'opened_ask', id: intent.id };
  }
  if (intent.kind === 'image') {
    navigation.navigate('HomeWrapper', {
      screen: 'Ask',
      params: {
        sharedImage: {
          uri: intent.uri,
          name: intent.name,
          mimeType: intent.mime_type,
          fileSize: intent.size,
          sharedFilename: intent.value,
        },
        shareIntentId: intent.id,
      },
    });
    return { disposition: 'opened_ask', id: intent.id };
  }
  return { disposition: 'invalid' };
}
