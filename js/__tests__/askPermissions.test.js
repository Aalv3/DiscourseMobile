/* @flow */
'use strict';

import { askableCategories } from '../product/ProductData';

describe('Ask category permissions', () => {
  test('only exposes categories Discourse marks full/create-topic allowed', () => {
    expect(
      askableCategories([
        { id: 1, permission: 1 },
        { id: 2, permission: 2 },
        { id: 3, permission: 3 },
        { id: 4 },
      ]),
    ).toEqual([{ id: 1, permission: 1 }]);
  });

  test('fails closed for missing or malformed category state', () => {
    expect(askableCategories()).toEqual([]);
    expect(askableCategories({ permission: 1 })).toEqual([]);
  });
});
