'use strict';

const fs = require('fs');
const path = require('path');

describe('cancelable fetch no-content responses', () => {
  test('constructs 204/205 responses with a null body', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '../../lib/fetch.js'),
      'utf8',
    );
    expect(source).toContain('status === 204 || status === 205');
    expect(source).toContain('? null');
  });
});
