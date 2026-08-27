import { by, device, element, expect } from 'detox';

describe('Adjuster Network logged-out launch', () => {
  beforeEach(async () => {
    await device.launchApp({
      delete: true,
      newInstance: true,
      permissions: { notifications: 'YES' },
    });
  });

  it('shows the branded private-member landing experience', async () => {
    await expect(element(by.label('Adjuster Network'))).toBeVisible();
    await expect(
      element(by.text('The private professional network built for adjusters.')),
    ).toBeVisible();
    await expect(element(by.text('Members only'))).toBeVisible();
    await expect(element(by.text('Invitation-only membership'))).toBeVisible();
    await expect(element(by.label('Member sign in'))).toBeVisible();
  });

  it('keeps privacy and invitation boundaries visible before sign-in', async () => {
    await expect(
      element(
        by.text(
          'Membership is currently available by invitation. Existing members can sign in above.',
        ),
      ),
    ).toBeVisible();
    await expect(
      element(
        by.text(
          'Never post names, policy numbers, addresses, photos, or other claim-identifying information.',
        ),
      ),
    ).toBeVisible();

    // The product-owned logged-out experience replaced upstream DiscourseMobile
    // site discovery. Those controls must not leak back onto the launch screen.
    await expect(element(by.id('nav-plus-icon'))).not.toExist();
  });
});
