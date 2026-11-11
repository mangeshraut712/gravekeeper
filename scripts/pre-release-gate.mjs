// Kiro PreToolUse hook (.kiro/hooks/pre-release-gate.json).
// Reads the hook event JSON from STDIN. If the agent is about to run `git push` or
// `gh pr create`, run the release checks first; a non-zero exit blocks the tool call.
// Any other shell command passes through immediately.
import { spawnSync } from "node:child_process";
import { commandFromEvent, isReleaseCommand } from "./release-gate-match.mjs";

let raw = "";
for await (const chunk of process.stdin) raw += chunk;

// An event we cannot parse runs the checks (fail closed) instead of passing silently.
const parsed = commandFromEvent(raw);
const command = parsed ?? "(unparseable hook event)";
if (parsed !== null && !isReleaseCommand(parsed)) process.exit(0);

const checks = ["npm test", "npm run lint", "npm run demo:verify"];
const CHECK_TIMEOUT_MS = 10 * 60 * 1000;
for (const check of checks) {
  const run = spawnSync(check, {
    shell: true,
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
    timeout: CHECK_TIMEOUT_MS,
  });
  if (run.status !== 0) {
    process.stderr.write(
      `pre-release gate: \`${check}\` failed (exit ${run.status}); blocking \`${command.split("\n")[0]}\`.\n` +
        (run.stdout + run.stderr).slice(-3000),
    );
    process.exit(2);
  }
}
console.log(`pre-release gate: ${checks.join(", ")} passed.`);
