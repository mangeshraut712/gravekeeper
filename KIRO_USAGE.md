# How Kiro was used to build Gravekeeper

A running log for the Kiroween write-up. Newest entries at the bottom.

## Week 1 (Nov 3, 2026)

### Steering (`.kiro/steering/`)
- Kiro CLI wrote `product.md`, `tech.md` and `structure.md` from a one-paragraph product pitch.
- It read the installed packages and pinned the real versions (Next.js 16, Tailwind v4, Vitest, fast-check) in `tech.md` instead of the version I guessed in the prompt.
- Every later Kiro session starts with "follow .kiro/steering", so module layout and conventions stay the same across sessions.

### Spec-driven development (`.kiro/specs/resurrect/`)
- `requirements.md`: 7 user stories with numbered EARS acceptance criteria.
- `design.md`: architecture, data models (including the hash-chained `Receipt`), canonical JSON hashing, six correctness properties written to be checked by property-based tests, and a `Result<T>` error model.
- `tasks.md`: 17 tasks in 4 phases, each one linked to the requirements it covers.
- Then Kiro worked through the tasks one at a time:
  - Tasks 1–3: shared types, Ed25519 receipt signing, and the SHA-256 receipt chain. The fast-check property tests cover all six design properties. I fixed a few TypeScript typing issues by hand after Kiro's session was throttled.
  - Task 4: Wayback Machine availability client with mocked-fetch tests.

### Specs vs vibe
- Core logic goes through specs because the receipt chain has to be correct.
- Planned for UI polish: vibe coding on the haunted graveyard look.

## Planned
- Week 2: agent hooks (tests run on save, spec/tasks kept in sync), MCP (GitHub and fetch servers), a custom `gravekeeper` agent config.
- Week 3: UI and Vercel deploy.
- Week 4: write-up.
