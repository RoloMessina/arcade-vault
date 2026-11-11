// PostToolUse (Write): pasa Prettier y ESLint por el archivo recién creado.
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { extname, resolve } from "node:path";

const input = JSON.parse(readFileSync(0, "utf8") || "{}");
const file = input.tool_response?.filePath ?? input.tool_input?.file_path;
if (!file || !existsSync(file)) process.exit(0);

const ext = extname(file).toLowerCase();
const PRETTIER = new Set([".tsx", ".jsx", ".ts", ".js", ".mjs", ".md"]);
const ESLINT = new Set([".tsx", ".jsx", ".ts", ".js", ".mjs"]);
if (!PRETTIER.has(ext)) process.exit(0);

const cwd = resolve(input.cwd ?? process.cwd());
const run = (args) =>
  spawnSync(`npx --no-install ${args.join(" ")}`, { cwd, shell: true, encoding: "utf8" });

const out = [];
const p = run(["prettier", "--write", JSON.stringify(file)]);
if (p.status !== 0) out.push(`Prettier falló:\n${p.stdout}${p.stderr}`);

if (ESLINT.has(ext)) {
  const l = run(["eslint", "--fix", JSON.stringify(file)]);
  if (l.status !== 0) out.push(`ESLint reporta problemas:\n${l.stdout}${l.stderr}`);
}

if (out.length) {
  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PostToolUse",
        additionalContext: out.join("\n").slice(0, 4000),
      },
    }),
  );
}
