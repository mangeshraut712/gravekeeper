// Kiro PreToolUse hook (.kiro/hooks/pre-release-gate.json).
// Reads the hook event JSON from STDIN. If the agent is about to run `git push` or
// `gh pr create`, run the release checks first; a non-zero exit blocks the tool call.
// Any other shell command passes through immediately.
import { spawnSync } from "node:child_process";
import { isReleaseCommand } from "./release-gate-match.mjs";

let raw = "";
for await (const chunk of process.stdin) raw += chunk;

let command = "";
try {
  const event = JSON.parse(raw || "{}");
  const input = event.tool_input ?? {};
  command = typeof input.command === "string" ? input.command : "";
} catch {
  process.exit(0); // Not a shell event we understand; do not block.
}

if (!isReleaseCommand(command)) process.exit(0);

const checks = ["npm test", "npm run lint", "npm run demo:verify"];
for (const check of checks) {
  const run = spawnSync(check, { shell: true, stdio: ["ignore", "pipe", "pipe"], encoding: "utf8" });
  if (run.status !== 0) {
    process.stderr.write(
      `pre-release gate: \`${check}\` failed (exit ${run.status}); blocking \`${command.split("\n")[0]}\`.\n` +
        (run.stdout + run.stderr).slice(-3000),
    );
    process.exit(2);
  }
}
console.log(`pre-release gate: ${checks.join(", ")} passed.`);
