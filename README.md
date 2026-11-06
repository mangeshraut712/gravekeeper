# Gravekeeper

**Good code deserves a second life.**

Gravekeeper is a digital-archaeology workbench for public websites and forgotten GitHub repositories, built for Kiroween 2026. Enter a URL to find an Internet Archive snapshot, inspect repository history, generate a practical revival checklist, and export a self-contained, tamper-evident record of the lookup.

## What works

- Live Internet Archive and public GitHub lookups, with partial results when a source is unavailable.
- A responsive, keyboard-accessible graveyard interface, cancelable searches, reduced-motion support, and actionable error states.
- Repository facts and a metadata-based revival plan. **This is not an automated source-code repair or dependency audit.**
- Ed25519 signatures, SHA-256 receipt links, and included evidence payloads. Browser and offline verification use the same implementation.
- A GitHub fork link that lets the visitor review and confirm using their own account. The app never forks through the visitor's browser using a shared operator token.

## Run locally

Use Node.js 22.18+ (Node 24 tested) and npm.

```sh
npm ci
npm run dev
```

Open http://localhost:3000. No API key or paid service is required. Try `https://github.com/atom/atom` or `https://github.com/facebookarchive/flux`.

```sh
npm test
npm run lint
npx tsc --noEmit
npm run build
npm start
```

The build uses the installed Next.js version's npm security-advisory check. A restricted execution environment may need to allow that read-only check and the native filesystem operations required by Turbopack. Do not disable security checks to conceal a build failure.

## Verify a downloaded proof offline

Click **Download proof**, then run from this checkout:

```sh
node scripts/verify-proof.ts /path/to/gravekeeper-proof.json
```

No network request, dependency installation, or server is needed for verification. Exit 0 means internal consistency, exit 1 means invalid/unreadable proof, and exit 2 means missing arguments.

The verifier checks receipt sequence, predecessor hashes, signatures, evidence digests, and consistency with the included display data. It does **not** establish authorship, authenticate GitHub or the Internet Archive, prove that claims are true, or detect removal of a valid suffix. Each lookup generates a fresh ephemeral signing key. To retain stronger provenance, preserve an independently trusted copy of the public key and final receipt hash at collection time.

## Privacy and deployment safety

- Submit public HTTP(S) URLs only. Credentials, query strings, local addresses, and literal IP addresses are rejected. The submitted URL is sent to the Internet Archive and, for repository URLs, GitHub.
- The application stores no user accounts or database records. Infrastructure logs may still record requests. Downloads stay in the visitor's browser unless the visitor shares them.
- Archive links open on `web.archive.org` over HTTPS. Treat old archived content as untrusted.
- **Recommended public deployment: leave `GITHUB_TOKEN` and `FORK_API_SECRET` unset.** Anonymous GitHub API limits apply.
- A narrowly scoped, public-read-only `GITHUB_TOKEN` may be supplied for higher lookup limits. Never expose it with a `NEXT_PUBLIC_` prefix. Private repository data is rejected.
- `/api/fork` is an optional **operator-only** route, disabled unless a separate `FORK_API_SECRET` of at least 32 characters is configured. It requires that secret in an `Authorization: Bearer ...` header in addition to a server-side GitHub token. The public interface does not call it. Do not configure write credentials on a public demo.
- Apply provider-level rate limits and spending controls before public deployment. Per-request upstream timeouts and cancellation are implemented; a distributed abuse limiter is not.
- No deployment, YouTube upload, or contest submission is implied by this repository's presence.

## How Kiro was used

See [KIRO_USAGE.md](KIRO_USAGE.md), the committed [.kiro](.kiro) steering/spec/task files, and [review metering evidence](.kiro/evidence/2026-11-06-review-metering.json). The log distinguishes Kiro-generated work, manual implementation, unsuccessful quota-limited sessions, and Kiro's later read-only review. It does not claim that untested hook or MCP configurations were exercised.

## License and third-party services

MIT; see [LICENSE](LICENSE). The graveyard illustration is original inline SVG. System fonts avoid external font requests. GitHub and Internet Archive data, repositories, and snapshots remain subject to their respective rights and licenses. Review a repository's license before copying or reviving it.
