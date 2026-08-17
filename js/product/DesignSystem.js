/* @flow */
'use strict';

export const brand = Object.freeze({
  navy: '#10263D',
  red: '#B3262D',
  redDeep: '#8F1F25',
  blue: '#176B87',
  sky: '#DDEFF4',
  amber: '#D99A2B',
  cream: '#F7F4ED',
  ink: '#15202B',
  muted: '#617180',
  white: '#FFFFFF',
  danger: '#B5473C',
  success: '#357A63',
  teal: '#2C8794',
  gold: '#C88722',
});

export const productTheme = name => {
  const dark = name === 'dark';
  return {
    isDark: dark,
    canvas: dark ? '#0A1219' : '#F4F2ED',
    surface: dark ? '#111D26' : '#FCFBF8',
    surfaceAlt: dark ? '#182731' : '#E9EEED',
    surfaceRaised: dark ? '#1B2A34' : '#FFFFFF',
    surfaceWarm: dark ? '#241F1D' : '#F0EAE1',
    text: dark ? '#F4F7F8' : brand.ink,
    muted: dark ? '#A9BAC5' : brand.muted,
    border: dark ? '#2B3B46' : '#D8D6D0',
    borderStrong: dark ? '#43545F' : '#B9B7B0',
    accent: dark ? '#7DB6C5' : brand.blue,
    accentSoft: dark ? '#17313A' : '#E2EFF1',
    brandAccent: dark ? '#EE777C' : brand.red,
    brandAccentSoft: dark ? '#3A2023' : '#F6E4E3',
    hero: dark ? '#10263D' : brand.navy,
    onHero: '#FFFFFF',
    warning: dark ? '#F1C36D' : '#875B12',
    amber: dark ? '#F1C36D' : brand.amber,
    danger: dark ? '#F08A80' : brand.danger,
    success: dark ? '#70C7A6' : brand.success,
    tab: dark ? '#0E1D28' : '#FFFFFF',
    overlay: dark ? 'rgba(3, 10, 15, 0.72)' : 'rgba(16, 38, 61, 0.12)',
  };
};

export const spacing = Object.freeze({
  xxs: 4,
  xs: 6,
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
});
export const radius = Object.freeze({ sm: 6, md: 10, lg: 14, pill: 999 });
export const type = Object.freeze({
  display: {
    fontSize: 31,
    lineHeight: 37,
    fontWeight: '850',
    letterSpacing: -0.6,
  },
  title: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
    letterSpacing: -0.25,
  },
  heading: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '780',
    letterSpacing: -0.1,
  },
  topic: {
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '720',
    letterSpacing: -0.1,
  },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400' },
  metadata: { fontSize: 12, lineHeight: 17, fontWeight: '550' },
  label: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    letterSpacing: 1.05,
  },
  numeric: {
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '820',
    fontVariant: ['tabular-nums'],
  },
});
export const elevation = Object.freeze({
  subtle: {
    shadowColor: '#07131D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
});

// Floor V2 is the first consumer of this denser application vocabulary. Keep
// these primitives separate from the established product tokens until the
// founder approves extending the system to the remaining destinations.
export const floorV2 = Object.freeze({
  canvas: '#FBFCFD',
  contentInset: 16,
  sectionGap: 20,
  rowGap: 12,
  cardRadius: 16,
  controlRadius: 12,
  headerLogoWidth: 96,
  headerLogoHeight: 68,
});
