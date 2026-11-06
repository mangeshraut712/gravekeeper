/**
 * POST /api/fork
 *
 * Creates a GitHub fork for the authenticated user and records a Receipt of
 * kind "fork". Operator-only; requires GITHUB_TOKEN and a 32+ character FORK_API_SECRET.
 * Public UI uses GitHub's native confirmation flow instead.
 */

import { NextRequest } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { isGitHubRepository } from "@/shared/url";
import type { Receipt } from "@/types/index";
import { generateKeyPair, exportPublicKey } from "@/lib/receipts/crypto";
import { buildReceipt } from "@/lib/receipts/chain";
import { createFork } from "@/lib/github/client";

export async function POST(request: NextRequest): Promise<Response> {
  // Public deployments must not be able to spend the operator's GitHub token.
  // The browser UI uses GitHub's own fork flow; this is an operator-only API.
  const secret = process.env.FORK_API_SECRET;
  if (!secret || secret.length < 32) {
    return Response.json(
      {
        error:
          "Server-side fork creation is disabled. Use the GitHub fork page.",
        code: "FORK_FAILED",
      },
      { status: 503 },
    );
  }
  const digest = (value: string) => createHash("sha256").update(value).digest();
  if (
    !timingSafeEqual(
      digest(request.headers.get("authorization") ?? ""),
      digest(`Bearer ${secret}`),
    )
  ) {
    return Response.json(
      { error: "Operator authentication required.", code: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Request body must be valid JSON.", code: "PARSE_ERROR" },
      { status: 400 },
    );
  }

  if (typeof body !== "object" || body === null) {
    return Response.json(
      { error: "Body must be a JSON object.", code: "PARSE_ERROR" },
      { status: 400 },
    );
  }

  const owner = (body as { owner?: unknown }).owner;
  const repo = (body as { repo?: unknown }).repo;

  if (typeof owner !== "string" || !owner.trim()) {
    return Response.json(
      {
        error: 'Body must include a non-empty string "owner".',
        code: "PARSE_ERROR",
      },
      { status: 400 },
    );
  }
  if (typeof repo !== "string" || !repo.trim()) {
    return Response.json(
      {
        error: 'Body must include a non-empty string "repo".',
        code: "PARSE_ERROR",
      },
      { status: 400 },
    );
  }

  if (!isGitHubRepository(owner.trim(), repo.trim())) {
    return Response.json(
      {
        error: "Invalid GitHub owner or repository name.",
        code: "PARSE_ERROR",
      },
      { status: 400 },
    );
  }

  if (!process.env["GITHUB_TOKEN"]) {
    return Response.json(
      {
        error: "GITHUB_TOKEN is not configured. Fork creation is unavailable.",
        code: "FORK_FAILED",
      },
      { status: 503 },
    );
  }

  let privateKey: CryptoKey;
  let publicKey: CryptoKey;
  try {
    ({ privateKey, publicKey } = await generateKeyPair());
  } catch (err) {
    return Response.json(
      {
        error: err instanceof Error ? err.message : "Key generation failed",
        code: "CRYPTO_ERROR",
      },
      { status: 500 },
    );
  }

  const forkResult = await createFork(owner.trim(), repo.trim());
  if (!forkResult.ok) {
    const status =
      forkResult.code === "GITHUB_NOT_FOUND"
        ? 404
        : forkResult.code === "GITHUB_RATE_LIMIT"
          ? 429
          : forkResult.code === "FORK_FAILED"
            ? 502
            : 502;
    return Response.json(
      { error: forkResult.error, code: forkResult.code },
      { status },
    );
  }

  // GitHub may already have accepted the fork. Never return a retryable failure
  // solely because proof construction failed after that side effect.
  try {
    const publicKeyB64 = await exportPublicKey(publicKey);
    const receipt: Receipt = await buildReceipt(
      null,
      "fork",
      `https://api.github.com/repos/${owner.trim()}/${repo.trim()}/forks`,
      new TextEncoder().encode(forkResult.data.rawBody),
      privateKey,
    );
    return Response.json(
      { forkUrl: forkResult.data.forkUrl, receipt, publicKey: publicKeyB64 },
      { status: 200 },
    );
  } catch {
    return Response.json(
      {
        forkUrl: forkResult.data.forkUrl,
        receipt: null,
        publicKey: null,
        warning:
          "GitHub accepted the fork, but the proof could not be generated. Check the fork URL before retrying.",
      },
      { status: 202 },
    );
  }
}
