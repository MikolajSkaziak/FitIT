import { genderLabel, genderOptions, occasionIcon, occasionOptions, thermalOptions } from '@/copy/labels';

describe('occasion icons', () => {
  it('gives every occasion an icon of its own, kept next to its label', () => {
    const icons = occasionOptions.map((option) => option.icon);

    expect(new Set(icons).size).toBe(occasionOptions.length);
    expect(occasionIcon('work')).toBe('briefcase');
    expect(occasionIcon('workout')).toBe('barbell');
    expect(occasionIcon('everyday')).toBe('coffee');
  });
});

describe('thermal options', () => {
  it('say how the person feels the cold, in everyday words', () => {
    expect(thermalOptions.map((option) => option.label)).toEqual(['I get cold easily', 'About average', 'I run warm']);
  });
});

describe('gender options', () => {
  it('say who the person is in their own words, women and men first', () => {
    expect(genderOptions.map((option) => option.label)).toEqual(['Woman', 'Man', 'Non-binary', 'Prefer not to say']);
    expect(genderLabel('non_binary')).toBe('Non-binary');
    expect(genderLabel('unspecified')).toBe('Prefer not to say');
  });
});
