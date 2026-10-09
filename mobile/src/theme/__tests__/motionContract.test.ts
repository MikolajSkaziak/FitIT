// The project has no Node typings, so the three things used from Node are described here.
declare const __dirname: string;
const { readdirSync, readFileSync, statSync } = jest.requireActual<{
  readdirSync: (directory: string) => string[];
  readFileSync: (path: string, encoding: 'utf8') => string;
  statSync: (path: string) => { isDirectory: () => boolean };
}>('fs');
const { join } = jest.requireActual<{ join: (...parts: string[]) => string }>('path');

/**
 * The motion contract of .ux-profile.md, held by grep: every duration is a theme token, only the Reanimated
 * timing helpers animate, and nothing springs or bounces. Source files only; tests may say what they like.
 */
const root = join(__dirname, '..', '..');

function sources(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) {
      return name === '__tests__' || name === 'api' ? [] : sources(path);
    }

    return /\.(ts|tsx)$/.test(name) && !name.endsWith('.d.ts') ? [path] : [];
  });
}

const files = sources(root).map((path) => ({ path: path.slice(root.length + 1), text: readFileSync(path, 'utf8') }));

const offenders = (pattern: RegExp) =>
  files.flatMap(({ path, text }) =>
    text
      .split('\n')
      .map((line, index) => ({ line, at: `${path}:${index + 1}` }))
      .filter(({ line }) => pattern.test(line))
      .map(({ line, at }) => `${at}  ${line.trim()}`),
  );

describe('motion contract', () => {
  it('finds the source files', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it('writes no duration as a number: they all come from the theme tokens', () => {
    expect(offenders(/\b(duration|transition)\s*[:=(]\s*\{?\s*\d/)).toEqual([]);
    expect(offenders(/\.(duration|delay)\(\s*\d/)).toEqual([]);
    expect(offenders(/\b(withTiming|withDelay)\(\s*\d+\s*[,)]\s*\d/)).toEqual([]);
  });

  it('uses no spring, bounce, elastic or back curve, and no legacy Animated timing', () => {
    expect(offenders(/\b(withSpring|withDecay|Easing\.(bounce|elastic|back)|springify)\b/)).toEqual([]);
    expect(offenders(/\bAnimated\.(timing|spring|decay|loop|parallel|sequence)\b|useAnimatedValue|LayoutAnimation/)).toEqual([]);
  });

  it('does not ask the system about reduced motion outside the shared module', () => {
    const outside = offenders(/AccessibilityInfo|isReduceMotionEnabled|useReducedMotion/).filter((line) => !line.startsWith('components/motion.tsx'));
    expect(outside).toEqual([]);
  });

  it('animates opacity and transform only', () => {
    const styles = files.flatMap(({ path, text }) =>
      text
        .split('useAnimatedStyle(')
        .slice(1)
        .map((rest) => ({ path, body: rest.split('\n\n')[0] ?? '' })),
    );

    expect(styles.length).toBeGreaterThan(0);
    expect(styles.filter(({ body }) => /\b(width|height|margin\w*|padding\w*|top|left|right|bottom)\s*:/.test(body)).map(({ path }) => path)).toEqual([]);
  });
});
