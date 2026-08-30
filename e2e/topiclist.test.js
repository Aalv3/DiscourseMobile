import { by, device, element, waitFor } from 'detox';

describe('Adjuster Network authentication boundary', () => {
  beforeAll(async () => {
    await device.launchApp({
      delete: true,
      newInstance: true,
      permissions: { notifications: 'YES' },
    });
  });

  it('starts secure member authentication from the only logged-out CTA', async () => {
    const signIn = element(by.text('Member sign in'));
    await waitFor(signIn).toBeVisible().withTimeout(60000);
    await signIn.tap();

    // CI cannot approve a real production User API Key request. Reaching the
    // busy state proves the CTA crossed into the canonical asynchronous auth
    // path; callback allowlisting and the exact scope contract are exercised
    // deterministically by Jest without fabricating an authenticated member.
    await waitFor(element(by.text('Signing in…')))
      .toBeVisible()
      .withTimeout(10000);
  });
});
