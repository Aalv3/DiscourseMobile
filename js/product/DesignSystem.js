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
});

export const productTheme = name => {
  const dark = name === 'dark';
  return {
    canvas: dark ? '#0C1620' : brand.cream,
    surface: dark ? '#142431' : brand.white,
    surfaceAlt: dark ? '#1A303F' : '#EDF4F5',
    text: dark ? '#F4F7F8' : brand.ink,
    muted: dark ? '#A9BAC5' : brand.muted,
    border: dark ? '#294252' : '#D7E0E2',
    accent: dark ? '#66B8CB' : brand.blue,
    accentSoft: dark ? '#153B48' : brand.sky,
    hero: dark ? '#10263D' : brand.navy,
    onHero: '#FFFFFF',
    warning: dark ? '#F1C36D' : '#875B12',
    danger: dark ? '#F08A80' : brand.danger,
  };
};

export const spacing = Object.freeze({ xs: 6, sm: 10, md: 16, lg: 24, xl: 32 });
export const radius = Object.freeze({ sm: 10, md: 16, lg: 24 });
