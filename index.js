/**
 * @format
 */

import {AppRegistry} from 'react-native';
import Discourse from './js/Discourse';

// eslint-disable-next-line no-undef
if (!__DEV__) {
  console.log = () => {};
  console.warn = () => {};
  console.error = () => {};
}

AppRegistry.registerComponent('Discourse', () => Discourse);
