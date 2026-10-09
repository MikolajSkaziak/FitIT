import { opensAllShapes, parseGender, shapeFits } from '@/lib/gender';

describe('gender and body shapes', () => {
  it('offers women and men their own set, and the other two genders every shape', () => {
    expect(shapeFits('female', 'female')).toBe(true);
    expect(shapeFits('female', 'male')).toBe(false);
    expect(shapeFits('male', 'female')).toBe(false);
    expect(shapeFits('male', 'male')).toBe(true);
    for (const open of ['non_binary', 'unspecified'] as const) {
      expect(opensAllShapes(open)).toBe(true);
      expect(shapeFits(open, 'female')).toBe(true);
      expect(shapeFits(open, 'male')).toBe(true);
    }

    expect(opensAllShapes('female')).toBe(false);
  });

  it('allows nothing when either side is unknown', () => {
    expect(shapeFits(null, 'female')).toBe(false);
    expect(shapeFits('non_binary', null)).toBe(false);
  });

  it('reads only the four codes of the server from a route parameter', () => {
    expect(parseGender('non_binary')).toBe('non_binary');
    expect(parseGender('unspecified')).toBe('unspecified');
    expect(parseGender('other')).toBeNull();
    expect(parseGender(undefined)).toBeNull();
  });
});
