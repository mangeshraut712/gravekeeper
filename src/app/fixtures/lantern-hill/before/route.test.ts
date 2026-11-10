import { describe, expect, it } from 'vitest';
import { GET as getBefore } from './route';
import { GET as getAfter } from '../after/route';

describe('Lantern Hill fixture routes', () => {
  it('serves the historical page and the restored page', async () => {
    const before = getBefore();
    const after = getAfter();
    expect(before.headers.get('content-type')).toContain('text/html');
    expect(before.headers.get('content-security-policy')).toContain("script-src 'none'");
    expect(after.headers.get('content-security-policy')).toContain("form-action 'self'");

    const beforeHtml = await before.text();
    const afterHtml = await after.text();
    expect(beforeHtml).toContain('<marquee');
    expect(beforeHtml).toContain('original Gravekeeper demo fixture');
    expect(afterHtml).toContain('<h1>Lantern Hill</h1>');
    expect(afterHtml.toLowerCase()).not.toContain('<marquee');
  });
});