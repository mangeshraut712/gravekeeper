/**
 * Revival Spec generator.
 *
 * Analyses GitHub repository metadata and commit history to produce a
 * structured modernisation plan (RevivalSpec).
 *
 * This is a pure, synchronous function — no IO, no side effects.
 * Deterministic: same inputs always produce the same output (modulo `generatedAt`).
 */

import type {
  AutopsyDependency,
  Commit,
  DependencyAutopsy,
  GitHubRepoMeta,
  RevivalSpec,
  RevivalStep,
  StaleDep,
} from '@/types/index';
import { majorOf } from '../deps/semver.ts';

// ---------------------------------------------------------------------------
// Language-specific framework / tooling hints
// ---------------------------------------------------------------------------

/** Well-known languages GitHub reports. */
const KNOWN_LANGUAGES = new Set([
  'JavaScript',
  'TypeScript',
  'Python',
  'Ruby',
  'Java',
  'Go',
  'Rust',
  'C',
  'C++',
  'C#',
  'PHP',
  'Swift',
  'Kotlin',
  'Scala',
  'Shell',
  'HTML',
  'CSS',
  'Dart',
  'Elixir',
  'Clojure',
  'Haskell',
  'Lua',
  'R',
]);

/** Default framework detection heuristics (based on language only — no filesystem access here). */
function detectFramework(language: string | null): string | null {
  // Without access to package.json or project files we can only guess by language.
  // Framework detection is intentionally conservative; the spec generator is
  // designed to be extended with filesystem-aware passes later.
  switch (language) {
    case 'JavaScript':
    case 'TypeScript':
      return null; // Could be React, Vue, Next.js, etc. — too ambiguous without more info
    case 'Python':
      return null; // Could be Django, Flask, FastAPI, etc.
    case 'Ruby':
      return 'Ruby on Rails (likely)';
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Stale dependency / archived-repo flags
// ---------------------------------------------------------------------------

/**
 * Produce stale-dep entries that are always applicable regardless of language.
 * These represent structural / meta concerns rather than specific package versions.
 */
function globalStaleDeps(
  meta: GitHubRepoMeta & { language?: string | null },
): StaleDep[] {
  const staleDeps: StaleDep[] = [];

  if (meta.archivedByGitHub) {
    staleDeps.push({
      name: meta.fullName,
      detectedVersion: null,
      reason: 'archived',
      suggestion:
        'This repository has been archived by its owner. Consider forking it to continue development.',
    });
  }

  return staleDeps;
}

// ---------------------------------------------------------------------------
// Dependency steps
// ---------------------------------------------------------------------------

type StepText = Omit<RevivalStep, 'order'>;

/** Packages that identify a framework, highest priority first. */
const FRAMEWORK_PACKAGES: [string, string][] = [
  ['next', 'Next.js'],
  ['@angular/core', 'Angular'],
  ['nuxt', 'Nuxt'],
  ['vue', 'Vue'],
  ['svelte', 'Svelte'],
  ['react', 'React'],
  ['express', 'Express'],
  ['django', 'Django'],
  ['flask', 'Flask'],
  ['fastapi', 'FastAPI'],
];

function frameworkFromAutopsy(autopsy: DependencyAutopsy | null): string | null {
  if (!autopsy) return null;
  const names = new Set(autopsy.dependencies.map((item) => item.name));
  return FRAMEWORK_PACKAGES.find(([name]) => names.has(name))?.[1] ?? null;
}

function genericDependencyAdvice(language: string | null): string {
  return language === 'JavaScript' || language === 'TypeScript'
    ? 'Run `npm audit` and `npx npm-check-updates` to identify and update stale packages. ' +
        'Pin exact versions for reproducible builds.'
    : language === 'Python'
      ? 'Run `pip list --outdated` or use `pip-audit` / `safety` to find vulnerable packages. ' +
        'Consider switching to a modern dependency manager like `uv` or `poetry`.'
      : language === 'Ruby'
        ? 'Run `bundle outdated` and `bundle update` to refresh gems. ' +
          'Run `bundle audit` to check for known vulnerabilities.'
        : 'Audit dependencies for outdated or unmaintained packages using the ecosystem tooling for ' +
          `${language ?? 'this language'}.`;
}

function listNames(items: AutopsyDependency[], render: (item: AutopsyDependency) => string): string {
  return items.map(render).join(', ');
}

const declared = (item: AutopsyDependency) => item.spec || '(unpinned)';

/** Revival steps for dependencies. Always at least one step. */
export function dependencySteps(
  language: string | null,
  autopsy: DependencyAutopsy | null,
): StepText[] {
  if (!autopsy || autopsy.state === 'no-manifest' || autopsy.state === 'unavailable' || !autopsy.manifest) {
    const reason = !autopsy
      ? 'No dependency manifest was read.'
      : autopsy.state === 'no-manifest'
        ? 'No package.json, requirements.txt or pyproject.toml was found at the repository root.'
        : 'The root dependency manifest could not be read.';
    return [
      {
        title: 'Audit and update dependencies (metadata only)',
        description: `${reason} ${genericDependencyAdvice(language)}`,
      },
    ];
  }

  const { path } = autopsy.manifest;
  const rows = autopsy.dependencies;
  const major = rows.filter((item) => item.status === 'major-behind');
  const minor = rows.filter((item) => item.status === 'minor-behind');
  const review = rows.filter((item) => item.status === 'unknown' || item.status === 'not-found');
  const steps: StepText[] = [];

  for (const item of major.slice(0, 5)) {
    const latestMajor = majorOf(item.latest ?? '');
    steps.push({
      title: `Upgrade ${item.name} ${declared(item)} → ${latestMajor}.x (major behind)`,
      description:
        `${path} declares ${item.name} ${declared(item)}; the registry's latest is ${item.latest}. ` +
        `Read the changelog for breaking changes between ${majorOf(item.floor ?? '')}.x and ${latestMajor}.x, ` +
        'upgrade on a branch, and run the tests.',
    });
  }
  if (major.length > 5) {
    const rest = major.slice(5);
    steps.push({
      title: `Upgrade ${rest.length} more major-behind package${rest.length === 1 ? '' : 's'}`,
      description: `Also a major release behind: ${listNames(rest, (item) => `${item.name} ${declared(item)} → ${item.latest}`)}.`,
    });
  }
  if (minor.length > 0) {
    steps.push({
      title: `Update ${minor.length} minor-behind package${minor.length === 1 ? '' : 's'}`,
      description:
        `Same major line, older floor: ${listNames(minor, (item) => `${item.name} ${declared(item)} → ${item.latest}`)}. ` +
        'These are usually low-risk; raise the declared floor and refresh the lockfile.',
    });
  }
  if (review.length > 0 || autopsy.state === 'partial') {
    const partial =
      autopsy.state === 'partial'
        ? ' Some registry lookups failed, so this autopsy is partial; retry later for the missing rows.'
        : '';
    steps.push({
      title: `Review ${review.length} package${review.length === 1 ? '' : 's'} Gravekeeper could not compare`,
      description:
        (review.length > 0
          ? `Check these by hand: ${listNames(review, (item) => `${item.name} (${item.status === 'not-found' ? 'not on the registry' : (item.note ?? 'unknown')})`)}.`
          : 'No rows need manual review.') + partial,
    });
  }
  if (autopsy.manifest.truncated) {
    const remaining = autopsy.manifest.totalDeclared - rows.length;
    steps.push({
      title: `Check the remaining ${remaining} declared package${remaining === 1 ? '' : 's'}`,
      description: `${path} declares ${autopsy.manifest.totalDeclared} packages; Gravekeeper compared the first ${rows.length}.`,
    });
  }
  if (steps.length === 0) {
    steps.push({
      title: rows.length > 0 ? 'Keep declared dependencies current' : `Review ${path}`,
      description:
        rows.length > 0
          ? `All ${rows.length} packages in ${path} declare the registry's latest major and minor line. Refresh the lockfile and run the tests.`
          : `${path} declares no dependencies that Gravekeeper reads.`,
    });
  }
  return steps;
}

function autopsyStaleDeps(autopsy: DependencyAutopsy | null): StaleDep[] {
  if (!autopsy) return [];
  return autopsy.dependencies.flatMap((item): StaleDep[] => {
    if (item.status === 'major-behind' || item.status === 'minor-behind')
      return [
        {
          name: item.name,
          detectedVersion: item.spec || null,
          reason: 'outdated',
          suggestion: `Latest ${item.latest} (${item.status.replace('-', ' ')})`,
        },
      ];
    if (item.status === 'not-found')
      return [{ name: item.name, detectedVersion: item.spec || null, reason: 'unknown', suggestion: 'Not found on the registry.' }];
    return [];
  });
}

// ---------------------------------------------------------------------------
// Revival step builders
// ---------------------------------------------------------------------------

/** Steps that apply to every repository, regardless of language/framework. */
function defaultRevivalSteps(
  meta: GitHubRepoMeta & { language?: string | null },
  commits: Commit[],
  language: string | null,
  autopsy: DependencyAutopsy | null,
): RevivalStep[] {
  const steps: RevivalStep[] = [];
  let order = 1;

  // Step 1 — Fork and clone
  steps.push({
    order: order++,
    title: 'Fork and clone the repository',
    description:
      `Fork ${meta.fullName} to your GitHub account and clone it locally. ` +
      'Create a new branch (e.g. "revival") to track your changes.',
  });

  // Step 2 — Update README
  steps.push({
    order: order++,
    title: 'Update the README',
    description:
      'Replace or supplement the existing README with a revival notice. ' +
      'Document the original purpose, the revival date, and your plans for the project. ' +
      'Add badges for build status and license.',
  });

  // Step 3 — Dependencies: concrete steps from the autopsy, or generic metadata-only advice
  for (const step of dependencySteps(language, autopsy)) {
    steps.push({ order: order++, ...step });
  }

  // Step 4 — Restore or add CI
  steps.push({
    order: order++,
    title: 'Set up continuous integration',
    description:
      'Add or restore a CI workflow (GitHub Actions, CircleCI, etc.) that runs tests on every push. ' +
      'A minimal `.github/workflows/ci.yml` that installs dependencies and runs the test suite is sufficient to start.',
  });

  // Step 5 — Address open issues
  if (meta.openIssues > 0) {
    steps.push({
      order: order++,
      title: `Triage the ${meta.openIssues} open issue${meta.openIssues === 1 ? '' : 's'}`,
      description:
        'Review open issues to identify quick wins, stale reports, and blockers. ' +
        'Close duplicates and issues that are no longer relevant. ' +
        'Label the rest by severity so new contributors can orient quickly.',
    });
  }

  // Step 6 — Inactivity notice
  const lastCommitDate = commits[0]?.authorDate;
  if (lastCommitDate) {
    const monthsAgo = Math.floor(
      (Date.now() - new Date(lastCommitDate).getTime()) / (1000 * 60 * 60 * 24 * 30),
    );
    if (monthsAgo > 12) {
      steps.push({
        order: order++,
        title: 'Communicate revival intent',
        description:
          `The last commit was approximately ${monthsAgo} months ago. ` +
          'Post a brief "revival notice" in the project\'s issue tracker and (if applicable) package registry listing. ' +
          'Mention the transfer/fork so existing users know where to find updates.',
      });
    }
  }

  // Step 7 — Add a license if missing
  if (!meta.license) {
    steps.push({
      order: order++,
      title: 'Add a license',
      description:
        'The repository has no detected license. Choose an appropriate open-source license ' +
        '(MIT, Apache-2.0, GPL-3.0, etc.) and add a LICENSE file. ' +
        'Without a license, the code is legally "all rights reserved" — contributors cannot safely use or fork it.',
    });
  }

  return steps;
}

// ---------------------------------------------------------------------------
// generateRevivalSpec (public API)
// ---------------------------------------------------------------------------

/**
 * Generate a structured Revival Spec from GitHub repository metadata and
 * commit history.
 *
 * The `meta` parameter may include an optional `language` field beyond the
 * `GitHubRepoMeta` type (added by `fetchRepoMeta`); when present it is used
 * for language-specific advice. When absent the spec falls back to language-
 * agnostic steps.
 *
 * @param meta    - Repository metadata (from fetchRepoMeta).
 * @param commits - Recent commits (from fetchCommits).
 * @param autopsy - Optional dependency autopsy; when absent the dependency step is metadata only.
 * @returns A `RevivalSpec` — pure value, no IO.
 */
export function generateRevivalSpec(
  meta: GitHubRepoMeta & { language?: string | null },
  commits: Commit[],
  autopsy: DependencyAutopsy | null = null,
): RevivalSpec {
  const language: string | null = meta.language ?? null;

  // Build detected-languages list: include GitHub's primary language when known.
  const detectedLanguages: string[] =
    language && KNOWN_LANGUAGES.has(language) ? [language] : [];

  const detectedFramework = frameworkFromAutopsy(autopsy) ?? detectFramework(language);
  const staleDeps = [...globalStaleDeps(meta), ...autopsyStaleDeps(autopsy)];
  const revivalSteps = defaultRevivalSteps(meta, commits, language, autopsy);

  return {
    detectedLanguages,
    detectedFramework,
    staleDeps,
    revivalSteps,
    generatedAt: new Date().toISOString(),
  };
}
