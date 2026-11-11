import { describe, expect, it } from "vitest";
import { commandFromEvent, isReleaseCommand } from "./release-gate-match.mjs";

describe("isReleaseCommand", () => {
  it.each([
    ["plain push", "git push origin HEAD"],
    ["plain pr create", "gh pr create --fill"],
    ["newline-separated", "cd repo\ngit push origin HEAD"],
    ["git add/commit/push block", "git add -A\ngit commit -m x\ngit push"],
    ["leading whitespace", "   git push"],
    ["leading tab and newline", "\n\tgh pr create --base main"],
    ["after &&", "npm test && git push"],
    ["after ;", "echo hi; git push"],
    ["after |", "yes | git push"],
    ["after ||", "false || gh pr create"],
    ["subshell", "(cd repo && git push)"],
    ["command substitution", "echo $(git push)"],
    ["brace group", "{ git push; }"],
    ["git -C dir push", "git -C ../repo push origin main"],
    ["git -c key=value push", "git -c http.extraHeader=x push"],
    ["git --no-pager push", "git --no-pager push"],
    ["env assignment prefix", "GIT_TRACE=1 git push"],
    ["gh with repo flag", "gh pr create -R owner/repo --fill"],
    ["absolute git path", "/usr/bin/git push"],
    // Forms reported by the 2026-11-11 Kiro review.
    ["git -P push", "git -P push"],
    ["git -p push", "git -p push origin main"],
    ["git --git-dir <path> push", "git --git-dir .git push"],
    ["git --work-tree <dir> push", "git --work-tree dir push"],
    ["git -C quoted dir with space", 'git -C "my dir" push'],
    ["quoted git", '"git" push'],
    ["quoted push", "git 'push' origin"],
    ["line continuation", "git \\\npush origin main"],
  ])("matches %s", (_name, command) => {
    expect(isReleaseCommand(command)).toBe(true);
  });

  it.each([
    ["git status", "git status"],
    ["git stash push", "git stash push -m wip"],
    ["git log grep push", "git log --grep push"],
    ["gh pr view", "gh pr view 6"],
    ["gh pr list", "gh pr list --state open"],
    ["npm script containing push", "npm run push-docs"],
    ["word containing git", "legit push"],
    ["ls", "ls -la"],
    ["empty", ""],
  ])("does not match %s", (_name, command) => {
    expect(isReleaseCommand(command)).toBe(false);
  });
});

describe("commandFromEvent", () => {
  it("reads the shell command from a hook event", () => {
    expect(commandFromEvent('{"tool_input":{"command":"git push"}}')).toBe("git push");
    expect(commandFromEvent('{"tool_input":{}}')).toBe("");
    expect(commandFromEvent("")).toBe("");
  });

  // The gate claims to fail closed, so an event it cannot parse must not pass silently.
  it("returns null for an event it cannot parse", () => {
    expect(commandFromEvent("{not json")).toBeNull();
    expect(commandFromEvent("[]")).toBeNull();
  });
});
