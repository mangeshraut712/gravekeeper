import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { restoreDeadHtml } from './html';
import { LANTERN_HILL_HTML } from './fixture';

const TINY = `<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN">
<html><head><title>Hi &amp; Bye</title>
<meta http-equiv="Content-Type" content="text/html; charset=iso-8859-1">
</head>
<body bgcolor="#ffffff" text="#000000">
<center><font size="7">Hello</font></center>
<marquee>Scroll</marquee>
</body></html>`;

describe('restoreDeadHtml', () => {
  it('rebuilds a tiny 1990s fragment as HTML5', () => {
    const restored = restoreDeadHtml(TINY);
    expect(restored.title).toBe('Hi & Bye');
    expect(restored.html.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(restored.html).toContain('<html lang="en">');
    expect(restored.html).toContain('<meta charset="utf-8">');
    expect(restored.html).toContain('name="viewport"');
    expect(restored.html).toContain('<h1>Hello</h1>');
    expect(restored.html).toContain('Scroll');
    expect(restored.html.toLowerCase()).not.toContain('<font');
    expect(restored.html.toLowerCase()).not.toContain('<center');
    expect(restored.html.toLowerCase()).not.toContain('<marquee');
    expect(restored.html.toLowerCase()).not.toContain('bgcolor');
    expect(restored.changes.map((change) => change.rule)).toEqual(
      expect.arrayContaining(['font', 'center', 'marquee', 'body-presentation', 'document-shell']),
    );
  });

  it('restores the Lantern Hill fixture into a readable document', () => {
    const restored = restoreDeadHtml(LANTERN_HILL_HTML, { fixtureLabel: 'Lantern Hill' });
    expect(restored.html).toContain('<h1>Lantern Hill</h1>');
    expect(restored.html).toContain('id="about"');
    expect(restored.html).toContain('id="webring"');
    expect(restored.html).toContain('id="guestbook"');
    expect(restored.html).toContain('<nav aria-label="Page">');
    expect(restored.html).toContain('href="#about"');
    expect(restored.html).toContain('A homepage from the modem years.');
    expect(restored.html).toContain('Welcome to my corner of the web!');
    expect(restored.html).toContain('You are visitor number 000042');
    expect(restored.html).toContain('Netscape Navigator 4');
    expect(restored.html).toContain('lantern webring is closed');
    expect(restored.html).toContain('Copyright 1999 Ada Morrow');
    expect(restored.html).toContain('Restored by Gravekeeper from the bundled Lantern Hill fixture');
    expect(restored.html).toContain('<label>Name <input type="text" name="name"></label>');
    expect(restored.html.toLowerCase()).not.toContain('<font');
    expect(restored.html.toLowerCase()).not.toContain('<center');
    expect(restored.html.toLowerCase()).not.toContain('<marquee');
    expect(restored.html.toLowerCase()).not.toContain('<blink');
    expect(restored.html.toLowerCase()).not.toContain('bgcolor');
    expect(restored.html.toLowerCase()).not.toContain('<script');
    expect(restored.html.toLowerCase()).not.toContain('document.write');
    expect(restored.html.toLowerCase()).not.toContain('mailto:');
    expect(restored.html).not.toContain('Comic Sans');
    expect(restored.changes.map((change) => change.rule)).toEqual([
      'document-write',
      'body-presentation',
      'marquee',
      'blink',
      'font',
      'center',
      'layout-table',
      'named-anchor',
      'mailto-form',
      'document-shell',
    ]);
    expect(restoreDeadHtml(LANTERN_HILL_HTML, { fixtureLabel: 'Lantern Hill' })).toEqual(restored);
  });

  it('keeps plain text when the source is already simple', () => {
    const restored = restoreDeadHtml(
      '<html><head><title>Plain</title></head><body><p>Hello archive</p></body></html>',
    );
    expect(restored.html).toContain('Hello archive');
    expect(restored.html).toContain('<!DOCTYPE html>');
  });

  it('is deterministic and does not throw on arbitrary strings', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 80 }), (value) => {
        const once = restoreDeadHtml(value);
        const twice = restoreDeadHtml(value);
        expect(twice).toEqual(once);
        expect(once.html).toContain('<!DOCTYPE html>');
        expect(once.html).toContain('lang="en"');
      }),
      { numRuns: 25 },
    );
  });

  it('strips marquee while keeping the words', () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[A-Za-z0-9][A-Za-z0-9 ]{0,24}$/), (text) => {
        const restored = restoreDeadHtml(`<marquee>${text}</marquee>`);
        expect(restored.html.toLowerCase()).not.toContain('<marquee');
        expect(restored.html).toContain(text.trim());
      }),
      { numRuns: 20 },
    );
  });
});
