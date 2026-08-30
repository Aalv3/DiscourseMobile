import { by, device, element, expect, waitFor } from 'detox';

describe('Adjuster Network logged-out launch', () => {
  beforeEach(async () => {
    await device.launchApp({
      delete: true,
      newInstance: true,
      permissions: { notifications: 'YES' },
    });
  });

  it('shows the branded private-member landing experience', async () => {
    const landingHeadline = element(
      by.text('The private professional network built for adjusters.'),
    );

    await waitFor(landingHeadline).toBeVisible().withTimeout(60000);
    await expect(element(by.text('Members only'))).toBeVisible();
    await expect(element(by.text('Invitation-only membership'))).toBeVisible();
    await expect(element(by.label('Member sign in'))).toBeVisible();
  });

  it('keeps privacy and invitation boundaries visible before sign-in', async () => {
    const welcomeScroll = element(by.id('logged-out-welcome-scroll'));
    const invitation = element(
      by.text(
        'Membership is currently available by invitation. Existing members can sign in above.',
      ),
    );
    const privacy = element(
      by.text(
        'Never post names, policy numbers, addresses, photos, or other claim-identifying information.',
      ),
    );

    await waitFor(welcomeScroll).toExist().withTimeout(60000);
    await waitFor(invitation)
      .toBeVisible()
      .whileElement(by.id('logged-out-welcome-scroll'))
      .scroll(250, 'down');
    await waitFor(privacy)
      .toBeVisible()
      .whileElement(by.id('logged-out-welcome-scroll'))
      .scroll(150, 'down');

    // The product-owned logged-out experience replaced upstream DiscourseMobile
    // site discovery. Those controls must not leak back onto the launch screen.
    await expect(element(by.id('nav-plus-icon'))).not.toExist();
  });
});
