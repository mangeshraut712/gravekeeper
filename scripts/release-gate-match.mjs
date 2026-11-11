// Decides whether a shell command passed to the agent's shell tool publishes work
// (`git push` or `gh pr create`). Used by scripts/pre-release-gate.mjs.
//
// Matches anywhere in the command text, so newlines, leading whitespace, &&, ;, |,
// subshells, $(...), brace groups and VAR=value prefixes cannot hide a push.
// Fails closed: a quoted mention such as `echo "git push"` also matches, which only
// means the release checks run.

// git, optionally by path, then global options (-C dir, -c key=value, --flag[=value]), then push.
const GIT_PUSH = /(^|[^\w.-])(?:\S*\/)?git(?:\s+(?:-C\s+\S+|-c\s+\S+|--[\w-]+(?:=\S+)?))*\s+push\b/;
// gh, optionally by path, then flags with an optional value, then `pr create`.
const GH_PR_CREATE = /(^|[^\w.-])(?:\S*\/)?gh(?:\s+-{1,2}[\w-]+(?:[=\s]\S+)?)*\s+pr\s+create\b/;

/** @param {string} command */
export function isReleaseCommand(command) {
  return GIT_PUSH.test(command) || GH_PR_CREATE.test(command);
}
