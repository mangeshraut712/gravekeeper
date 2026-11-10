/**
 * Deterministic rewriter for a narrow slice of late-1990s homepage HTML.
 *
 * It turns presentational tags, layout tables, mailto forms, and
 * document.write scripts into a semantic HTML5 document. It does not fetch
 * anything and it does not claim to be a general browser.
 */

import type { RestorationChange } from '@/types/index';

export type RestoredPage = {
  title: string;
  html: string;
  changes: RestorationChange[];
};

export type RestoreOptions = {
  /** When set, the footer names the bundled fixture the page came from. */
  fixtureLabel?: string;
};

const RESTORED_CSS = `
:root { color-scheme: light; }
* { box-sizing: border-box; }
body {
  margin: 0;
  background: #f4efe6;
  color: #1f1a14;
  font-family: Georgia, "Palatino Linotype", Palatino, serif;
  line-height: 1.6;
}
.skip {
  position: absolute;
  left: 0.75rem;
  top: -3rem;
  background: #fffaf5;
  color: #1f1a14;
  padding: 0.4rem 0.6rem;
}
.skip:focus { top: 0.75rem; }
header, main, footer { max-width: 40rem; margin: 0 auto; padding: 0 1.25rem; }
header { padding-top: 2.5rem; }
h1 { font-size: 2.5rem; line-height: 1.15; margin: 0 0 0.5rem; }
h2 { font-size: 1.35rem; margin: 1.25rem 0 0.5rem; }
p { margin: 0.6rem 0; }
.lede { font-size: 1.125rem; color: #3f3a34; }
.notice {
  background: #fff7ed;
  border-left: 4px solid #7c2d12;
  padding: 0.6rem 0.8rem;
}
nav ul {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 1rem;
  list-style: none;
  padding: 0;
  margin: 1.25rem 0;
}
nav a, p a { color: #7c2d12; }
form { display: grid; gap: 0.75rem; max-width: 22rem; margin-top: 0.5rem; }
label { display: grid; gap: 0.25rem; }
input, button { font: inherit; padding: 0.45rem 0.6rem; }
button {
  background: #7c2d12;
  color: #fffaf5;
  border: 0;
  width: fit-content;
}
footer { margin-top: 1rem; padding-bottom: 2.5rem; color: #3f3a34; font-size: 0.95rem; }
a:focus-visible, button:focus-visible, input:focus-visible {
  outline: 2px solid #7c2d12;
  outline-offset: 2px;
}
`.trim();

type TagReplacer = (attrs: string, inner: string) => string;

export function restoreDeadHtml(source: string, options: RestoreOptions = {}): RestoredPage {
  const changes: RestorationChange[] = [];
  const title = readTitle(source);

  const scripts = mapTag(source, 'script', (attrs, inner) => {
    if (/document\.write/i.test(inner)) return '';
    return `<script${attrs}>${inner}</script>`;
  });
  const removedScripts = countRemovals(source, scripts.html, 'script', (inner) =>
    /document\.write/i.test(inner),
  );
  pushChange(changes, 'document-write', 'Removed scripts that called document.write.', removedScripts);

  const body = extractBody(scripts.html);
  const presentational = countPresentationalAttrs(body.attrs);
  pushChange(
    changes,
    'body-presentation',
    'Dropped presentational body attributes such as bgcolor and link colors.',
    presentational,
  );

  let inner = body.inner;
  inner = recordMap(inner, changes, 'marquee', 'Replaced scrolling marquee text with a static note.', (attrs, content) => {
    void attrs;
    return `<p class="notice">${content.trim()}</p>`;
  });
  inner = recordMap(inner, changes, 'blink', 'Replaced blink with strong emphasis so the words stay put.', (attrs, content) => {
    void attrs;
    return `<strong>${content.trim()}</strong>`;
  });
  inner = recordMap(inner, changes, 'font', 'Unwrapped font tags and promoted large sizes to headings.', (attrs, content) => {
    const size = Number(attr(attrs, 'size') ?? '');
    const text = content.trim();
    if (size >= 6) return `<h1>${text}</h1>`;
    if (size === 5) return `<h2>${text}</h2>`;
    return content;
  });
  inner = unwrapBoldHeadings(inner);
  inner = recordMap(inner, changes, 'center', 'Removed center tags so alignment can come from the stylesheet.', (attrs, content) => {
    void attrs;
    return content;
  });

  let tables = 0;
  inner = mapTag(inner, 'table', (attrs, content) => {
    if (attr(attrs, 'border') !== '0') return `<table${attrs}>${content}</table>`;
    tables += 1;
    return renderLayoutTable(content);
  }).html;
  pushChange(
    changes,
    'layout-table',
    'Turned borderless layout tables into navigation and sections.',
    tables,
  );

  const anchored = namedAnchorsToSections(inner);
  inner = closeOpenSectionBeforeHr(anchored.html);
  pushChange(
    changes,
    'named-anchor',
    'Turned named anchors into section ids.',
    anchored.count,
  );

  inner = promoteSectionHeadings(inner);

  const forms = rewriteMailtoForms(inner);
  inner = forms.html;
  pushChange(
    changes,
    'mailto-form',
    'Pointed mailto forms at this page and associated each field with a label.',
    forms.count,
  );

  const assembled = assembleDocument(inner, options.fixtureLabel);
  const html = buildShell(title, assembled, options.fixtureLabel);
  pushChange(
    changes,
    'document-shell',
    'Rebuilt the document as HTML5 with a character encoding, viewport, language, and a readable stylesheet.',
    1,
  );

  return { title, html, changes };
}

function pushChange(
  changes: RestorationChange[],
  rule: string,
  summary: string,
  count: number,
): void {
  if (count <= 0) return;
  changes.push({ rule, summary, count });
}

function recordMap(
  html: string,
  changes: RestorationChange[],
  rule: string,
  summary: string,
  replacer: TagReplacer,
): string {
  const mapped = mapTag(html, rule, replacer);
  pushChange(changes, rule, summary, mapped.count);
  return mapped.html;
}

function countRemovals(
  before: string,
  after: string,
  tag: string,
  predicate: (inner: string) => boolean,
): number {
  let count = 0;
  mapTag(before, tag, (_attrs, inner) => {
    if (predicate(inner)) count += 1;
    return inner;
  });
  void after;
  return count;
}

function readTitle(source: string): string {
  const match = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(source);
  if (!match) return 'Restored page';
  const text = decodeBasic(match[1] ?? '').replace(/\s+/g, ' ').trim();
  return text || 'Restored page';
}

function extractBody(source: string): { attrs: string; inner: string } {
  const match = /<body\b([^>]*)>([\s\S]*?)<\/body>/i.exec(source);
  if (match) return { attrs: match[1] ?? '', inner: match[2] ?? '' };
  let inner = source.replace(/<!DOCTYPE[^>]*>/gi, '');
  inner = inner.replace(/<head\b[^>]*>[\s\S]*?<\/head>/gi, '');
  inner = inner.replace(/<\/?html\b[^>]*>/gi, '');
  inner = inner.replace(/<\/?body\b[^>]*>/gi, '');
  return { attrs: '', inner };
}

const PRESENTATIONAL_BODY_ATTRS = ['bgcolor', 'text', 'link', 'vlink', 'alink', 'background'];

function countPresentationalAttrs(attrs: string): number {
  let count = 0;
  for (const name of PRESENTATIONAL_BODY_ATTRS) {
    if (attr(attrs, name) !== null) count += 1;
  }
  return count;
}

function unwrapBoldHeadings(html: string): string {
  return html.replace(/<b>\s*(<h[1-6]\b[^>]*>[\s\S]*?<\/h[1-6]>)\s*<\/b>/gi, '$1');
}

function renderLayoutTable(inner: string): string {
  const cells: string[] = [];
  mapTag(inner, 'td', (_attrs, cellInner) => {
    cells.push(renderCell(cellInner));
    return '';
  });
  if (cells.length === 0) {
    mapTag(inner, 'th', (_attrs, cellInner) => {
      cells.push(renderCell(cellInner));
      return '';
    });
  }
  return cells.join('\n');
}

function renderCell(inner: string): string {
  const links = [...inner.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
  const hashLinks = links.filter((match) => (match[1] ?? '').startsWith('#'));
  const text = inner.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (hashLinks.length >= 2 && text.length <= 120) {
    const items = hashLinks
      .map((match) => {
        const href = escapeAttr(match[1] ?? '');
        const label = (match[2] ?? '').replace(/<[^>]+>/g, '').trim();
        return `<li><a href="${href}">${escapeHtml(label)}</a></li>`;
      })
      .join('');
    return `<nav aria-label="Page"><ul>${items}</ul></nav>`;
  }
  return inner;
}

function namedAnchorsToSections(html: string): { html: string; count: number } {
  const pattern = /<a\s+name\s*=\s*["']([^"']+)["']\s*>\s*<\/a>/gi;
  let count = 0;
  const replaced = html.replace(pattern, (_full, id: string) => {
    count += 1;
    return `</section><section id="${escapeAttr(id)}">`;
  });
  if (count === 0) return { html, count: 0 };
  return { html: replaced.replace('</section>', ''), count };
}

function closeOpenSectionBeforeHr(html: string): string {
  const opens = html.match(/<section\b/gi)?.length ?? 0;
  const closes = html.match(/<\/section>/gi)?.length ?? 0;
  if (opens <= closes) return html;
  const hr = html.search(/<hr\b/i);
  if (hr !== -1) return `${html.slice(0, hr)}</section>${html.slice(hr)}`;
  return `${html}</section>`;
}

function promoteSectionHeadings(html: string): string {
  return html.replace(/<section\b([^>]*)>([\s\S]*?)<\/section>/gi, (_full, attrs: string, inner: string) => {
    const promoted = inner.replace(/^\s*<b>([\s\S]*?)<\/b>/i, '<h2>$1</h2>');
    return `<section${attrs}>${promoted}</section>`;
  });
}

function rewriteMailtoForms(html: string): { html: string; count: number } {
  let count = 0;
  const next = html.replace(/<form\b([^>]*)>([\s\S]*?)<\/form>/gi, (full, attrs: string, inner: string) => {
    if (!/mailto:/i.test(attrs)) return full;
    count += 1;
    let fields = inner.replace(/<br\s*\/?\s*>/gi, '\n');
    fields = fields.replace(
      /([A-Za-z][A-Za-z0-9 ]{0,40}):\s*(<input\b[^>]*>)/g,
      '<label>$1 $2</label>',
    );
    fields = fields.replace(/<input\b([^>]*\btype\s*=\s*["']submit["'][^>]*)>/gi, (_tag, inputAttrs: string) => {
      const value = attr(inputAttrs, 'value') ?? 'Submit';
      return `<button type="submit">${escapeHtml(value)}</button>`;
    });
    const body = fields
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .join('\n');
    return `<form action="#guestbook" method="get">\n${body}\n</form>\n<p class="notice">The original form posted to a desktop mail client. This restoration keeps the fields and submits them on this page.</p>`;
  });
  return { html: next, count };
}

function assembleDocument(html: string, fixtureLabel: string | undefined): string {
  const working = html.trim();
  const navAt = working.search(/<nav\b/i);
  const sectionAt = working.search(/<section\b/i);
  const splitAt = navAt === -1 ? sectionAt : navAt;

  let headerInner = '';
  let rest = working;
  if (splitAt > 0) {
    headerInner = paragraphizeBlock(working.slice(0, splitAt));
    rest = working.slice(splitAt);
  }
  headerInner = headerInner.replace(/<p>/, '<p class="lede">');

  rest = paragraphizeSections(rest).replace(/<br\s*\/?\s*>/gi, '');

  const footer = takeFooter(rest, fixtureLabel);
  const header = headerInner.trim() ? `<header>\n${headerInner.trim()}\n</header>` : '';
  const main = `<main>\n${footer.main.trim()}\n</main>`;
  const skip = '<a class="skip" href="#about">Skip to content</a>';
  return [skip, header, main, footer.footer].filter(Boolean).join('\n');
}

function takeFooter(
  html: string,
  fixtureLabel: string | undefined,
): { main: string; footer: string } {
  const lower = html.toLowerCase();
  const copyAt = lower.lastIndexOf('copyright');
  const note = fixtureLabel
    ? `Restored by Gravekeeper from the bundled ${fixtureLabel} fixture. Presentational tags and layout tables were removed, and scripts that rewrote the page on load were dropped.`
    : 'Restored by Gravekeeper. Presentational tags and layout tables were removed, and scripts that rewrote the page on load were dropped.';
  if (copyAt === -1) {
    return {
      main: html,
      footer: `<footer>\n<p>${escapeHtml(note)}</p>\n</footer>`,
    };
  }
  const prefix = html.slice(0, copyAt).replace(/(?:\s|<hr\s*\/?\s*>)+$/i, '');
  const copyText = html.slice(copyAt).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return {
    main: prefix,
    footer: `<footer>\n<p>${escapeHtml(copyText)}</p>\n<p>${escapeHtml(note)}</p>\n</footer>`,
  };
}

function paragraphizeSections(html: string): string {
  return html.replace(/<section\b([^>]*)>([\s\S]*?)<\/section>/gi, (_full, attrs: string, inner: string) => {
    return `<section${attrs}>\n${paragraphizeBlock(inner)}\n</section>`;
  });
}

function paragraphizeBlock(inner: string): string {
  const normalized = inner.replace(/<br\s*\/?\s*>/gi, '\n\n');
  const parts = normalized
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean);
  return parts
    .map((part) => (/^(<h[1-6]\b|<p\b|<ul\b|<ol\b|<form\b|<nav\b|<section\b)/i.test(part) ? part : `<p>${part}</p>`))
    .join('\n');
}

function buildShell(title: string, body: string, fixtureLabel: string | undefined): string {
  const comment = fixtureLabel
    ? `<!-- Restored by Gravekeeper from the bundled ${fixtureLabel} fixture. Original demo content, MIT License. -->`
    : '<!-- Restored by Gravekeeper. -->';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
${RESTORED_CSS}
</style>
</head>
<body>
${comment}
${body}
</body>
</html>
`;
}

function mapTag(
  html: string,
  tag: string,
  replacer: TagReplacer,
): { html: string; count: number } {
  const lower = html.toLowerCase();
  const openToken = `<${tag.toLowerCase()}`;
  const closeToken = `</${tag.toLowerCase()}`;
  let out = '';
  let cursor = 0;
  let count = 0;

  while (cursor < html.length) {
    const start = lower.indexOf(openToken, cursor);
    if (start === -1) {
      out += html.slice(cursor);
      break;
    }
    const boundary = lower[start + openToken.length];
    if (boundary && !/[\s>/]/.test(boundary)) {
      out += html.slice(cursor, start + openToken.length);
      cursor = start + openToken.length;
      continue;
    }
    out += html.slice(cursor, start);
    const openEnd = findTagEnd(html, start);
    if (openEnd === -1) {
      out += html.slice(start);
      break;
    }
    const openTag = html.slice(start, openEnd + 1);
    const attrs = html.slice(start + openToken.length, openEnd).replace(/\/\s*$/, '');
    if (/\/\s*>$/.test(openTag)) {
      out += replacer(attrs, '');
      count += 1;
      cursor = openEnd + 1;
      continue;
    }

    const close = findMatchingClose(html, lower, openToken, closeToken, openEnd + 1);
    if (!close) {
      out += html.slice(start);
      break;
    }
    const inner = html.slice(openEnd + 1, close.start);
    const nested = mapTag(inner, tag, replacer);
    out += replacer(attrs, nested.html);
    count += nested.count + 1;
    cursor = close.end + 1;
  }

  return { html: out, count };
}

function findMatchingClose(
  html: string,
  lower: string,
  openToken: string,
  closeToken: string,
  from: number,
): { start: number; end: number } | null {
  let depth = 1;
  let index = from;
  while (index < html.length && depth > 0) {
    const nextOpen = lower.indexOf(openToken, index);
    const nextClose = lower.indexOf(closeToken, index);
    if (nextClose === -1) return null;
    if (nextOpen !== -1 && nextOpen < nextClose) {
      const boundary = lower[nextOpen + openToken.length];
      if (!boundary || /[\s>/]/.test(boundary)) depth += 1;
      index = nextOpen + openToken.length;
      continue;
    }
    const boundary = lower[nextClose + closeToken.length];
    if (boundary && !/[\s>]/.test(boundary)) {
      index = nextClose + closeToken.length;
      continue;
    }
    depth -= 1;
    if (depth === 0) {
      const end = findTagEnd(html, nextClose);
      if (end === -1) return null;
      return { start: nextClose, end };
    }
    index = nextClose + closeToken.length;
  }
  return null;
}

function findTagEnd(html: string, start: number): number {
  let quote: '"' | "'" | null = null;
  for (let index = start; index < html.length; index += 1) {
    const char = html[index];
    if (quote) {
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === '>') return index;
  }
  return -1;
}

function attr(attrs: string, name: string): string | null {
  const match = new RegExp(
    `\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`,
    'i',
  ).exec(attrs);
  if (!match) return null;
  return match[1] ?? match[2] ?? match[3] ?? '';
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(value: string): string {
  return escapeHtml(value);
}

function decodeBasic(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
