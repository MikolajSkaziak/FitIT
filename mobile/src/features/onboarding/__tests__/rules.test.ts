import { needsOnboarding, onboardingRoutes, previousRoute, resumeRoute } from '@/features/onboarding/steps';
import { recapLines } from '@/features/onboarding/recap';
import { colorAnalysis, user, weather } from '@/test/fixtures';

describe('where the flow resumes', () => {
  it('opens the first step that is not finished, as the server remembers it', () => {
    expect(onboardingRoutes).toEqual(['/onboarding/shape', '/onboarding/fit', '/onboarding/colors', '/onboarding/done']);
    expect([0, 1, 2, 3].map((onboardingStep) => resumeRoute({ onboardingStep, colorAnalysis: null }))).toEqual([...onboardingRoutes]);
    // A number from a newer or older server never leads outside the flow.
    expect(resumeRoute({ onboardingStep: 9, colorAnalysis: null })).toBe('/onboarding/done');
    expect(resumeRoute({ onboardingStep: -1, colorAnalysis: null })).toBe('/onboarding/shape');
  });

  it('does not ask twice for colors that were analyzed before the app was closed', () => {
    expect(resumeRoute({ onboardingStep: 2, colorAnalysis })).toBe('/onboarding/done');
  });

  it('never lets colors stand in for the body shape or the fit, which come first', () => {
    expect(resumeRoute({ onboardingStep: 0, colorAnalysis })).toBe('/onboarding/shape');
    expect(resumeRoute({ onboardingStep: 1, colorAnalysis })).toBe('/onboarding/fit');
  });

  it('is shown while the account is not marked done, and never to an account that is', () => {
    expect(needsOnboarding(null)).toBe(false);
    expect(needsOnboarding({ onboardingDoneAt: null })).toBe(true);
    expect(needsOnboarding({ onboardingDoneAt: '2026-10-09T08:00:00Z' })).toBe(false);
  });
});

describe('going back', () => {
  it('leads to the step before, and to the colors result when there is one', () => {
    expect(previousRoute('/onboarding/done', false)).toBe('/onboarding/colors');
    expect(previousRoute('/onboarding/done', true)).toBe('/onboarding/palette');
    expect(previousRoute('/onboarding/colors', false)).toBe('/onboarding/fit');
    expect(previousRoute('/onboarding/fit', false)).toBe('/onboarding/shape');
    // The body shape is the first screen of an account that already exists: there is nothing to go back to.
    expect(previousRoute('/onboarding/shape', false)).toBeNull();
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
});
