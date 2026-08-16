import {
  optionLabel,
  stateLabel,
  visibilityLabel,
} from '../product/adjusterCardPresentation';

describe('Adjuster Card presentation', () => {
  test('maps canonical values to member-facing language', () => {
    expect(optionLabel('specialties', 'property_residential')).toBe(
      'Residential Property',
    );
    expect(optionLabel('years_experience', '4_to_7')).toBe('4–7 years');
    expect(optionLabel('specialties', 'unknown_specialty')).toBe(
      'Unknown Specialty',
    );
  });

  test('maps states and visibility without changing canonical values', () => {
    expect(stateLabel('OH')).toBe('Ohio');
    expect(visibilityLabel('members')).toBe('Network members');
    expect(visibilityLabel('self')).toBe('Only me');
  });
});
