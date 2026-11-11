/**
 * Tests for src/lib/spec/generator.ts
 *
 * Covers:
 *  - Archived repositories
 *  - Repos without a language
 *  - Repos with recent vs old commits
 *  - Repos without a license
 *  - Repos with open issues
 *  - fast-check property: generator is deterministic and never throws on valid input
 */

import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { Commit, DependencyAutopsy, GitHubRepoMeta, ManifestEvidence } from '@/types/index';
import { buildAutopsy, REGISTRY_BASE } from '@/lib/deps/autopsy';
import { generateRevivalSpec } from './generator';

// ---------------------------------------------------------------------------
// Test fixture helpers
// ---------------------------------------------------------------------------

type ExtendedMeta = GitHubRepoMeta & { language?: string | null };

function makeMeta(overrides: Partial<ExtendedMeta> = {}): ExtendedMeta {
  return {
    owner: 'ghost',
    repo: 'gravekeeper',
    fullName: 'ghost/gravekeeper',
    description: 'Haunted repo',
    stars: 10,
    forks: 2,
    openIssues: 0,
    license: 'MIT',
    defaultBranch: 'main',
    pushedAt: '2020-01-01T00:00:00Z',
    archivedByGitHub: false,
    language: 'TypeScript',
    ...overrides,
  };
}

function makeCommit(date: string, message = 'feat: update'): Commit {
  return {
    sha: Math.random().toString(16).slice(2, 10),
    message,
    authorDate: date,
    authorName: 'Author',
  };
}

/** A recent commit — less than 12 months ago. */
const recentCommit = makeCommit(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

/** An old commit — more than 12 months ago. */
const oldCommit = makeCommit('2020-01-01T00:00:00Z');

// ---------------------------------------------------------------------------
// Unit tests — archived repository
// ---------------------------------------------------------------------------

describe('generateRevivalSpec — archived repository', () => {
  it('adds an archived stale-dep entry', () => {
    const meta = makeMeta({ archivedByGitHub: true });
    const spec = generateRevivalSpec(meta, []);

    expect(spec.staleDeps).toHaveLength(1);
    expect(spec.staleDeps[0].name).toBe('ghost/gravekeeper');
    expect(spec.staleDeps[0].reason).toBe('archived');
    expect(spec.staleDeps[0].suggestion).toMatch(/fork/i);
  });

  it('includes at least the default revival steps', () => {
    const meta = makeMeta({ archivedByGitHub: true });
    const spec = generateRevivalSpec(meta, []);

    expect(spec.revivalSteps.length).toBeGreaterThanOrEqual(3);
  });

  it('step order values are monotonically increasing starting at 1', () => {
    const meta = makeMeta({ archivedByGitHub: true });
    const spec = generateRevivalSpec(meta, []);

    spec.revivalSteps.forEach((step, idx) => {
      expect(step.order).toBe(idx + 1);
    });
  });
});

// ---------------------------------------------------------------------------
// Unit tests — no language
// ---------------------------------------------------------------------------

describe('generateRevivalSpec — no language', () => {
  it('returns empty detectedLanguages array', () => {
    const meta = makeMeta({ language: null });
    const spec = generateRevivalSpec(meta, []);

    expect(spec.detectedLanguages).toHaveLength(0);
  });

  it('returns null detectedFramework', () => {
    const meta = makeMeta({ language: null });
    const spec = generateRevivalSpec(meta, []);

    expect(spec.detectedFramework).toBeNull();
  });

  it('still generates at least three revival steps', () => {
    const meta = makeMeta({ language: null });
    const spec = generateRevivalSpec(meta, []);

    expect(spec.revivalSteps.length).toBeGreaterThanOrEqual(3);
  });

  it('works when language field is absent entirely', () => {
    const { language, ...metaNoLang } = makeMeta();
    expect(language).toBeDefined();
    const spec = generateRevivalSpec(metaNoLang, []);

    expect(spec.detectedLanguages).toHaveLength(0);
    expect(spec.detectedFramework).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Unit tests — recent commits (last < 12 months)
// ---------------------------------------------------------------------------

describe('generateRevivalSpec — recent commit', () => {
  it('does NOT include a communication-of-revival step for a recent commit', () => {
    const meta = makeMeta({ language: 'TypeScript' });
    const spec = generateRevivalSpec(meta, [recentCommit]);

    const hasCommunicationStep = spec.revivalSteps.some((s) =>
      s.title.toLowerCase().includes('revival intent'),
    );
    expect(hasCommunicationStep).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Unit tests — old commits (last > 12 months ago)
// ---------------------------------------------------------------------------

describe('generateRevivalSpec — old commit', () => {
  it('includes a revival communication step when last commit is > 12 months ago', () => {
    const meta = makeMeta({ language: 'TypeScript' });
    const spec = generateRevivalSpec(meta, [oldCommit]);

    const hasCommunicationStep = spec.revivalSteps.some((s) =>
      s.title.toLowerCase().includes('revival intent'),
    );
    expect(hasCommunicationStep).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Unit tests — no license
// ---------------------------------------------------------------------------

describe('generateRevivalSpec — no license', () => {
  it('includes a "Add a license" step when license is null', () => {
    const meta = makeMeta({ license: null });
    const spec = generateRevivalSpec(meta, []);

    const hasLicenseStep = spec.revivalSteps.some((s) =>
      s.title.toLowerCase().includes('license'),
    );
    expect(hasLicenseStep).toBe(true);
  });

  it('does NOT include a license step when a license is present', () => {
    const meta = makeMeta({ license: 'MIT' });
    const spec = generateRevivalSpec(meta, []);

    const hasLicenseStep = spec.revivalSteps.some((s) =>
      s.title.toLowerCase().includes('license'),
    );
    expect(hasLicenseStep).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Unit tests — open issues
// ---------------------------------------------------------------------------

describe('generateRevivalSpec — open issues', () => {
  it('includes a triage step when there are open issues', () => {
    const meta = makeMeta({ openIssues: 5 });
    const spec = generateRevivalSpec(meta, []);

    const hasTriageStep = spec.revivalSteps.some((s) =>
      s.title.toLowerCase().includes('triage'),
    );
    expect(hasTriageStep).toBe(true);
  });

  it('does NOT include a triage step when there are no open issues', () => {
    const meta = makeMeta({ openIssues: 0 });
    const spec = generateRevivalSpec(meta, []);

    const hasTriageStep = spec.revivalSteps.some((s) =>
      s.title.toLowerCase().includes('triage'),
    );
    expect(hasTriageStep).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Unit tests — language detection
// ---------------------------------------------------------------------------

describe('generateRevivalSpec — language detection', () => {
  it('includes TypeScript in detectedLanguages', () => {
    const meta = makeMeta({ language: 'TypeScript' });
    const spec = generateRevivalSpec(meta, []);
    expect(spec.detectedLanguages).toContain('TypeScript');
  });

  it('includes Python in detectedLanguages', () => {
    const meta = makeMeta({ language: 'Python' });
    const spec = generateRevivalSpec(meta, []);
    expect(spec.detectedLanguages).toContain('Python');
  });

  it('does not include unknown language strings', () => {
    const meta = makeMeta({ language: 'COBOL' });
    const spec = generateRevivalSpec(meta, []);
    // COBOL is not in the known languages set — should produce no detected languages
    expect(spec.detectedLanguages).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Unit tests — generatedAt timestamp
// ---------------------------------------------------------------------------

describe('generateRevivalSpec — generatedAt', () => {
  it('returns a valid ISO 8601 UTC timestamp', () => {
    const meta = makeMeta();
    const spec = generateRevivalSpec(meta, []);

    expect(() => new Date(spec.generatedAt)).not.toThrow();
    expect(new Date(spec.generatedAt).toISOString()).toBe(spec.generatedAt);
  });
});

// ---------------------------------------------------------------------------
// fast-check property tests
// ---------------------------------------------------------------------------

/**
 * Arbitrary for a valid GitHubRepoMeta (with optional language extension).
 *
 * We use realistic constraints: non-empty strings, non-negative counts, etc.
 *
 * NOTE: fc.date() in fast-check v4 can produce Invalid Date objects, so we
 * generate ISO strings via integer timestamps instead.
 */

const MIN_TS = new Date('2000-01-01').getTime();
const MAX_TS = new Date('2026-12-31').getTime();

/** Always-valid ISO 8601 UTC string from a bounded integer timestamp. */
const arbitraryIsoDate: fc.Arbitrary<string> = fc
  .integer({ min: MIN_TS, max: MAX_TS })
  .map((ms) => new Date(ms).toISOString());

const arbitraryMeta: fc.Arbitrary<ExtendedMeta> = fc.record({
  owner: fc.stringMatching(/^[a-z][a-z0-9-]{0,19}$/),
  repo: fc.stringMatching(/^[a-z][a-z0-9-]{0,19}$/),
  fullName: fc.constant('owner/repo'), // derived field, value doesn't affect logic
  description: fc.option(fc.string({ maxLength: 200 }), { nil: null }),
  stars: fc.nat({ max: 100_000 }),
  forks: fc.nat({ max: 50_000 }),
  openIssues: fc.nat({ max: 1_000 }),
  license: fc.option(
    fc.constantFrom('MIT', 'Apache-2.0', 'GPL-3.0', 'BSD-2-Clause', 'ISC'),
    { nil: null },
  ),
  defaultBranch: fc.constantFrom('main', 'master', 'develop'),
  pushedAt: arbitraryIsoDate,
  archivedByGitHub: fc.boolean(),
  language: fc.option(
    fc.constantFrom(
      'TypeScript',
      'JavaScript',
      'Python',
      'Ruby',
      'Go',
      'Rust',
      'Java',
    ),
    { nil: null },
  ),
});

const arbitraryCommit: fc.Arbitrary<Commit> = fc.record({
  sha: fc.stringMatching(/^[0-9a-f]{7,40}$/),
  message: fc.string({ minLength: 1, maxLength: 100 }),
  authorDate: arbitraryIsoDate,
  authorName: fc.string({ minLength: 1, maxLength: 80 }),
});

describe('generateRevivalSpec — property-based tests', () => {
  it('never throws on valid input', () => {
    fc.assert(
      fc.property(
        arbitraryMeta,
        fc.array(arbitraryCommit, { maxLength: 30 }),
        (meta, commits) => {
          expect(() => generateRevivalSpec(meta, commits)).not.toThrow();
        },
      ),
      { numRuns: 200 },
    );
  });

  it('always returns at least three revival steps', () => {
    fc.assert(
      fc.property(
        arbitraryMeta,
        fc.array(arbitraryCommit, { maxLength: 30 }),
        (meta, commits) => {
          const spec = generateRevivalSpec(meta, commits);
          expect(spec.revivalSteps.length).toBeGreaterThanOrEqual(3);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('step order values start at 1 and are monotonically increasing', () => {
    fc.assert(
      fc.property(
        arbitraryMeta,
        fc.array(arbitraryCommit, { maxLength: 30 }),
        (meta, commits) => {
          const spec = generateRevivalSpec(meta, commits);
          spec.revivalSteps.forEach((step, idx) => {
            expect(step.order).toBe(idx + 1);
          });
        },
      ),
      { numRuns: 200 },
    );
  });

  it('is deterministic — same input always produces the same structural output', () => {
    // We freeze time by comparing outputs produced immediately after each other.
    // Because `generatedAt` uses Date.now(), we can't compare it directly, but
    // every other field must be identical.
    fc.assert(
      fc.property(
        arbitraryMeta,
        fc.array(arbitraryCommit, { maxLength: 30 }),
        (meta, commits) => {
          const spec1 = generateRevivalSpec(meta, commits);
          const spec2 = generateRevivalSpec(meta, commits);

          expect(spec1.detectedLanguages).toEqual(spec2.detectedLanguages);
          expect(spec1.detectedFramework).toEqual(spec2.detectedFramework);
          expect(spec1.staleDeps).toEqual(spec2.staleDeps);
          // Compare steps ignoring order field (which is always sequential)
          expect(spec1.revivalSteps.map((s) => s.title)).toEqual(
            spec2.revivalSteps.map((s) => s.title),
          );
          expect(spec1.revivalSteps.map((s) => s.description)).toEqual(
            spec2.revivalSteps.map((s) => s.description),
          );
        },
      ),
      { numRuns: 200 },
    );
  });

  it('detectedLanguages is a subset of the input language', () => {
    fc.assert(
      fc.property(
        arbitraryMeta,
        fc.array(arbitraryCommit, { maxLength: 30 }),
        (meta, commits) => {
          const spec = generateRevivalSpec(meta, commits);
          // detectedLanguages may be empty (unknown language) or contain the input language
          expect(spec.detectedLanguages.length).toBeLessThanOrEqual(1);
          if (meta.language && spec.detectedLanguages.length > 0) {
            expect(spec.detectedLanguages[0]).toBe(meta.language);
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it('archived repos always have at least one stale dep with reason=archived', () => {
    fc.assert(
      fc.property(
        arbitraryMeta.filter((m) => m.archivedByGitHub),
        fc.array(arbitraryCommit, { maxLength: 30 }),
        (meta, commits) => {
          const spec = generateRevivalSpec(meta, commits);
          const archivedEntry = spec.staleDeps.find((d) => d.reason === 'archived');
          expect(archivedEntry).toBeDefined();
        },
      ),
      { numRuns: 100 },
    );
  });

  it('non-archived repos with a license have zero stale deps', () => {
    fc.assert(
      fc.property(
        arbitraryMeta.filter((m) => !m.archivedByGitHub && m.license !== null),
        fc.array(arbitraryCommit, { maxLength: 30 }),
        (meta, commits) => {
          const spec = generateRevivalSpec(meta, commits);
          expect(spec.staleDeps).toHaveLength(0);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('generatedAt is always a valid ISO 8601 string', () => {
    fc.assert(
      fc.property(
        arbitraryMeta,
        fc.array(arbitraryCommit, { maxLength: 30 }),
        (meta, commits) => {
          const spec = generateRevivalSpec(meta, commits);
          expect(new Date(spec.generatedAt).toISOString()).toBe(spec.generatedAt);
        },
      ),
      { numRuns: 200 },
    );
  });
});

// ---------------------------------------------------------------------------
// Dependency autopsy input
// ---------------------------------------------------------------------------

describe('generateRevivalSpec — dependency autopsy', () => {
  const manifest: ManifestEvidence = {
    path: 'package.json',
    ecosystem: 'npm',
    rawSha256: 'b'.repeat(64),
    totalDeclared: 4,
    skippedLines: 0,
    truncated: false,
    packages: [
      { name: 'react', spec: '^16.14.0', group: 'dependencies' },
      { name: 'lodash', spec: '^4.17.0', group: 'dependencies' },
      { name: 'ghost-pkg', spec: '^1.0.0', group: 'dependencies' },
      { name: 'left-pad', spec: '1.3.0', group: 'devDependencies' },
    ],
  };
  const results = [
    { name: 'react', latest: '19.2.0', outcome: 'ok' as const },
    { name: 'lodash', latest: '4.17.21', outcome: 'ok' as const },
    { name: 'ghost-pkg', latest: null, outcome: 'not-found' as const },
    { name: 'left-pad', latest: '1.3.0', outcome: 'ok' as const },
  ];
  const autopsy = buildAutopsy(manifest, { registry: REGISTRY_BASE.npm, results })!;
  const titles = (a: DependencyAutopsy | null) =>
    generateRevivalSpec(makeMeta(), [], a).revivalSteps.map((s) => s.title);

  it('names concrete upgrades instead of generic advice', () => {
    const t = titles(autopsy);
    expect(t).toContain('Upgrade react ^16.14.0 → 19.x (major behind)');
    expect(t).toContain('Update 1 minor-behind package');
    expect(t).toContain('Review 1 package Gravekeeper could not compare');
    expect(t.some((title) => title.includes('metadata only'))).toBe(false);
  });

  it('detects the framework from declared packages and flags outdated rows', () => {
    const spec = generateRevivalSpec(makeMeta({ language: 'JavaScript' }), [], autopsy);
    expect(spec.detectedFramework).toBe('React');
    expect(spec.staleDeps.map((d) => [d.name, d.reason])).toEqual([
      ['react', 'outdated'],
      ['lodash', 'outdated'],
      ['ghost-pkg', 'unknown'],
    ]);
  });

  it('keeps metadata-only behaviour without a usable manifest', () => {
    expect(titles(null)).toContain('Audit and update dependencies (metadata only)');
    const none = buildAutopsy({ code: 'MANIFEST_NOT_FOUND' }, null);
    const steps = generateRevivalSpec(makeMeta(), [], none).revivalSteps;
    const step = steps.find((s) => s.title.includes('metadata only'))!;
    expect(step.description).toMatch(/No package\.json, requirements\.txt or pyproject\.toml/);
    const unavailable = buildAutopsy({ code: 'GITHUB_RATE_LIMIT' }, null);
    expect(
      generateRevivalSpec(makeMeta(), [], unavailable).revivalSteps.some((s) =>
        s.description.includes('could not be read'),
      ),
    ).toBe(true);
  });

  it('labels a partial autopsy', () => {
    const partial = buildAutopsy(manifest, {
      registry: REGISTRY_BASE.npm,
      results: results.map((r, i) => (i === 0 ? { ...r, latest: null, outcome: 'error' as const } : r)),
    })!;
    const step = generateRevivalSpec(makeMeta(), [], partial).revivalSteps.find((s) =>
      s.title.startsWith('Review'),
    )!;
    expect(step.description).toMatch(/partial/);
    expect(step.description).toMatch(/react \(Registry lookup failed\.\)/);
  });

  it('groups major upgrades after the first five and notes truncation', () => {
    const packages = Array.from({ length: 8 }, (_, i) => ({
      name: `pkg${i}`,
      spec: '^1.0.0',
      group: 'dependencies' as const,
    }));
    const big = buildAutopsy(
      { ...manifest, packages, totalDeclared: 50, truncated: true },
      { registry: REGISTRY_BASE.npm, results: packages.map((p) => ({ name: p.name, latest: '3.0.0', outcome: 'ok' as const })) },
    )!;
    const t = titles(big);
    expect(t.filter((title) => title.startsWith('Upgrade pkg'))).toHaveLength(5);
    expect(t).toContain('Upgrade 3 more major-behind packages');
    expect(t).toContain('Check the remaining 42 declared packages');
  });

  it('says so when every package is current', () => {
    const current = buildAutopsy(
      { ...manifest, packages: manifest.packages.slice(3), totalDeclared: 1 },
      { registry: REGISTRY_BASE.npm, results: results.slice(3) },
    )!;
    expect(titles(current)).toContain('Keep declared dependencies current');
  });

  it('property: steps stay ordered 1..N and at least three with any autopsy', () => {
    const outcome = fc.constantFrom('ok', 'not-found', 'error', 'skipped');
    fc.assert(
      fc.property(
        fc.array(fc.tuple(fc.constantFrom('^1.0.0', '~2.3.0', '*', 'file:x', ''), outcome, fc.constantFrom('1.0.0', '2.5.1', '9.0.0')), {
          maxLength: 40,
        }),
        (rows) => {
          const packages = rows.map(([spec], i) => ({ name: `p${i}`, spec, group: 'dependencies' as const }));
          const a = buildAutopsy(
            { ...manifest, packages, totalDeclared: packages.length },
            packages.length
              ? {
                  registry: REGISTRY_BASE.npm,
                  results: rows.map(([, o, v], i) => ({ name: `p${i}`, latest: o === 'ok' ? v : null, outcome: o })),
                }
              : null,
          );
          expect(a).not.toBeNull();
          const spec = generateRevivalSpec(makeMeta(), [], a);
          expect(spec.revivalSteps.length).toBeGreaterThanOrEqual(3);
          spec.revivalSteps.forEach((s, i) => expect(s.order).toBe(i + 1));
        },
      ),
      { numRuns: 200 },
    );
  });
});
