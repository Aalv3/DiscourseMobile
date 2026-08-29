/* @flow */
'use strict';

export default function debounce(callback, delay) {
  let timer = null;

  return function debounced(...args) {
    if (timer !== null) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      timer = null;
      callback.apply(this, args);
    }, delay);
  };
}
