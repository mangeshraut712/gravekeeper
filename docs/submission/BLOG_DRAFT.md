# Blog draft: DRAFT, NOT PUBLISHED

Mangesh publishes this himself, on a platform he chooses. Published URL: ______

---

# Building Gravekeeper with Kiro: receipts for dead code

I built Gravekeeper for the Kiroween 2026 hackathon (Resurrection category). It is a small web app: you give it a public URL, and it looks for an Internet Archive snapshot and, for GitHub repositories, pulls metadata and recent commits. It then produces a revival checklist and a signed, hash-chained record of what it fetched. Live demo: https://gravekeeper-drab.vercel.app. Code: https://github.com/mangeshraut712/gravekeeper.

## What it is, and is not

The checklist comes from public metadata. It is not a code audit. The receipts are Ed25519-signed and SHA-256 chained, and you can download them and verify offline. That proves the file is internally consistent. It does not prove who made it, or that GitHub or the Archive really said what the receipt says.

There are also two bundled cases: a pinned MIT string reverser (`esrever`) that breaks emoji, reimplemented with `Intl.Segmenter` so it passes 12 of 12 fixtures where the original passes 4; and an original 1999-style HTML page rewritten into semantic HTML.

## How Kiro helped

I used Kiro CLI. The most useful pattern was spec first for the part that must be right:

1. Kiro wrote steering docs from a short pitch. It read the installed packages and corrected the versions I had guessed.
2. It wrote requirements with EARS acceptance criteria, a design with six correctness properties for the receipt chain, and 17 ordered tasks.
3. It then implemented tasks against the spec: crypto, chain, Wayback and GitHub clients, spec generator, routes, with fast-check tests that mirror the design properties (round trip, tamper detection, key-order independence, sequence monotonicity).

A custom read-only review agent was the second useful thing. It could only read files, and it still found real problems: an error response whose digest could reveal whether a private repository existed, and a verifier that checked signatures but not the data the page displayed. Both were fixed with regression tests.

## What did not go smoothly

One session hit the monthly usage limit and wrote nothing, so I finished that work by hand. Much of the UI and the safety work was written by me, not Kiro, and the usage log in the repo says which parts. I also configured agent hooks and MCP servers (GitHub and fetch). On Nov 11 I saw a post-save agent hook fire once and probed both MCP servers directly (the fetch server answered; the GitHub server started but I had no token to call it). I also found the fetch package I had configured did not exist and replaced it. I am not claiming more than that. I did not use Kiro powers or Crew.

Accessibility: automated axe scans found no violations on the product pages I scanned, in Chromium, Firefox and WebKit. That is not a conformance claim. Color contrast over the animated fog is flagged "needs review" by axe, so I measured it by sampling pixels. I did not do a screen reader pass.

## Takeaway

Write the properties first, then let the agent implement against them. The tests became the contract, and the review agent's limits (read only) made it safe to point at the whole repo.

*Written as part of the Kiroween 2026 hackathon.*
