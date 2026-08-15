/* @flow */
'use strict';

export const brand = Object.freeze({
  navy: '#10263D',
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
    canvas: dark ? '#09141E' : '#F6F5F1',
    surface: dark ? '#122431' : brand.white,
    surfaceAlt: dark ? '#193341' : '#EAF2F3',
    surfaceRaised: dark ? '#1D3543' : '#FFFFFF',
    text: dark ? '#F4F7F8' : brand.ink,
    muted: dark ? '#A9BAC5' : brand.muted,
    border: dark ? '#315061' : '#D8E1E2',
    borderStrong: dark ? '#45697A' : '#B9C9CC',
    accent: dark ? '#66B8CB' : brand.blue,
    accentSoft: dark ? '#153B48' : brand.sky,
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
export const radius = Object.freeze({ sm: 8, md: 12, lg: 18, pill: 999 });
export const type = Object.freeze({
  display: { fontSize: 30, lineHeight: 36, fontWeight: '850' },
  title: { fontSize: 23, lineHeight: 29, fontWeight: '800' },
  heading: { fontSize: 18, lineHeight: 24, fontWeight: '780' },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400' },
  metadata: { fontSize: 12, lineHeight: 17, fontWeight: '550' },
  label: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    letterSpacing: 0.7,
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
