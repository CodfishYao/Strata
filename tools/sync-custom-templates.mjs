#!/usr/bin/env node
/**
 * 把 src/custom/*.tpl 复制成 templates/<name>.html。
 *
 * 为什么用 .tpl：Vite 会把 src 下的 .html 当入口去解析，导致整页 HTML 被拆解；
 * 换成 .tpl 后 Vite 不动它，由本脚本原样复制。
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const from = join(root, "src", "custom");
const to = join(root, "templates");

if (!existsSync(from)) process.exit(0);
mkdirSync(to, { recursive: true });

for (const file of readdirSync(from)) {
  if (!file.endsWith(".tpl")) continue;
  const target = file.replace(/\.tpl$/, ".html");
  copyFileSync(join(from, file), join(to, target));
  console.log(`✓ templates/${target}`);
}