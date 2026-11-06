import { describe, expect, it } from 'vitest';
import {
  LANTERN_HILL_DISCLOSURE,
  LANTERN_HILL_HTML,
  LANTERN_HILL_URL,
  isFixtureUrl,
  loadLanternHill,
} from './fixture';

describe('Lantern Hill fixture', () => {
  it('is labeled as original demo content under the MIT license', () => {
    const fixture = loadLanternHill();
    expect(fixture.id).toBe('lantern-hill');
    expect(fixture.license).toBe('MIT');
    expect(fixture.url).toBe(LANTERN_HILL_URL);
    expect(fixture.disclosure).toBe(LANTERN_HILL_DISCLOSURE);
    expect(fixture.disclosure.toLowerCase()).toContain('not a copy');
    expect(fixture.beforeHtml).toBe(LANTERN_HILL_HTML);
    expect(fixture.beforeHtml).toContain('original Gravekeeper demo fixture');
    expect(fixture.beforeHtml).toContain('MIT');
  });

  it('matches the canonical fixture URL and ignores a query string', () => {
    expect(isFixtureUrl(LANTERN_HILL_URL)).toBe(true);
    expect(isFixtureUrl('https://fixtures.gravekeeper.dev/lantern-hill')).toBe(true);
    expect(isFixtureUrl('https://fixtures.gravekeeper.dev/lantern-hill/?demo=1')).toBe(true);
    expect(isFixtureUrl('http://fixtures.gravekeeper.dev/lantern-hill/')).toBe(false);
    expect(isFixtureUrl('https://example.com/lantern-hill/')).toBe(false);
    expect(isFixtureUrl('not a url')).toBe(false);
  });
});
