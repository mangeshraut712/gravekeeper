'use client';

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { ResurrectResponse } from '@/types/index';
import {
  buildReceiptExport,
  verifyReceiptExport,
  type ReceiptExportV1,
  type VerifyExportResult,
  type VerifyFailureReason,
} from '@/lib/receipts/export';
import { LANTERN_HILL_URL } from '@/lib/restore/fixture';
import { FogOverlay } from '@/components/FogOverlay';

type ForkState = {
  enabled: boolean | null;
  message: string | null;
  pending: boolean;
};

export function ResurrectApp() {
  const [url, setUrl] = useState(LANTERN_HILL_URL);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResurrectResponse | null>(null);
  const [submittedUrl, setSubmittedUrl] = useState<string | null>(null);
  const [fork, setFork] = useState<ForkState>({ enabled: null, message: null, pending: false });
  const [localVerdict, setLocalVerdict] = useState<VerifyExportResult | null>(null);
  const [tamperVerdict, setTamperVerdict] = useState<VerifyExportResult | null>(null);
  const [fileVerdict, setFileVerdict] = useState<VerifyExportResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/fork')
      .then(async (response) => {
        const data: unknown = await response.json();
        if (cancelled) return;
        const enabled = isForkStatus(data) ? data.enabled : false;
        setFork((current) => ({ ...current, enabled }));
      })
      .catch(() => {
        if (!cancelled) setFork((current) => ({ ...current, enabled: false }));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = url.trim();
    if (!isHttpUrl(trimmed)) {
      setError('Enter a full URL, including http:// or https://.');
      setResult(null);
      return;
    }

    setLoading(true);
    setError(null);
    setLocalVerdict(null);
    setTamperVerdict(null);
    setFork((current) => ({ ...current, message: null }));

    try {
      const response = await fetch('/api/resurrect', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: trimmed }),
      });
      const data: unknown = await response.json();
      if (!response.ok || !isResurrectResponse(data)) {
        setResult(null);
        setError(isApiError(data) ? data.error : 'Resurrection failed.');
        return;
      }
      setSubmittedUrl(trimmed);
      setResult(data);
    } catch {
      setResult(null);
      setError('The request did not complete. Check that the app is still running.');
    } finally {
      setLoading(false);
    }
  }

  async function onFork() {
    if (!result?.github) return;
    setFork((current) => ({ ...current, pending: true, message: null }));
    try {
      const response = await fetch('/api/fork', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          owner: result.github.meta.owner,
          repo: result.github.meta.repo,
        }),
      });
      const data: unknown = await response.json();
      if (!response.ok) {
        setFork((current) => ({
          ...current,
          pending: false,
          message: isApiError(data) ? data.error : 'Fork creation failed.',
        }));
        return;
      }
      const forkUrl = isForkCreated(data) ? data.forkUrl : null;
      setFork((current) => ({
        ...current,
        pending: false,
        message: forkUrl ? `Fork ready at ${forkUrl}` : 'Fork request finished.',
      }));
    } catch {
      setFork((current) => ({
        ...current,
        pending: false,
        message: 'Fork request did not complete.',
      }));
    }
  }

  const exportBundle = result
    ? buildReceiptExport({
        publicKey: result.publicKey,
        receipts: result.receipts,
        beforeHtml: result.restoration?.beforeHtml,
        afterHtml: result.restoration?.afterHtml,
      })
    : null;

  const status = loading
    ? 'Resurrection in progress.'
    : result
      ? result.restoration
        ? `Restored ${result.restoration.title}. The before page and the restored page are ready, with ${result.receipts.length} signed receipts.`
        : `Lookup finished. ${result.receipts.length} signed receipts are ready to export.`
      : '';

  return (
    <div className="relative min-h-full bg-background text-foreground">
      <FogOverlay />
      <div className="relative mx-auto flex w-full max-w-5xl flex-col gap-8 px-5 py-10 sm:px-8 sm:py-14">
        <header className="flex flex-col gap-4">
          <p className="flex items-center gap-2 text-xs font-medium tracking-[0.22em] text-amber uppercase">
            <span className="candle motion-reduce:animate-none" aria-hidden="true" />
            Kiroween Resurrection
          </p>
          <h1 className="font-serif text-5xl leading-none font-semibold tracking-tight sm:text-6xl">
            Gravekeeper
          </h1>
          <p className="max-w-2xl text-lg leading-8 text-muted">
            Bring a dead page back as something you can read. Gravekeeper rewrites the bundled
            1999 homepage into modern HTML, then signs a hash-chained receipt a third party can
            export and verify.
          </p>
        </header>

        <form
          onSubmit={onSubmit}
          className="flex flex-col gap-4 rounded-lg border border-line bg-card p-5"
        >
          <div className="flex flex-col gap-2">
            <label htmlFor="dead-url" className="text-sm font-medium">
              Dead URL
            </label>
            <input
              id="dead-url"
              name="url"
              type="url"
              inputMode="url"
              autoComplete="url"
              spellCheck={false}
              required
              value={url}
              disabled={loading}
              aria-invalid={error ? true : undefined}
              aria-describedby="url-help"
              onChange={(event) => setUrl(event.target.value)}
              className="w-full rounded-md border border-line bg-soil px-3 py-3 text-base text-foreground"
            />
            <p id="url-help" className="text-sm leading-6 text-muted">
              The field starts on Lantern Hill, an original MIT-licensed demo fixture from March
              1999. That run stays on this machine. Replace the URL to look up a live page in the
              Wayback Machine, or a GitHub repository for metadata and a revival checklist.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-amber px-4 py-2 font-semibold text-soil disabled:opacity-60"
            >
              {loading ? 'Resurrecting' : 'Resurrect'}
            </button>
            {url.trim() !== LANTERN_HILL_URL ? (
              <button
                type="button"
                onClick={() => setUrl(LANTERN_HILL_URL)}
                className="rounded-md border border-line px-4 py-2"
              >
                Use the Lantern Hill example
              </button>
            ) : null}
          </div>
          <p role="status" aria-live="polite" className="min-h-6 text-sm text-moss">
            {status}
          </p>
          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
        </form>

        {result ? (
          <ResultView
            result={result}
            submittedUrl={submittedUrl}
            fork={fork}
            onFork={onFork}
          />
        ) : null}

        <section className="flex flex-col gap-4 rounded-lg border border-line bg-card p-5">
          <h2 className="font-serif text-2xl">Receipts</h2>
          <p className="text-sm leading-6 text-muted">
            Each receipt is signed with an Ed25519 key that exists only for this response. Export
            the file and verify it here, or with <code className="font-mono text-amber">POST /api/verify</code>.
            The check recomputes the hash chain in this browser.
          </p>
          {result && exportBundle ? (
            <>
              <ol className="flex flex-col gap-2">
                {result.receipts.map((receipt) => (
                  <li key={receipt.hash} className="rounded-md border border-line">
                    <details className="group">
                      <summary className="cursor-pointer px-3 py-2 font-mono text-sm">
                        {receipt.seq} · {receipt.kind} · {receipt.hash.slice(0, 12)}…
                      </summary>
                      <dl className="grid gap-2 px-3 pb-3 text-sm">
                        <div>
                          <dt className="text-muted">Fetched</dt>
                          <dd>{receipt.fetchedAt}</dd>
                        </div>
                        <div>
                          <dt className="text-muted">URL</dt>
                          <dd className="break-all">{receipt.url}</dd>
                        </div>
                        <div>
                          <dt className="text-muted">Content SHA-256</dt>
                          <dd className="font-mono text-xs break-all">{receipt.contentSha256}</dd>
                        </div>
                        <div>
                          <dt className="text-muted">Hash</dt>
                          <dd className="font-mono text-xs break-all">{receipt.hash}</dd>
                        </div>
                      </dl>
                    </details>
                  </li>
                ))}
              </ol>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => downloadFile('gravekeeper-receipts.json', JSON.stringify(exportBundle, null, 2), 'application/json')}
                  className="rounded-md bg-amber px-4 py-2 font-semibold text-soil"
                >
                  Export receipt chain
                </button>
                <button
                  type="button"
                  onClick={async () => setLocalVerdict(await verifyReceiptExport(exportBundle))}
                  className="rounded-md border border-line px-4 py-2"
                >
                  Verify this chain
                </button>
                <button
                  type="button"
                  onClick={async () => setTamperVerdict(await verifyReceiptExport(tamperExport(exportBundle)))}
                  className="rounded-md border border-line px-4 py-2"
                >
                  Verify a tampered copy
                </button>
                {result.restoration ? (
                  <button
                    type="button"
                    onClick={() => downloadFile('lantern-hill-restored.html', result.restoration?.afterHtml ?? '', 'text/html')}
                    className="rounded-md border border-line px-4 py-2"
                  >
                    Download restored HTML
                  </button>
                ) : null}
              </div>
              <VerdictLine label="Local verification" verdict={localVerdict} />
              <VerdictLine label="Tampered copy" verdict={tamperVerdict} />
            </>
          ) : (
            <p className="text-sm text-muted">Resurrect a URL to mint a chain, or verify a file you already have.</p>
          )}

          <div className="flex flex-col gap-2 border-t border-line pt-4">
            <label htmlFor="receipt-file" className="text-sm font-medium">
              Verify an exported receipt file
            </label>
            <input
              id="receipt-file"
              type="file"
              accept="application/json,.json"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                try {
                  const parsed: unknown = JSON.parse(await file.text());
                  setFileVerdict(await verifyReceiptExport(parsed));
                } catch {
                  setFileVerdict({ valid: false, reason: 'parse' });
                }
              }}
              className="text-sm"
            />
            <VerdictLine label="File verification" verdict={fileVerdict} />
          </div>
        </section>

        <footer className="text-sm leading-6 text-muted">
          Lantern Hill is original demo content shipped with Gravekeeper under the MIT license.
          It is not a copy of a copyrighted site. Forking a GitHub repository needs a server
          token and is optional for this demo.
        </footer>
      </div>
    </div>
  );
}

function ResultView({
  result,
  submittedUrl,
  fork,
  onFork,
}: {
  result: ResurrectResponse;
  submittedUrl: string | null;
  fork: ForkState;
  onFork: () => void;
}) {
  if (result.restoration) {
    const restoration = result.restoration;
    return (
      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <h2 className="font-serif text-3xl">Before and after</h2>
          <p className="max-w-3xl text-sm leading-6 text-muted">{restoration.disclosure}</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Preview
            title="Before · 1999 fixture"
            html={restoration.beforeHtml}
            frameTitle="Lantern Hill before restoration"
            href={restoration.beforePath}
          />
          <Preview
            title="After · restored HTML"
            html={restoration.afterHtml}
            frameTitle="Lantern Hill after restoration"
            href={restoration.afterPath}
          />
        </div>
        <div className="rounded-lg border border-line bg-card p-5">
          <h3 className="font-serif text-xl">What changed</h3>
          <ol className="mt-3 flex list-decimal flex-col gap-2 pl-5 text-sm leading-6">
            {restoration.changes.map((change) => (
              <li key={change.rule}>
                <span className="font-medium">{change.summary}</span>{' '}
                <span className="text-muted">({change.count})</span>
              </li>
            ))}
          </ol>
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-line bg-card p-5">
      <h2 className="font-serif text-3xl">Lookup</h2>
      <p className="text-sm leading-6 text-muted">
        This URL uses the live lookup. HTML rewriting runs on the bundled Lantern Hill fixture so
        the demo does not depend on a Wayback hit. The receipt chain below still covers this request.
      </p>
      {result.wayback ? (
        <p className="text-sm leading-6">
          Wayback snapshot{' '}
          <a className="text-amber underline" href={result.wayback.snapshotUrl ?? '#'} target="_blank" rel="noreferrer">
            {formatWaybackTimestamp(result.wayback.timestamp)}
          </a>
        </p>
      ) : (
        <p className="text-sm leading-6">No archived snapshot found. The miss is still on the receipt chain.</p>
      )}
      {result.github ? (
        <div className="flex flex-col gap-3">
          <h3 className="font-serif text-2xl">{result.github.meta.fullName}</h3>
          <p className="text-sm text-muted">{result.github.meta.description ?? 'No description.'}</p>
          <ul className="flex flex-wrap gap-3 text-sm">
            <li>{result.github.meta.stars} stars</li>
            <li>{result.github.meta.openIssues} open issues</li>
            <li>License {result.github.meta.license ?? 'unknown'}</li>
            <li>Last push {result.github.meta.pushedAt}</li>
            {result.github.meta.archivedByGitHub ? <li>Archived on GitHub</li> : null}
          </ul>
          {result.github.commits.length === 0 ? (
            <p className="text-sm">Commit history could not be fetched.</p>
          ) : null}
          {result.spec ? (
            <div>
              <h3 className="font-serif text-xl">Revival checklist</h3>
              <ol className="mt-2 flex list-decimal flex-col gap-2 pl-5 text-sm leading-6">
                {result.spec.revivalSteps.map((step) => (
                  <li key={step.order}>
                    <span className="font-medium">{step.title}.</span> {step.description}
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
          <div className="flex flex-col gap-2">
            <button
              type="button"
              disabled={fork.enabled !== true || fork.pending}
              title={fork.enabled === true ? 'Create a GitHub fork' : 'GITHUB_TOKEN is not configured on the server'}
              onClick={onFork}
              className="w-fit rounded-md border border-line px-4 py-2 disabled:opacity-60"
            >
              {fork.pending ? 'Creating fork' : 'Create revived fork'}
            </button>
            {fork.enabled === false ? (
              <p className="text-sm text-muted">
                Fork creation needs GITHUB_TOKEN on the server. The demo path does not.
              </p>
            ) : null}
            {fork.message ? <p className="text-sm break-all">{fork.message}</p> : null}
          </div>
        </div>
      ) : isGitHubRepoUrl(submittedUrl) ? (
        <p className="text-sm">GitHub metadata could not be fetched. Receipts still record the attempt.</p>
      ) : null}
    </section>
  );
}

function Preview({
  title,
  html,
  frameTitle,
  href,
}: {
  title: string;
  html: string;
  frameTitle: string;
  href: string;
}) {
  return (
    <figure className="flex flex-col gap-2 rounded-lg border border-line bg-card p-3">
      <figcaption className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium">{title}</span>
        <a className="text-amber underline" href={href} target="_blank" rel="noreferrer">
          Open
        </a>
      </figcaption>
      <iframe
        title={frameTitle}
        sandbox=""
        srcDoc={html}
        className="h-[28rem] w-full rounded-md border border-line bg-white"
      />
    </figure>
  );
}

function VerdictLine({ label, verdict }: { label: string; verdict: VerifyExportResult | null }) {
  if (!verdict) return null;
  return (
    <p role="status" aria-live="polite" className={verdict.valid ? 'text-sm text-moss' : 'text-sm text-danger'}>
      {label}: {describeVerdict(verdict)}
    </p>
  );
}

function describeVerdict(result: VerifyExportResult): string {
  if (result.valid) {
    const checkedArtifacts = result.artifacts
      && (result.artifacts.before !== null || result.artifacts.after !== null);
    return checkedArtifacts
      ? 'Receipt chain verified. The attached HTML matches the receipt hashes.'
      : 'Receipt chain verified.';
  }
  const reason: VerifyFailureReason | undefined = result.reason;
  switch (reason) {
    case 'parse':
      return 'This file is not a Gravekeeper receipt export.';
    case 'chain':
      return `Verification failed at receipt ${result.brokenAt ?? 0}.`;
    case 'artifact-hash':
      return 'The HTML in this file does not match the hash in its receipt.';
    case 'public-key':
      return 'The public key in this file could not be imported.';
    case undefined:
      return 'Verification failed.';
    default: {
      const neverReason: never = reason;
      return neverReason;
    }
  }
}

function tamperExport(exported: ReceiptExportV1): ReceiptExportV1 {
  const copy = structuredClone(exported);
  const first = copy.receipts[0];
  if (first) copy.receipts[0] = { ...first, url: `${first.url}#tampered` };
  return copy;
}

function downloadFile(filename: string, contents: string, type: string): void {
  const blob = new Blob([contents], { type });
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(href);
}

function formatWaybackTimestamp(timestamp: string | null): string {
  if (!timestamp || !/^\d{14}$/.test(timestamp)) return timestamp ?? 'unknown time';
  return `${timestamp.slice(0, 4)}-${timestamp.slice(4, 6)}-${timestamp.slice(6, 8)} ${timestamp.slice(8, 10)}:${timestamp.slice(10, 12)}:${timestamp.slice(12, 14)} UTC`;
}

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function isGitHubRepoUrl(value: string | null): boolean {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    if (parsed.hostname !== 'github.com') return false;
    return parsed.pathname.split('/').filter(Boolean).length === 2;
  } catch {
    return false;
  }
}

function isApiError(value: unknown): value is { error: string } {
  return typeof value === 'object' && value !== null && typeof (value as { error?: unknown }).error === 'string';
}

function isForkStatus(value: unknown): value is { enabled: boolean } {
  return typeof value === 'object' && value !== null && typeof (value as { enabled?: unknown }).enabled === 'boolean';
}

function isForkCreated(value: unknown): value is { forkUrl: string } {
  return typeof value === 'object' && value !== null && typeof (value as { forkUrl?: unknown }).forkUrl === 'string';
}

function isResurrectResponse(value: unknown): value is ResurrectResponse {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as { receipts?: unknown; publicKey?: unknown };
  return Array.isArray(record.receipts) && typeof record.publicKey === 'string';
}
