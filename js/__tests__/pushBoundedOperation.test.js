import { boundedPushOperation } from '../pushBoundedOperation';

describe('bounded push operations', () => {
  afterEach(() => jest.useRealTimers());

  test('times out, runs cleanup once, and ignores a late resolution', async () => {
    jest.useFakeTimers();
    let resolveLate;
    const cleanup = jest.fn();
    const pending = boundedPushOperation(
      () =>
        new Promise(resolve => {
          resolveLate = resolve;
        }),
      { timeoutMs: 25, timeoutCode: 'bounded_timeout', onTimeout: cleanup },
    );
    await Promise.resolve();
    jest.advanceTimersByTime(25);
    await expect(pending).rejects.toThrow('bounded_timeout');
    resolveLate('late');
    await Promise.resolve();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  test('clears timeout cleanup after an operation settles', async () => {
    jest.useFakeTimers();
    const cleanup = jest.fn();
    await expect(
      boundedPushOperation(() => Promise.resolve('done'), {
        timeoutMs: 25,
        timeoutCode: 'bounded_timeout',
        onTimeout: cleanup,
      }),
    ).resolves.toBe('done');
    jest.advanceTimersByTime(25);
    expect(cleanup).not.toHaveBeenCalled();
  });
});
