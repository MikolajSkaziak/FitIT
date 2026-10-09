import { needsOnboarding, onboardingRoutes, previousRoute, resumeRoute } from '@/features/onboarding/steps';
import { nextLine, recapLines } from '@/features/onboarding/recap';
import { colorAnalysis, user, weather } from '@/test/fixtures';

describe('where the flow resumes', () => {
  it('opens the first step that is not finished, as the server remembers it', () => {
    expect(resumeRoute({ onboardingStep: 0, colorAnalysis: null })).toBe('/onboarding/colors');
    expect(resumeRoute({ onboardingStep: 1, colorAnalysis: null })).toBe('/onboarding/basics');
    expect(resumeRoute({ onboardingStep: 2, colorAnalysis: null })).toBe('/onboarding/done');
    expect(onboardingRoutes).toHaveLength(3);
  });

  it('does not ask twice for colors that were analyzed before the app was closed', () => {
    expect(resumeRoute({ onboardingStep: 0, colorAnalysis })).toBe('/onboarding/basics');
  });

  it('is shown while the account is not marked done, and never to an account that is', () => {
    expect(needsOnboarding(null)).toBe(false);
    expect(needsOnboarding({ onboardingDoneAt: null })).toBe(true);
    expect(needsOnboarding({ onboardingDoneAt: '2026-10-09T08:00:00Z' })).toBe(false);
  });
});

describe('going back', () => {
  it('leads to the step before, and to the colors result when there is one', () => {
    expect(previousRoute('/onboarding/done', false)).toBe('/onboarding/basics');
    expect(previousRoute('/onboarding/basics', false)).toBe('/onboarding/colors');
    expect(previousRoute('/onboarding/basics', true)).toBe('/onboarding/palette');
    expect(previousRoute('/onboarding/colors', false)).toBeNull();
  });
});

describe('the recap', () => {
  it('lists what the person gave: name, place with today’s weather, styles, color type and the clothes added', () => {
    const lines = recapLines(user({ colorAnalysis, styles: ['casual', 'smart'] }), weather, 3);

    expect(lines.map((line) => [line.key, line.value])).toEqual([
      ['name', 'Ola'],
      ['weather', 'Gliwice'],
      ['styles', 'casual, smart casual'],
      ['colors', 'Soft autumn'],
      ['clothes', '3'],
    ]);
    expect(lines[1]?.meta).toBe('Sunny, 7-18°C today');
  });

  it('leaves out what is not there, and never lists a body shape', () => {
    const lines = recapLines(user({ location: null, styles: [], colorAnalysis: null }), undefined, 0);

    expect(lines.map((line) => line.key)).toEqual(['name', 'clothes']);
    expect(JSON.stringify(lines)).not.toMatch(/shape|silhouette/i);
  });

  it('says what happens next: five pieces for the first outfit, then that there are enough', () => {
    expect(nextLine(0)).toBe('Add 5 or more pieces and we’ll style your first outfit.');
    expect(nextLine(4)).toBe('Add 5 or more pieces and we’ll style your first outfit.');
    expect(nextLine(5)).toMatch(/enough to style your first outfit/);
  });
});
