/* @flow */
'use strict';

import { FIELD_OPTIONS } from '../adjusterCardClient';

export const US_STATES = Object.freeze([
  ['AL', 'Alabama'],
  ['AK', 'Alaska'],
  ['AZ', 'Arizona'],
  ['AR', 'Arkansas'],
  ['CA', 'California'],
  ['CO', 'Colorado'],
  ['CT', 'Connecticut'],
  ['DE', 'Delaware'],
  ['DC', 'District of Columbia'],
  ['FL', 'Florida'],
  ['GA', 'Georgia'],
  ['HI', 'Hawaii'],
  ['ID', 'Idaho'],
  ['IL', 'Illinois'],
  ['IN', 'Indiana'],
  ['IA', 'Iowa'],
  ['KS', 'Kansas'],
  ['KY', 'Kentucky'],
  ['LA', 'Louisiana'],
  ['ME', 'Maine'],
  ['MD', 'Maryland'],
  ['MA', 'Massachusetts'],
  ['MI', 'Michigan'],
  ['MN', 'Minnesota'],
  ['MS', 'Mississippi'],
  ['MO', 'Missouri'],
  ['MT', 'Montana'],
  ['NE', 'Nebraska'],
  ['NV', 'Nevada'],
  ['NH', 'New Hampshire'],
  ['NJ', 'New Jersey'],
  ['NM', 'New Mexico'],
  ['NY', 'New York'],
  ['NC', 'North Carolina'],
  ['ND', 'North Dakota'],
  ['OH', 'Ohio'],
  ['OK', 'Oklahoma'],
  ['OR', 'Oregon'],
  ['PA', 'Pennsylvania'],
  ['RI', 'Rhode Island'],
  ['SC', 'South Carolina'],
  ['SD', 'South Dakota'],
  ['TN', 'Tennessee'],
  ['TX', 'Texas'],
  ['UT', 'Utah'],
  ['VT', 'Vermont'],
  ['VA', 'Virginia'],
  ['WA', 'Washington'],
  ['WV', 'West Virginia'],
  ['WI', 'Wisconsin'],
  ['WY', 'Wyoming'],
]);

export const SPECIALTY_OPTIONS = Object.freeze([
  ['property_residential', 'Residential Property'],
  ['property_commercial', 'Commercial Property'],
  ['catastrophe', 'CAT / Catastrophe'],
  ['contents', 'Contents'],
  ['estimating', 'Estimating'],
  ['appraisal', 'Appraisal'],
  ['desk_review', 'Desk Review'],
]);

export const FIELD_LABELS = Object.freeze({
  name: 'Professional name',
  professional_headline: 'Professional headline',
  bio: 'Bio',
  base_state: 'Base state',
  licensed_states: 'Licensed states',
  specialties: 'Specialties',
  adjuster_type: 'Adjuster type',
  years_experience: 'Years experience',
  cat_experience: 'CAT experience',
  work_mode: 'Work mode',
});

const titleize = value =>
  String(value || '')
    .replaceAll('_', ' ')
    .replaceAll('-', ' ')
    .replace(/\b\w/g, character => character.toUpperCase());

export function stateLabel(value) {
  return US_STATES.find(([code]) => code === value)?.[1] || value || '';
}

export function optionLabel(field, value) {
  if (!value) return '';
  if (field === 'specialties') {
    return (
      SPECIALTY_OPTIONS.find(([key]) => key === value)?.[1] || titleize(value)
    );
  }
  return (
    FIELD_OPTIONS[field]?.find(([key]) => key === value)?.[1] || titleize(value)
  );
}

export function visibilityLabel(value) {
  return value === 'members' ? 'Network members' : 'Only me';
}
