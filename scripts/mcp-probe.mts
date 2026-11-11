// Starts an MCP server from .kiro/settings/mcp.json over stdio, lists its tools, and optionally calls one.
// Usage: node scripts/mcp-probe.mts <server> [--call=<tool> --args='{"url":"https://..."}']
// ${VAR} placeholders in the config env are filled from process.env; values are never printed.
// This talks to the server directly with JSON-RPC. It proves the configured server starts and answers,
// not that Kiro itself invoked it.
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";

const name = process.argv[2];
const call = process.argv.find((a) => a.startsWith("--call="))?.slice(7);
const callArgs = JSON.parse(process.argv.find((a) => a.startsWith("--args="))?.slice(7) ?? "{}");
const config = JSON.parse(readFileSync(new URL("../.kiro/settings/mcp.json", import.meta.url), "utf8")).mcpServers[name];
if (!config) throw new Error(`no MCP server "${name}" in .kiro/settings/mcp.json`);
const env: NodeJS.ProcessEnv = { ...process.env };
for (const [k, v] of Object.entries<string>(config.env ?? {})) {
  env[k] = v.replace(/\$\{(\w+)\}/g, (_, n) => process.env[n] ?? "");
  if (!env[k]) console.log(`note: ${k} resolves to an empty value (${v.match(/\w+/)?.[0]} is not set)`);
}
const child = spawn(String(config.command), (config.args as string[]).map(String), { env, stdio: "pipe" as const });
let stderr = "";
child.stderr.on("data", (d) => (stderr += d));
let buf = "";
type Msg = { id?: number; result?: any; error?: unknown }; // eslint-disable-line @typescript-eslint/no-explicit-any
const waiting = new Map<number, (m: Msg) => void>();
child.stdout.on("data", (d) => {
  buf += d;
  let i;
  while ((i = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, i).trim();
    buf = buf.slice(i + 1);
    if (!line) continue;
    try { const m: Msg = JSON.parse(line); if (m.id !== undefined) waiting.get(m.id)?.(m); } catch { /* non-JSON log line */ }
  }
});
const exited = new Promise<string>((r) => child.on("exit", (c) => r(`exited with code ${c}`)));
let id = 0;
function rpc(method: string, params: unknown = {}): Promise<Msg> {
  const n = ++id;
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: n, method, params }) + "\n");
  return Promise.race([
    new Promise<Msg>((r) => waiting.set(n, r)),
    exited.then((e): Msg => { throw new Error(`server ${e}`); }),
    new Promise<Msg>((_, rej) => setTimeout(() => rej(new Error("timeout after 60s")), 60_000)),
  ]);
}
try {
  const init = await rpc("initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "gravekeeper-probe", version: "0" } });
  console.log(`server started: ${init.result.serverInfo.name} ${init.result.serverInfo.version}`);
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");
  const tools = await rpc("tools/list");
  console.log("tools:", tools.result.tools.map((t: { name: string }) => t.name).join(", "));
  if (call) {
    const res = await rpc("tools/call", { name: call, arguments: callArgs });
    const text = (res.result?.content ?? []).map((c: { text?: string }) => c.text ?? "").join("\n");
    console.log(`called ${call}: isError=${Boolean(res.result?.isError) || Boolean(res.error)}, ${text.length} chars`);
    console.log(text.slice(0, 400));
  }
} catch (e) {
  console.log(`FAILED: ${(e as Error).message}`);
  console.log("stderr (first line):", stderr.split("\n").find(Boolean)?.replace(/(token|Bearer)\S*/gi, "$1…") ?? "(empty)");
  process.exitCode = 1;
} finally {
  child.kill();
}
