#!/usr/bin/env node
// Fails the build if public/ (everything Vite ships verbatim in dist/)
// exceeds the Dreamforce size budget. Run automatically before `vite build`
// so a regression can never silently reach the show.
// See docs/IMPLEMENTATION_PLAN.md, "3D asset plan" -> "Total target: <= 20 MB".

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PUBLIC = path.join(ROOT, "public");

const BUDGET_BYTES = 20 * 1024 * 1024;

function fmtBytes(n) {
  if (n >= 1024 * 1024) return (n / 1024 / 1024).toFixed(2) + " MB";
  return (n / 1024).toFixed(1) + " KB";
}

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(walk(full));
    } else if (entry.isFile()) {
      files.push({ path: full, size: fs.statSync(full).size });
    }
  }
  return files;
}

function main() {
  if (!fs.existsSync(PUBLIC)) {
    console.error(`Asset budget check: public/ not found at ${PUBLIC}`);
    process.exit(1);
  }

  const files = walk(PUBLIC);
  const total = files.reduce((a, f) => a + f.size, 0);

  // Breakdown by top-level folder under public/, so an overage is actionable.
  const byFolder = {};
  for (const f of files) {
    const rel = path.relative(PUBLIC, f.path);
    const top = rel.split(path.sep)[0];
    byFolder[top] = (byFolder[top] || 0) + f.size;
  }

  console.log("Asset budget check — public/ contents:");
  for (const [folder, size] of Object.entries(byFolder).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${folder.padEnd(20)} ${fmtBytes(size)}`);
  }
  console.log(`  ${"TOTAL".padEnd(20)} ${fmtBytes(total)}  (budget: ${fmtBytes(BUDGET_BYTES)})`);

  if (total > BUDGET_BYTES) {
    console.error(
      `\nAsset budget EXCEEDED: ${fmtBytes(total)} > ${fmtBytes(BUDGET_BYTES)} budget.`,
    );
    console.error("Largest files:");
    files
      .sort((a, b) => b.size - a.size)
      .slice(0, 10)
      .forEach((f) => console.error(`  ${fmtBytes(f.size).padStart(10)}  ${path.relative(PUBLIC, f.path)}`));
    console.error("\nBuild blocked. See docs/IMPLEMENTATION_PLAN.md, Milestone 1.");
    process.exit(1);
  }

  console.log(`\nOK — under budget by ${fmtBytes(BUDGET_BYTES - total)}.`);
}

main();
