// The project has no Node typings, so the three things used from Node are described here.
declare const __dirname: string;
const { readdirSync, readFileSync, statSync } = jest.requireActual<{
  readdirSync: (directory: string) => string[];
  readFileSync: (path: string, encoding: 'utf8') => string;
  statSync: (path: string) => { isDirectory: () => boolean };
}>('fs');
const { join } = jest.requireActual<{ join: (...parts: string[]) => string }>('path');

/**
 * The haptics contract, held by grep in the spirit of the motion contract: `expo-haptics` is imported by `lib/haptics.ts`
 * and nowhere else, so every cue has a name and a meaning. Source files only; tests may say what they like.
 */
const root = join(__dirname, '..', '..');

function sources(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) {
      return name === '__tests__' ? [] : sources(path);
    }

    return /\.(ts|tsx)$/.test(name) && !name.endsWith('.d.ts') ? [path] : [];
  });
}

const files = sources(root).map((path) => ({ path: path.slice(root.length + 1), text: readFileSync(path, 'utf8') }));

describe('haptics contract', () => {
  it('finds the source files', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it('imports expo-haptics in lib/haptics.ts only', () => {
    const importers = files.filter(({ text }) => /from\s+['"]expo-haptics['"]|require\(\s*['"]expo-haptics['"]/.test(text)).map(({ path }) => path);

    expect(importers).toEqual(['lib/haptics.ts']);
  });

  it('lets the tab bar and the layouts give the press cue and no other', () => {
    const chrome = files.filter(({ path }) => /^components\/TabBar\.tsx$|^app\/.*_layout\.tsx$/.test(path));
    const used = chrome.flatMap(({ path, text }) => [
      ...[...text.matchAll(/\bhaptics\.(\w+)/g)].map((match) => `${path}: ${match[1]}`),
      ...[...text.matchAll(/import\s*\{([^}]*)\}\s*from\s*'@\/lib\/haptics'/g)].flatMap((match) => (match[1] ?? '').split(',').map((name) => `${path}: ${name.trim()}`)),
    ]);

    expect(used.filter((line) => !line.endsWith(': press'))).toEqual([]);
  });

  it('gives a press cue through the shared components: a raw Pressable is not a button of the app', () => {
    const raw = files.filter(({ path, text }) => /<Pressable\b/.test(text) && !/^components\/motion\.tsx$/.test(path) && !/\bpress\(/.test(text)).map(({ path }) => path);

    expect(raw).toEqual([]);
  });
});
