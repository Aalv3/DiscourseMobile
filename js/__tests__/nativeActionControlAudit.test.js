/* @flow */
'use strict';

import fs from 'fs';
import path from 'path';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';

const ROOTS = ['product', 'screens'];
const ACTION_COMPONENTS = new Set([
  'Action',
  'Button',
  'Pressable',
  'TouchableOpacity',
  'TouchableWithoutFeedback',
]);

const sourceFiles = root =>
  fs.readdirSync(root, { withFileTypes: true }).flatMap(entry => {
    const target = path.join(root, entry.name);
    return entry.isDirectory()
      ? sourceFiles(target)
      : /\.(?:ios\.|android\.)?js$/.test(entry.name)
      ? [target]
      : [];
  });

describe('native actionable-control launch audit', () => {
  test('every reachable native action component has a callable press boundary', () => {
    const missing = [];
    let audited = 0;
    ROOTS.flatMap(root =>
      sourceFiles(path.join(__dirname, '..', root)),
    ).forEach(file => {
      const ast = parse(fs.readFileSync(file, 'utf8'), {
        sourceType: 'module',
        plugins: ['flow', 'jsx', 'optionalChaining'],
      });
      traverse(ast, {
        JSXOpeningElement(nodePath) {
          const name = nodePath.node.name;
          if (
            name.type !== 'JSXIdentifier' ||
            !ACTION_COMPONENTS.has(name.name)
          )
            return;
          audited += 1;
          const attributes = nodePath.node.attributes;
          const press = attributes.find(
            attribute =>
              attribute.type === 'JSXAttribute' &&
              attribute.name.name === 'onPress',
          );
          const delegated = attributes.some(
            attribute => attribute.type === 'JSXSpreadAttribute',
          );
          if (!press && !delegated) {
            missing.push(
              `${path.relative(path.join(__dirname, '..'), file)}:${
                nodePath.node.loc?.start.line || 0
              }:${name.name}`,
            );
          }
        },
      });
    });

    expect(audited).toBeGreaterThan(100);
    expect(missing).toEqual([]);
  });
});
