// Decides whether a shell command passed to the agent's shell tool publishes work
// (`git push` or `gh pr create`). Used by scripts/pre-release-gate.mjs.
//
// Matches anywhere in the command text, so newlines, leading whitespace, &&, ;, |,
// subshells, $(...), brace groups and VAR=value prefixes cannot hide a push.
// Fails closed: a quoted mention such as `echo "git push"` also matches, which only
// means the release checks run.

// Separator: whitespace or a backslash line continuation.
const SEP = String.raw`(?:\s|\\\r?\n)+`;
// One shell word: a quoted string or a run of non-space characters.
const WORD = String.raw`(?:"[^"\n]*"|'[^'\n]*'|\S+)`;
// Global git options before the subcommand: -C/-c take a word; long options that take
// a separate value (--git-dir dir); other short or long flags (-P, --no-pager, --x=y).
const GIT_OPTION = String.raw`(?:-[Cc]${SEP}${WORD}|--(?:git-dir|work-tree|namespace|config-env|exec-path|super-prefix)${SEP}${WORD}|--[\w-]+(?:=\S+)?|-[A-Za-z])`;
// git, optionally by path and optionally quoted, then global options, then push.
const GIT_PUSH = new RegExp(
  String.raw`(^|[^\w.-])["']?(?:\S*\/)?git["']?(?:${SEP}${GIT_OPTION})*${SEP}["']?push\b`,
);
// gh, optionally by path, then flags with an optional value, then `pr create`.
const GH_PR_CREATE = /(^|[^\w.-])(?:\S*\/)?gh(?:\s+-{1,2}[\w-]+(?:[=\s]\S+)?)*\s+pr\s+create\b/;

/** @param {string} command */
export function isReleaseCommand(command) {
  return GIT_PUSH.test(command) || GH_PR_CREATE.test(command);
}

/**
 * Shell command from a Kiro hook event (JSON on STDIN). Returns "" when the event has
 * no command and null when the event cannot be parsed, so the caller can fail closed.
 * @param {string} raw
 * @returns {string | null}
 */
export function commandFromEvent(raw) {
  let event;
  try {
    event = JSON.parse(raw || "{}");
  } catch {
    return null;
  }
  if (typeof event !== "object" || event === null || Array.isArray(event)) return null;
  const input = event.tool_input ?? {};
  return typeof input.command === "string" ? input.command : "";
}
