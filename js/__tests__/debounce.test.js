/* @flow */
'use strict';

import debounce from '../../lib/debounce';

describe('dependency-free debounce', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('runs only the latest call after the bounded delay', () => {
    const callback = jest.fn();
    const debounced = debounce(callback, 750);

    debounced('first');
    jest.advanceTimersByTime(500);
    debounced('latest');
    jest.advanceTimersByTime(749);
    expect(callback).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith('latest');
  });
});
