/** Public resources only: no credentials, query strings, or local addresses. */
export function normalizePublicUrl(input: string): string | null {
  if (input.length > 2048) return null;
  try {
    const url = new URL(input.trim());
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.port ||
      url.search
    )
      return null;
    const host = url.hostname.toLowerCase().replace(/\.$/, "");
    if (
      !host.includes(".") ||
      host.includes(":") ||
      /^\d+(\.\d+){3}$/.test(host) ||
      /\.(localhost|local|internal|test|invalid)$/.test(host)
    )
      return null;
    url.hash = "";
    return url.href;
  } catch {
    return null;
  }
}

export function isGitHubRepository(owner: string, repo: string): boolean {
  return (
    /^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(owner) &&
    /^[a-z\d_.-]{1,100}$/i.test(repo) &&
    ![".", ".."].includes(repo)
  );
}
