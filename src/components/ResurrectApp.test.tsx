import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ResurrectApp } from './ResurrectApp';

describe('ResurrectApp', () => {
  it('renders the Gravekeeper product instead of the starter homepage', () => {
    const html = renderToStaticMarkup(<ResurrectApp />);
    expect(html).toContain('Gravekeeper');
    expect(html).toContain('Kiroween Resurrection');
    expect(html).toContain('Lantern Hill');
    expect(html).toContain('Resurrect');
    expect(html).toContain('https://fixtures.gravekeeper.dev/lantern-hill/');
    expect(html).not.toContain('To get started');
    expect(html).not.toContain('page.tsx');
  });
});
