import { initialPushNotification } from '../initialPushNotification';

describe('initial push notification acquisition', () => {
  afterEach(() => jest.useRealTimers());

  test('returns a valid wrapper notification unchanged', async () => {
    const notification = { data: { an: { route: '/t/safe/1' } } };
    await expect(
      initialPushNotification(
        { getInitialNotification: () => Promise.resolve(notification) },
        25,
      ),
    ).resolves.toBe(notification);
  });

  test('fails closed when the wrapper rejects', async () => {
    await expect(
      initialPushNotification(
        { getInitialNotification: () => Promise.reject(new Error('private')) },
        25,
      ),
    ).resolves.toBeNull();
  });

  test('fails closed when the wrapper never settles', async () => {
    jest.useFakeTimers();
    const pending = initialPushNotification(
      { getInitialNotification: () => new Promise(() => {}) },
      25,
    );
    await Promise.resolve();
    jest.advanceTimersByTime(25);
    await expect(pending).resolves.toBeNull();
  });
});
